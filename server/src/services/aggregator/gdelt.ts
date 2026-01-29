import axios, { AxiosInstance } from 'axios';
import { RawNewsItem, DataSource } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { withRetry, RateLimiter } from '../../utils/retry.js';

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage?: string;
  domain: string;
  language: string;
  sourcecountry?: string;
  tone?: number;
  themes?: string;
  locations?: GdeltLocation[];
}

interface GdeltLocation {
  type: string;
  fullname: string;
  countrycode: string;
  adm1code?: string;
  lat?: number;
  long?: number;
  featureid?: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export class GdeltService implements DataSource {
  name = 'GDELT';
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.gdelt.baseUrl,
      timeout: 30000,
    });

    // Rate limit: X requests per minute
    this.rateLimiter = new RateLimiter(config.apis.gdelt.rateLimit, 60000);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.rateLimiter.acquire();
      const response = await this.client.get('/doc/doc', {
        params: {
          query: 'test',
          mode: 'artlist',
          maxrecords: 1,
          format: 'json',
        },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async fetch(): Promise<RawNewsItem[]> {
    logger.info('Fetching news from GDELT...');

    try {
      await this.rateLimiter.acquire();

      const response = await withRetry(
        () =>
          this.client.get<GdeltResponse>('/doc/doc', {
            params: {
              query: 'sourcecountry:US OR sourcecountry:UK OR sourcecountry:AU OR sourcelang:english',
              mode: 'artlist',
              maxrecords: 250,
              format: 'json',
              sort: 'datedesc',
              timespan: '15min',
            },
          }),
        'GDELT fetch'
      );

      const articles = response.data.articles || [];
      logger.info(`GDELT returned ${articles.length} articles`);

      return articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));
    } catch (error) {
      logger.error('Failed to fetch from GDELT:', error);
      return [];
    }
  }

  async fetchByTheme(theme: string): Promise<RawNewsItem[]> {
    try {
      await this.rateLimiter.acquire();

      const response = await withRetry(
        () =>
          this.client.get<GdeltResponse>('/doc/doc', {
            params: {
              query: `theme:${theme}`,
              mode: 'artlist',
              maxrecords: 100,
              format: 'json',
              sort: 'datedesc',
              timespan: '1h',
            },
          }),
        `GDELT fetch theme: ${theme}`
      );

      const articles = response.data.articles || [];
      return articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));
    } catch (error) {
      logger.error(`Failed to fetch theme ${theme} from GDELT:`, error);
      return [];
    }
  }

  async fetchByLocation(lat: number, lng: number, radiusKm: number): Promise<RawNewsItem[]> {
    try {
      await this.rateLimiter.acquire();

      const response = await withRetry(
        () =>
          this.client.get<GdeltResponse>('/doc/doc', {
            params: {
              query: `near:${lat},${lng},${radiusKm}km`,
              mode: 'artlist',
              maxrecords: 50,
              format: 'json',
              sort: 'datedesc',
            },
          }),
        `GDELT fetch location: ${lat},${lng}`
      );

      const articles = response.data.articles || [];
      return articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));
    } catch (error) {
      logger.error(`Failed to fetch location from GDELT:`, error);
      return [];
    }
  }

  private mapArticleToNewsItem(article: GdeltArticle): RawNewsItem {
    // Extract location from article if available
    let location: RawNewsItem['location'];

    if (article.locations && article.locations.length > 0) {
      const loc = article.locations[0];
      if (loc.lat !== undefined && loc.long !== undefined) {
        location = {
          lat: loc.lat,
          lng: loc.long,
          name: loc.fullname,
        };
      } else {
        location = {
          name: loc.fullname,
        };
      }
    }

    // Parse GDELT date format: YYYYMMDDHHMMSS
    let timestamp: Date;
    try {
      if (article.seendate && article.seendate.length >= 8) {
        const dateStr = article.seendate;
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = dateStr.length >= 10 ? parseInt(dateStr.substring(8, 10)) : 0;
        const minute = dateStr.length >= 12 ? parseInt(dateStr.substring(10, 12)) : 0;
        const second = dateStr.length >= 14 ? parseInt(dateStr.substring(12, 14)) : 0;
        timestamp = new Date(Date.UTC(year, month, day, hour, minute, second));
      } else {
        timestamp = new Date();
      }
    } catch {
      timestamp = new Date();
    }

    return {
      title: article.title,
      url: article.url,
      timestamp,
      source: 'GDELT',
      imageUrl: article.socialimage,
      location,
      gdeltTone: article.tone,
      themes: article.themes ? article.themes.split(';') : undefined,
    };
  }
}

export const gdeltService = new GdeltService();
export default gdeltService;
