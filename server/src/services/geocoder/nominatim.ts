import axios, { AxiosInstance } from 'axios';
import { GeocodingResult } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { withRetry, sleep, RateLimiter } from '../../utils/retry.js';
import cache from '../cache.js';
import { query } from '../../db/index.js';

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  importance: number;
  type: string;
  class: string;
}

export class GeocodingService {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.nominatim.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': config.apis.nominatim.userAgent,
      },
    });

    // Nominatim: 1 request per second
    this.rateLimiter = new RateLimiter(1, 1000);
  }

  async geocode(locationName: string): Promise<GeocodingResult | null> {
    if (!locationName || locationName.trim().length === 0) {
      return null;
    }

    const normalizedName = locationName.toLowerCase().trim();

    // Check Redis cache first
    const cacheKey = cache.constructor.keys.geocoding(normalizedName);
    const cached = await cache.get<GeocodingResult>(cacheKey);
    if (cached) {
      logger.debug(`Geocoding cache hit for: ${locationName}`);
      return cached;
    }

    // Check database cache
    const dbResult = await this.getFromDbCache(normalizedName);
    if (dbResult) {
      // Also cache in Redis for faster access
      await cache.set(cacheKey, dbResult, 86400); // 24 hours
      return dbResult;
    }

    // Fetch from Nominatim
    try {
      await this.rateLimiter.acquire();

      const response = await withRetry(
        () =>
          this.client.get<NominatimResult[]>('/search', {
            params: {
              q: locationName,
              format: 'json',
              limit: 1,
              addressdetails: 0,
            },
          }),
        `Geocoding: ${locationName}`,
        { maxRetries: 2 }
      );

      if (response.data.length === 0) {
        logger.debug(`No geocoding result for: ${locationName}`);
        return null;
      }

      const result = response.data[0];
      const geocodingResult: GeocodingResult = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        confidence: result.importance,
      };

      // Cache in both Redis and database
      await Promise.all([
        cache.set(cacheKey, geocodingResult, 86400),
        this.saveToDbCache(normalizedName, geocodingResult),
      ]);

      logger.debug(`Geocoded "${locationName}" to ${geocodingResult.lat}, ${geocodingResult.lng}`);
      return geocodingResult;
    } catch (error) {
      logger.error(`Geocoding failed for "${locationName}":`, error);
      return null;
    }
  }

  async geocodeBatch(locationNames: string[]): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();
    const uncachedLocations: string[] = [];

    // Check cache first for all locations
    for (const name of locationNames) {
      const normalizedName = name.toLowerCase().trim();
      const cacheKey = cache.constructor.keys.geocoding(normalizedName);
      const cached = await cache.get<GeocodingResult>(cacheKey);

      if (cached) {
        results.set(name, cached);
      } else {
        uncachedLocations.push(name);
      }
    }

    // Geocode uncached locations one by one (respecting rate limits)
    for (const name of uncachedLocations) {
      const result = await this.geocode(name);
      results.set(name, result);

      // Nominatim rate limit is strict - ensure we wait
      await sleep(1100);
    }

    return results;
  }

  async extractAndGeocodeLocations(text: string): Promise<GeocodingResult[]> {
    // Simple location extraction using common patterns
    const locations = this.extractLocationNames(text);
    const results: GeocodingResult[] = [];

    for (const location of locations) {
      const result = await this.geocode(location);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  private extractLocationNames(text: string): string[] {
    const locations: string[] = [];

    // Country patterns
    const countryPatterns = [
      /\b(United States|USA|U\.S\.A\.|U\.S\.|America)\b/gi,
      /\b(United Kingdom|UK|U\.K\.|Britain|England|Scotland|Wales)\b/gi,
      /\b(China|Russia|Japan|Germany|France|India|Brazil|Canada|Australia)\b/gi,
      /\b(Mexico|Italy|Spain|South Korea|North Korea|Iran|Iraq|Israel|Palestine)\b/gi,
      /\b(Ukraine|Poland|Turkey|Egypt|Saudi Arabia|South Africa|Nigeria)\b/gi,
    ];

    for (const pattern of countryPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        locations.push(...matches);
      }
    }

    // City patterns (major world cities)
    const cityPatterns = [
      /\b(New York|Los Angeles|Chicago|Washington|London|Paris|Berlin|Tokyo)\b/gi,
      /\b(Beijing|Shanghai|Moscow|Mumbai|Delhi|Sydney|Toronto|Cairo)\b/gi,
      /\b(Jerusalem|Tel Aviv|Baghdad|Tehran|Kabul|Kyiv|Kiev|Warsaw)\b/gi,
      /\b(Brussels|Geneva|Vienna|Rome|Madrid|Barcelona|Amsterdam|Dubai)\b/gi,
    ];

    for (const pattern of cityPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        locations.push(...matches);
      }
    }

    // Remove duplicates and normalize
    return [...new Set(locations.map((l) => l.trim()))];
  }

  private async getFromDbCache(locationName: string): Promise<GeocodingResult | null> {
    try {
      interface CacheRow {
        lat: number;
        lng: number;
        display_name: string | null;
        confidence: number | null;
      }

      const result = await query<CacheRow>(
        'SELECT lat, lng, display_name, confidence FROM geocoding_cache WHERE location_name = $1',
        [locationName]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          lat: row.lat,
          lng: row.lng,
          displayName: row.display_name || locationName,
          confidence: row.confidence || 0.5,
        };
      }

      return null;
    } catch (error) {
      logger.warn('Failed to check geocoding DB cache:', error);
      return null;
    }
  }

  private async saveToDbCache(locationName: string, result: GeocodingResult): Promise<void> {
    try {
      await query(
        `INSERT INTO geocoding_cache (location_name, lat, lng, display_name, confidence)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (location_name) DO UPDATE SET
           lat = EXCLUDED.lat,
           lng = EXCLUDED.lng,
           display_name = EXCLUDED.display_name,
           confidence = EXCLUDED.confidence`,
        [locationName, result.lat, result.lng, result.displayName, result.confidence]
      );
    } catch (error) {
      logger.warn('Failed to save geocoding result to DB cache:', error);
    }
  }

  // Pre-populate cache with common locations
  async warmupCache(): Promise<void> {
    const commonLocations = [
      'United States',
      'United Kingdom',
      'China',
      'Russia',
      'Japan',
      'Germany',
      'France',
      'India',
      'Brazil',
      'Canada',
      'Australia',
      'Mexico',
      'Italy',
      'Spain',
      'South Korea',
      'New York',
      'London',
      'Paris',
      'Tokyo',
      'Beijing',
      'Moscow',
      'Washington DC',
      'Brussels',
      'Geneva',
    ];

    logger.info('Warming up geocoding cache...');

    for (const location of commonLocations) {
      const cached = await cache.get(cache.constructor.keys.geocoding(location.toLowerCase()));
      if (!cached) {
        await this.geocode(location);
        await sleep(1100); // Respect rate limits
      }
    }

    logger.info('Geocoding cache warmup complete');
  }
}

export const geocodingService = new GeocodingService();
export default geocodingService;
