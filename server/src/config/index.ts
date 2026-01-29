import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/globenews',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    cacheTTL: 15 * 60, // 15 minutes in seconds
  },

  apis: {
    gdelt: {
      baseUrl: 'https://api.gdeltproject.org/api/v2',
      rateLimit: parseInt(process.env.GDELT_RATE_LIMIT || '10', 10), // requests per minute
    },
    newsApi: {
      baseUrl: 'https://newsapi.org/v2',
      apiKey: process.env.NEWSAPI_KEY || '',
      dailyLimit: 100,
    },
    eventRegistry: {
      baseUrl: 'https://eventregistry.org/api/v1',
      apiKey: process.env.EVENTREGISTRY_KEY || '',
    },
    nominatim: {
      baseUrl: 'https://nominatim.openstreetmap.org',
      rateLimit: 1000, // 1 request per second (1000ms between requests)
      userAgent: 'GlobalNewsAggregator/1.0',
    },
  },

  rssFeeds: [
    {
      name: 'Reuters World',
      url: 'https://feeds.reuters.com/reuters/worldNews',
    },
    {
      name: 'AP News',
      url: 'https://rsshub.app/apnews/topics/world-news',
    },
    {
      name: 'BBC World',
      url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    },
  ],

  worker: {
    pollIntervalMs: 5 * 60 * 1000, // 5 minutes
    batchSize: 100,
  },

  deduplication: {
    fuzzyThreshold: 0.7, // 70% similarity for title matching
    radiusKm: 50, // Same-day events within 50km
    timeWindowHours: 24,
  },

  intensity: {
    sourceCountWeight: 20,
    toneWeight: 10,
    recencyDecayHours: 24,
    categoryMultipliers: {
      conflict: 1.5,
      disaster: 1.4,
      politics: 1.2,
      health: 1.1,
      economics: 1.0,
      environment: 1.0,
      technology: 0.9,
    } as Record<string, number>,
  },
};

export default config;
