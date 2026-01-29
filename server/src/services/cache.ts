import Redis from 'ioredis';
import config from '../config/index.js';
import logger from '../utils/logger.js';

class CacheService {
  private client: Redis;
  private defaultTTL: number;

  constructor() {
    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 200, 2000);
      },
    });

    this.defaultTTL = config.redis.cacheTTL;

    this.client.on('error', (err) => {
      logger.error('Redis error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.warn(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const ttl = ttlSeconds ?? this.defaultTTL;
      await this.client.setex(key, ttl, serialized);
    } catch (error) {
      logger.warn(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      logger.warn(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      logger.debug(`Cache hit for key: ${key}`);
      return cached;
    }

    logger.debug(`Cache miss for key: ${key}`);
    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  // Cache key generators
  static keys = {
    events: (bounds: string, since: string, categories: string) =>
      `events:${bounds}:${since}:${categories}`,
    event: (id: string) => `event:${id}`,
    heatmap: (resolution: string, timeRange: string, categories: string) =>
      `heatmap:${resolution}:${timeRange}:${categories}`,
    categories: () => 'categories:summary',
    geocoding: (location: string) => `geocoding:${location.toLowerCase().trim()}`,
  };
}

export const cache = new CacheService();
export default cache;
