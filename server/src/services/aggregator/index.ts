import axios from 'axios';
import NodeCache from 'node-cache';
import type { Event, EventCategory, EventFilters, HeatmapPoint } from '../../types/index.js';
import { cellToLatLng, latLngToCell } from 'h3-js';

// GDELT API endpoint
const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc';

// Cache events for 5 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
const EVENTS_CACHE_KEY = 'gdelt_events';
const HEATMAP_CACHE_KEY = 'heatmap_data';

interface GDELTArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry: string;
  tone?: number;
  lat?: number;
  lng?: number;
}

interface GDELTResponse {
  articles: GDELTArticle[];
}

export class AggregatorService {
  private lastFetchTime: Date | null = null;

  /**
   * Fetch events from GDELT and other sources
   */
  async getEvents(filters?: EventFilters): Promise<Event[]> {
    const cached = cache.get<Event[]>(EVENTS_CACHE_KEY);
    if (cached) {
      return this.applyFilters(cached, filters);
    }

    try {
      const events = await this.fetchGDELT();
      cache.set(EVENTS_CACHE_KEY, events);
      this.lastFetchTime = new Date();
      return this.applyFilters(events, filters);
    } catch (error) {
      console.error('Error fetching GDELT data:', error);
      const staleCache = cache.get<Event[]>(EVENTS_CACHE_KEY);
      if (staleCache) {
        return this.applyFilters(staleCache, filters);
      }
      // Return sample data if all else fails
      return this.getSampleEvents();
    }
  }

  /**
   * Fetch events from GDELT API
   */
  private async fetchGDELT(): Promise<Event[]> {
    const events: Event[] = [];

    try {
      const response = await axios.get<GDELTResponse>(GDELT_API, {
        params: {
          query: 'sourcelang:english',
          mode: 'artlist',
          maxrecords: 100,
          format: 'json',
          timespan: '24h',
        },
        timeout: 15000,
      });

      const articles = response.data?.articles || [];

      for (const article of articles) {
        // Skip if no location data
        if (!article.lat || !article.lng) continue;

        const event = this.processGDELTArticle(article);
        if (event) {
          events.push(event);
        }
      }
    } catch (error) {
      console.error('GDELT API error:', error);
    }

    // If no events from GDELT, use sample data
    if (events.length === 0) {
      return this.getSampleEvents();
    }

    return events;
  }

  /**
   * Process a GDELT article into an Event
   */
  private processGDELTArticle(article: GDELTArticle): Event | null {
    const category = this.detectCategory(article.title);
    const intensity = this.calculateIntensity(article);

    return {
      id: Buffer.from(article.url).toString('base64').slice(0, 16),
      title: article.title,
      summary: article.title, // GDELT doesn't provide summaries in basic API
      lat: article.lat!,
      lng: article.lng!,
      timestamp: new Date(article.seendate),
      source: article.domain,
      sourceUrl: article.url,
      category,
      intensity,
      imageUrl: article.socialimage,
      entities: [],
      gdeltTone: article.tone,
      relatedEventIds: [],
    };
  }

  /**
   * Detect event category from title
   */
  private detectCategory(title: string): EventCategory {
    const lower = title.toLowerCase();
    if (/war|military|troops|attack|missile|bomb|conflict|terror/i.test(lower)) return 'conflict';
    if (/election|vote|president|minister|parliament|senate|congress/i.test(lower)) return 'politics';
    if (/earthquake|hurricane|flood|fire|storm|disaster|tsunami/i.test(lower)) return 'disaster';
    if (/economy|stock|market|inflation|gdp|trade|tariff|oil|gas/i.test(lower)) return 'economics';
    if (/health|disease|virus|covid|vaccine|medical|hospital/i.test(lower)) return 'health';
    if (/tech|ai|software|computer|digital|cyber|robot/i.test(lower)) return 'technology';
    if (/climate|environment|pollution|carbon|energy|renewable/i.test(lower)) return 'environment';
    return 'politics'; // Default
  }

  /**
   * Calculate event intensity score (0-100)
   */
  private calculateIntensity(article: GDELTArticle): number {
    let intensity = 50; // Base

    // Adjust by tone (stronger sentiment = more significant)
    if (article.tone !== undefined) {
      intensity += Math.abs(article.tone) * 3;
    }

    // Cap at 100
    return Math.min(100, Math.max(0, intensity));
  }

  /**
   * Apply filters to events
   */
  private applyFilters(events: Event[], filters?: EventFilters): Event[] {
    if (!filters) return events;

    return events.filter((e) => {
      if (filters.categories && !filters.categories.includes(e.category)) {
        return false;
      }
      if (filters.since && e.timestamp < filters.since) {
        return false;
      }
      if (filters.bounds) {
        const { north, south, east, west } = filters.bounds;
        if (e.lat > north || e.lat < south || e.lng > east || e.lng < west) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Generate heatmap data from events
   */
  async getHeatmap(resolution: 'low' | 'medium' | 'high' = 'medium'): Promise<HeatmapPoint[]> {
    const cacheKey = `${HEATMAP_CACHE_KEY}_${resolution}`;
    const cached = cache.get<HeatmapPoint[]>(cacheKey);
    if (cached) return cached;

    const events = await this.getEvents();
    const h3Resolution = resolution === 'low' ? 2 : resolution === 'medium' ? 3 : 4;

    // Aggregate events into H3 cells
    const cellMap = new Map<string, { events: Event[]; intensity: number }>();

    for (const event of events) {
      const h3Index = latLngToCell(event.lat, event.lng, h3Resolution);
      const existing = cellMap.get(h3Index);

      if (existing) {
        existing.events.push(event);
        existing.intensity += event.intensity;
      } else {
        cellMap.set(h3Index, { events: [event], intensity: event.intensity });
      }
    }

    // Convert to heatmap points
    const points: HeatmapPoint[] = [];
    let maxIntensity = 0;

    for (const [h3Index, data] of cellMap) {
      const [lat, lng] = cellToLatLng(h3Index);
      const intensity = data.intensity / data.events.length;
      maxIntensity = Math.max(maxIntensity, intensity);

      // Find dominant category
      const categoryCounts: Record<string, number> = {};
      for (const e of data.events) {
        categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
      }
      const dominantCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'politics';

      points.push({
        lat,
        lng,
        intensity,
        eventCount: data.events.length,
        dominantCategory,
        h3Index,
      });
    }

    // Normalize intensities
    for (const point of points) {
      point.intensity = (point.intensity / maxIntensity) * 100;
    }

    cache.set(cacheKey, points);
    return points;
  }

  /**
   * Get sample events for development/fallback
   */
  private getSampleEvents(): Event[] {
    const now = new Date();
    return [
      {
        id: 'sample-1',
        title: 'Global Climate Summit Reaches Historic Agreement',
        summary: 'World leaders agree on ambitious carbon reduction targets at the annual climate conference.',
        lat: 48.8566,
        lng: 2.3522,
        timestamp: now,
        source: 'Reuters',
        sourceUrl: 'https://reuters.com',
        category: 'environment',
        intensity: 85,
        entities: ['Paris', 'United Nations', 'Climate Change'],
        relatedEventIds: [],
      },
      {
        id: 'sample-2',
        title: 'Tech Giants Report Record Quarterly Earnings',
        summary: 'Major technology companies exceed analyst expectations amid AI boom.',
        lat: 37.7749,
        lng: -122.4194,
        timestamp: now,
        source: 'Financial Times',
        sourceUrl: 'https://ft.com',
        category: 'economics',
        intensity: 70,
        entities: ['Silicon Valley', 'NASDAQ', 'AI'],
        relatedEventIds: [],
      },
      {
        id: 'sample-3',
        title: 'Diplomatic Talks Continue in Geneva',
        summary: 'International mediators work to broker peace agreement.',
        lat: 46.2044,
        lng: 6.1432,
        timestamp: now,
        source: 'BBC',
        sourceUrl: 'https://bbc.com',
        category: 'politics',
        intensity: 75,
        entities: ['Geneva', 'United Nations'],
        relatedEventIds: [],
      },
      {
        id: 'sample-4',
        title: 'Earthquake Strikes Pacific Region',
        summary: 'Magnitude 6.2 earthquake hits coastal area, no tsunami warning issued.',
        lat: 35.6762,
        lng: 139.6503,
        timestamp: now,
        source: 'AP',
        sourceUrl: 'https://apnews.com',
        category: 'disaster',
        intensity: 80,
        entities: ['Japan', 'Pacific Ocean'],
        relatedEventIds: [],
      },
      {
        id: 'sample-5',
        title: 'Major Military Exercise in Eastern Europe',
        summary: 'NATO conducts scheduled training operations with allied forces.',
        lat: 51.9194,
        lng: 19.1451,
        timestamp: now,
        source: 'NATO',
        sourceUrl: 'https://nato.int',
        category: 'conflict',
        intensity: 65,
        entities: ['NATO', 'Poland', 'Eastern Europe'],
        relatedEventIds: [],
      },
    ];
  }

  getLastFetchTime(): Date | null {
    return this.lastFetchTime;
  }
}

export const aggregatorService = new AggregatorService();
