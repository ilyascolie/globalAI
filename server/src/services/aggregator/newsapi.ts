import axios, { AxiosInstance } from 'axios';
import { RawNewsItem, DataSource } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import cache from '../cache.js';

interface NewsApiArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

export class NewsApiService implements DataSource {
  name = 'NewsAPI';
  private client: AxiosInstance;
  private dailyRequestCount = 0;
  private lastResetDate: string;

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.newsApi.baseUrl,
      timeout: 15000,
      headers: {
        'X-Api-Key': config.apis.newsApi.apiKey,
      },
    });

    this.lastResetDate = new Date().toISOString().split('T')[0];
  }

  private checkDailyLimit(): boolean {
    const today = new Date().toISOString().split('T')[0];

    // Reset counter if it's a new day
    if (today !== this.lastResetDate) {
      this.dailyRequestCount = 0;
      this.lastResetDate = today;
    }

    return this.dailyRequestCount < config.apis.newsApi.dailyLimit;
  }

  async isAvailable(): Promise<boolean> {
    if (!config.apis.newsApi.apiKey) {
      logger.warn('NewsAPI key not configured');
      return false;
    }
    return this.checkDailyLimit();
  }

  async fetch(): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      logger.warn('NewsAPI not available (no API key or daily limit reached)');
      return [];
    }

    logger.info('Fetching news from NewsAPI...');

    try {
      // Check cache first
      const cacheKey = `newsapi:headlines:${new Date().toISOString().split('T')[0]}`;
      const cached = await cache.get<RawNewsItem[]>(cacheKey);
      if (cached) {
        logger.debug('Returning cached NewsAPI results');
        return cached;
      }

      this.dailyRequestCount++;

      const response = await withRetry(
        () =>
          this.client.get<NewsApiResponse>('/top-headlines', {
            params: {
              language: 'en',
              pageSize: 100,
            },
          }),
        'NewsAPI fetch'
      );

      if (response.data.status !== 'ok') {
        logger.error('NewsAPI returned error status');
        return [];
      }

      const articles = response.data.articles || [];
      logger.info(`NewsAPI returned ${articles.length} articles`);

      const items = articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));

      // Cache for 30 minutes to conserve API quota
      await cache.set(cacheKey, items, 1800);

      return items;
    } catch (error) {
      logger.error('Failed to fetch from NewsAPI:', error);
      return [];
    }
  }

  async fetchByCategory(category: string): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      const cacheKey = `newsapi:category:${category}:${new Date().toISOString().split('T')[0]}`;
      const cached = await cache.get<RawNewsItem[]>(cacheKey);
      if (cached) {
        return cached;
      }

      this.dailyRequestCount++;

      const response = await withRetry(
        () =>
          this.client.get<NewsApiResponse>('/top-headlines', {
            params: {
              category,
              language: 'en',
              pageSize: 50,
            },
          }),
        `NewsAPI fetch category: ${category}`
      );

      if (response.data.status !== 'ok') {
        return [];
      }

      const articles = response.data.articles || [];
      const items = articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));

      await cache.set(cacheKey, items, 1800);

      return items;
    } catch (error) {
      logger.error(`Failed to fetch category ${category} from NewsAPI:`, error);
      return [];
    }
  }

  async fetchByQuery(query: string): Promise<RawNewsItem[]> {
    if (!await this.isAvailable()) {
      return [];
    }

    try {
      this.dailyRequestCount++;

      const response = await withRetry(
        () =>
          this.client.get<NewsApiResponse>('/everything', {
            params: {
              q: query,
              language: 'en',
              sortBy: 'publishedAt',
              pageSize: 50,
            },
          }),
        `NewsAPI fetch query: ${query}`
      );

      if (response.data.status !== 'ok') {
        return [];
      }

      const articles = response.data.articles || [];
      return articles
        .filter((article) => article.title && article.url)
        .map((article) => this.mapArticleToNewsItem(article));
    } catch (error) {
      logger.error(`Failed to fetch query from NewsAPI:`, error);
      return [];
    }
  }

  private mapArticleToNewsItem(article: NewsApiArticle): RawNewsItem {
    return {
      title: article.title,
      summary: article.description || undefined,
      url: article.url,
      timestamp: new Date(article.publishedAt),
      source: 'NewsAPI',
      imageUrl: article.urlToImage || undefined,
      // NewsAPI doesn't provide location data, will need geocoding
    };
  }

  getRemainingRequests(): number {
    this.checkDailyLimit(); // Ensure counter is current
    return Math.max(0, config.apis.newsApi.dailyLimit - this.dailyRequestCount);
  }
}

export const newsApiService = new NewsApiService();
export default newsApiService;
