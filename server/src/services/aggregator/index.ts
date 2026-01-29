import { v4 as uuidv4 } from 'uuid';
import { RawNewsItem, NewsEvent, DataSource } from '../../types/index.js';
import { gdeltService } from './gdelt.js';
import { newsApiService } from './newsapi.js';
import { eventRegistryService } from './eventregistry.js';
import { rssService } from './rss.js';
import { classifierService } from './classifier.js';
import { intensityService } from './intensity.js';
import { deduplicationService } from '../dedup/deduplication.js';
import { geocodingService } from '../geocoder/nominatim.js';
import { insertEvents } from '../../db/eventRepository.js';
import cache from '../cache.js';
import logger from '../../utils/logger.js';
import config from '../../config/index.js';

export class NewsAggregatorService {
  private sources: DataSource[];

  constructor() {
    this.sources = [
      gdeltService,
      newsApiService,
      eventRegistryService,
      rssService,
    ];
  }

  async aggregateNews(): Promise<NewsEvent[]> {
    logger.info('Starting news aggregation...');
    const startTime = Date.now();

    // 1. Fetch from all sources in parallel
    const allItems = await this.fetchAllSources();
    logger.info(`Fetched ${allItems.length} total items from all sources`);

    if (allItems.length === 0) {
      logger.warn('No items fetched from any source');
      return [];
    }

    // 2. Deduplicate items
    const mergedEvents = deduplicationService.deduplicate(allItems);
    logger.info(`Deduplicated to ${mergedEvents.length} unique events`);

    // 3. Geocode items missing coordinates
    const itemsNeedingGeocoding = mergedEvents.filter(
      (me) => !me.canonicalItem.location?.lat || !me.canonicalItem.location?.lng
    );

    if (itemsNeedingGeocoding.length > 0) {
      logger.info(`Geocoding ${itemsNeedingGeocoding.length} items...`);
      await this.geocodeItems(itemsNeedingGeocoding);
    }

    // 4. Convert to NewsEvent format with classification and intensity
    const newsEvents = deduplicationService.convertToNewsEvents(
      mergedEvents,
      (item) => classifierService.classify(item),
      (merged) => {
        const category = classifierService.classify(merged.canonicalItem);
        return intensityService.calculateIntensity(merged, category);
      }
    );

    // 5. Filter out events still missing coordinates
    const validEvents = newsEvents.filter(
      (event) => event.lat !== 0 && event.lng !== 0
    );

    logger.info(
      `Filtered to ${validEvents.length} events with valid coordinates ` +
        `(${newsEvents.length - validEvents.length} missing coordinates)`
    );

    // 6. Store in database
    if (validEvents.length > 0) {
      const inserted = await insertEvents(validEvents);
      logger.info(`Inserted/updated ${inserted} events in database`);
    }

    // 7. Invalidate relevant caches
    await this.invalidateCaches();

    const duration = Date.now() - startTime;
    logger.info(`News aggregation completed in ${duration}ms`);

    return validEvents;
  }

  private async fetchAllSources(): Promise<RawNewsItem[]> {
    const results: RawNewsItem[] = [];
    const fetchPromises: Promise<RawNewsItem[]>[] = [];

    for (const source of this.sources) {
      const isAvailable = await source.isAvailable();
      if (isAvailable) {
        fetchPromises.push(
          source.fetch().catch((error) => {
            logger.error(`Failed to fetch from ${source.name}:`, error);
            return [];
          })
        );
      } else {
        logger.warn(`Source ${source.name} is not available`);
      }
    }

    const sourceResults = await Promise.all(fetchPromises);

    for (const items of sourceResults) {
      results.push(...items);
    }

    return results;
  }

  private async geocodeItems(items: Array<{ canonicalItem: RawNewsItem }>): Promise<void> {
    // Limit geocoding to avoid rate limit issues
    const maxGeocodeItems = 20;
    const toGeocode = items.slice(0, maxGeocodeItems);

    for (const item of toGeocode) {
      // Try to extract location from title/summary
      const text = `${item.canonicalItem.title} ${item.canonicalItem.summary || ''}`;
      const locations = await geocodingService.extractAndGeocodeLocations(text);

      if (locations.length > 0) {
        item.canonicalItem.location = {
          lat: locations[0].lat,
          lng: locations[0].lng,
          name: locations[0].displayName,
        };
      } else if (item.canonicalItem.location?.name) {
        // Try geocoding the existing location name
        const result = await geocodingService.geocode(item.canonicalItem.location.name);
        if (result) {
          item.canonicalItem.location.lat = result.lat;
          item.canonicalItem.location.lng = result.lng;
        }
      }
    }
  }

  private async invalidateCaches(): Promise<void> {
    try {
      // Invalidate events and heatmap caches
      await cache.deletePattern('events:*');
      await cache.deletePattern('heatmap:*');
      await cache.delete(cache.constructor.keys.categories());
    } catch (error) {
      logger.warn('Failed to invalidate caches:', error);
    }
  }

  // Get available data sources status
  async getSourcesStatus(): Promise<Array<{ name: string; available: boolean; info?: string }>> {
    const statuses = [];

    for (const source of this.sources) {
      const available = await source.isAvailable();
      const info = this.getSourceInfo(source);
      statuses.push({ name: source.name, available, info });
    }

    return statuses;
  }

  private getSourceInfo(source: DataSource): string | undefined {
    if (source.name === 'NewsAPI') {
      const remaining = (source as typeof newsApiService).getRemainingRequests();
      return `${remaining} requests remaining today`;
    }
    if (source.name === 'EventRegistry') {
      const remaining = (source as typeof eventRegistryService).getRemainingTokens();
      return `${remaining} tokens remaining this month`;
    }
    return undefined;
  }

  // Fetch news for a specific location
  async fetchByLocation(lat: number, lng: number, radiusKm: number = 100): Promise<NewsEvent[]> {
    logger.info(`Fetching news for location: ${lat}, ${lng} (radius: ${radiusKm}km)`);

    const gdeltItems = await gdeltService.fetchByLocation(lat, lng, radiusKm);
    const eventRegItems = await eventRegistryService.fetchByLocation(lat, lng, radiusKm);

    const allItems = [...gdeltItems, ...eventRegItems];
    const mergedEvents = deduplicationService.deduplicate(allItems);

    return deduplicationService.convertToNewsEvents(
      mergedEvents,
      (item) => classifierService.classify(item),
      (merged) => {
        const category = classifierService.classify(merged.canonicalItem);
        return intensityService.calculateIntensity(merged, category);
      }
    );
  }

  // Fetch news for a specific theme/topic
  async fetchByTheme(theme: string): Promise<NewsEvent[]> {
    logger.info(`Fetching news for theme: ${theme}`);

    const gdeltItems = await gdeltService.fetchByTheme(theme);

    const mergedEvents = deduplicationService.deduplicate(gdeltItems);
    await this.geocodeItems(
      mergedEvents.filter((me) => !me.canonicalItem.location?.lat)
    );

    return deduplicationService.convertToNewsEvents(
      mergedEvents,
      (item) => classifierService.classify(item),
      (merged) => {
        const category = classifierService.classify(merged.canonicalItem);
        return intensityService.calculateIntensity(merged, category);
      }
    );
  }
}

export const newsAggregatorService = new NewsAggregatorService();
export default newsAggregatorService;
