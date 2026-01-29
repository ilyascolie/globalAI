import axios, { AxiosInstance } from 'axios';
import { RawNewsItem, DataSource } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import cache from '../cache.js';

interface EventRegistryEvent {
  uri: string;
  title: {
    eng?: string;
    [key: string]: string | undefined;
  };
  summary?: {
    eng?: string;
    [key: string]: string | undefined;
  };
  eventDate: string;
  location?: {
    type: string;
    label: {
      eng?: string;
      [key: string]: string | undefined;
    };
    lat?: number;
    long?: number;
    country?: {
      label: {
        eng?: string;
      };
    };
  };
  concepts?: Array<{
    type: string;
    label: {
      eng?: string;
    };
    score: number;
  }>;
  categories?: Array<{
    label: string;
    wgt: number;
  }>;
  images?: string[];
  articlesCounts?: {
    total: number;
  };
  sentiment?: number;
}

interface EventRegistryResponse {
  events?: {
    results?: EventRegistryEvent[];
    totalResults?: number;
  };
}

export class EventRegistryService implements DataSource {
  name = 'EventRegistry';
  private client: AxiosInstance;
  private monthlyTokensUsed = 0;
  private lastResetMonth: string;

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.eventRegistry.baseUrl,
      timeout: 30000,
    });

    this.lastResetMonth = new Date().toISOString().slice(0, 7);
  }

  private checkMonthlyLimit(): boolean {
    const currentMonth = new Date().toISOString().slice(0, 7);

    if (currentMonth !== this.lastResetMonth) {
      this.monthlyTokensUsed = 0;
      this.lastResetMonth = currentMonth;
    }

    // Free tier: 2000 tokens/month, each request uses ~1 token
    return this.monthlyTokensUsed < 2000;
  }

  async isAvailable(): Promise<boolean> {
    if (!config.apis.eventRegistry.apiKey) {
      logger.warn('EventRegistry key not configured');
      return false;
    }
    return this.checkMonthlyLimit();
  }

  async fetch(): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      logger.warn('EventRegistry not available (no API key or monthly limit reached)');
      return [];
    }

    logger.info('Fetching events from EventRegistry...');

    try {
      // Check cache first - EventRegistry data changes less frequently
      const cacheKey = `eventregistry:recent:${new Date().toISOString().slice(0, 13)}`;
      const cached = await cache.get<RawNewsItem[]>(cacheKey);
      if (cached) {
        logger.debug('Returning cached EventRegistry results');
        return cached;
      }

      this.monthlyTokensUsed++;

      const response = await withRetry(
        () =>
          this.client.get<EventRegistryResponse>('/event/getEvents', {
            params: {
              apiKey: config.apis.eventRegistry.apiKey,
              resultType: 'events',
              eventsSortBy: 'date',
              eventsSortByAsc: false,
              eventsCount: 50,
              eventsEventImageCount: 1,
              eventsIncludeEventSummary: true,
              eventsIncludeEventLocation: true,
              eventsIncludeEventConcepts: true,
              lang: 'eng',
              dateStart: new Date(Date.now() - 86400000).toISOString().split('T')[0],
            },
          }),
        'EventRegistry fetch'
      );

      const events = response.data.events?.results || [];
      logger.info(`EventRegistry returned ${events.length} events`);

      const items = events
        .filter((event) => event.title?.eng)
        .map((event) => this.mapEventToNewsItem(event));

      // Cache for 1 hour
      await cache.set(cacheKey, items, 3600);

      return items;
    } catch (error) {
      logger.error('Failed to fetch from EventRegistry:', error);
      return [];
    }
  }

  async fetchByCategory(category: string): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      this.monthlyTokensUsed++;

      const response = await withRetry(
        () =>
          this.client.get<EventRegistryResponse>('/event/getEvents', {
            params: {
              apiKey: config.apis.eventRegistry.apiKey,
              resultType: 'events',
              categoryUri: category,
              eventsSortBy: 'date',
              eventsSortByAsc: false,
              eventsCount: 30,
              eventsIncludeEventSummary: true,
              eventsIncludeEventLocation: true,
              lang: 'eng',
            },
          }),
        `EventRegistry fetch category: ${category}`
      );

      const events = response.data.events?.results || [];
      return events
        .filter((event) => event.title?.eng)
        .map((event) => this.mapEventToNewsItem(event));
    } catch (error) {
      logger.error(`Failed to fetch category ${category} from EventRegistry:`, error);
      return [];
    }
  }

  async fetchByLocation(lat: number, lng: number, radiusKm: number): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      this.monthlyTokensUsed++;

      const response = await withRetry(
        () =>
          this.client.get<EventRegistryResponse>('/event/getEvents', {
            params: {
              apiKey: config.apis.eventRegistry.apiKey,
              resultType: 'events',
              locationUri: `geo:${lat},${lng},${radiusKm}`,
              eventsSortBy: 'date',
              eventsSortByAsc: false,
              eventsCount: 30,
              eventsIncludeEventSummary: true,
              eventsIncludeEventLocation: true,
              lang: 'eng',
            },
          }),
        `EventRegistry fetch location: ${lat},${lng}`
      );

      const events = response.data.events?.results || [];
      return events
        .filter((event) => event.title?.eng)
        .map((event) => this.mapEventToNewsItem(event));
    } catch (error) {
      logger.error(`Failed to fetch location from EventRegistry:`, error);
      return [];
    }
  }

  private mapEventToNewsItem(event: EventRegistryEvent): RawNewsItem {
    let location: RawNewsItem['location'];

    if (event.location) {
      location = {
        lat: event.location.lat,
        lng: event.location.long,
        name: event.location.label?.eng || event.location.country?.label?.eng,
      };
    }

    // Extract themes from concepts
    const themes = event.concepts
      ?.filter((c) => c.score > 50)
      .map((c) => c.label.eng || '')
      .filter(Boolean);

    return {
      title: event.title.eng || Object.values(event.title).find(Boolean) || '',
      summary: event.summary?.eng || Object.values(event.summary || {}).find(Boolean),
      url: `https://eventregistry.org/event/${event.uri}`,
      timestamp: new Date(event.eventDate),
      source: 'EventRegistry',
      imageUrl: event.images?.[0],
      location,
      themes,
      gdeltTone: event.sentiment !== undefined ? event.sentiment * 10 : undefined,
    };
  }

  getRemainingTokens(): number {
    this.checkMonthlyLimit();
    return Math.max(0, 2000 - this.monthlyTokensUsed);
  }
}

export const eventRegistryService = new EventRegistryService();
export default eventRegistryService;
