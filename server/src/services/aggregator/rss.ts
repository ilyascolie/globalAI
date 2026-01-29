import Parser from 'rss-parser';
import { RawNewsItem, DataSource } from '../../types/index.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import { withRetry } from '../../utils/retry.js';
import cache from '../cache.js';

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  'content:encoded'?: string;
  'media:content'?: { $: { url: string } };
  enclosure?: { url: string };
  'media:thumbnail'?: { $: { url: string } };
  categories?: string[];
  creator?: string;
}

interface RssFeed {
  items: RssItem[];
  title?: string;
  description?: string;
  link?: string;
}

export class RssService implements DataSource {
  name = 'RSS';
  private parser: Parser<RssFeed, RssItem>;

  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['media:content', 'media:content'],
          ['media:thumbnail', 'media:thumbnail'],
          ['content:encoded', 'content:encoded'],
        ],
      },
      timeout: 15000,
    });
  }

  async isAvailable(): Promise<boolean> {
    return true; // RSS feeds are always available
  }

  async fetch(): Promise<RawNewsItem[]> {
    logger.info('Fetching news from RSS feeds...');

    const allItems: RawNewsItem[] = [];

    // Fetch all feeds in parallel
    const feedPromises = config.rssFeeds.map((feed) =>
      this.fetchFeed(feed.url, feed.name)
    );

    const results = await Promise.allSettled(feedPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value);
      }
    }

    logger.info(`RSS feeds returned ${allItems.length} total items`);
    return allItems;
  }

  async fetchFeed(url: string, feedName: string): Promise<RawNewsItem[]> {
    try {
      // Check cache first
      const cacheKey = `rss:${feedName.toLowerCase().replace(/\s+/g, '_')}`;
      const cached = await cache.get<RawNewsItem[]>(cacheKey);
      if (cached) {
        logger.debug(`Returning cached RSS results for ${feedName}`);
        return cached;
      }

      const feed = await withRetry(
        () => this.parser.parseURL(url),
        `RSS fetch: ${feedName}`,
        { maxRetries: 2 }
      );

      const items = (feed.items || [])
        .filter((item) => item.title && item.link)
        .map((item) => this.mapItemToNewsItem(item, feedName));

      logger.info(`${feedName} RSS returned ${items.length} items`);

      // Cache for 10 minutes
      await cache.set(cacheKey, items, 600);

      return items;
    } catch (error) {
      logger.error(`Failed to fetch RSS feed ${feedName}:`, error);
      return [];
    }
  }

  private mapItemToNewsItem(item: RssItem, feedName: string): RawNewsItem {
    // Try to extract image from various RSS formats
    let imageUrl: string | undefined;

    if (item['media:content']?.$.url) {
      imageUrl = item['media:content'].$.url;
    } else if (item['media:thumbnail']?.$.url) {
      imageUrl = item['media:thumbnail'].$.url;
    } else if (item.enclosure?.url) {
      imageUrl = item.enclosure.url;
    }

    // Extract summary from various content fields
    let summary: string | undefined;

    if (item.contentSnippet) {
      summary = item.contentSnippet;
    } else if (item.content) {
      // Strip HTML tags
      summary = item.content.replace(/<[^>]*>/g, '').trim();
    } else if (item['content:encoded']) {
      summary = item['content:encoded'].replace(/<[^>]*>/g, '').trim();
    }

    // Truncate summary if too long
    if (summary && summary.length > 500) {
      summary = summary.substring(0, 497) + '...';
    }

    return {
      title: item.title || '',
      summary,
      url: item.link || '',
      timestamp: item.pubDate ? new Date(item.pubDate) : new Date(),
      source: feedName,
      imageUrl,
      themes: item.categories,
      // RSS feeds don't have location data, will need geocoding
    };
  }

  // Add a custom feed
  async addFeed(url: string, name: string): Promise<boolean> {
    try {
      // Test if feed is valid
      await this.parser.parseURL(url);
      config.rssFeeds.push({ name, url });
      return true;
    } catch {
      return false;
    }
  }
}

export const rssService = new RssService();
export default rssService;
