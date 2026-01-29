# Global News Aggregator Backend

A Node.js/Express backend that aggregates global news with geographic data from multiple sources, providing a unified API for real-time news visualization.

## Features

- **Multi-source News Aggregation**: GDELT, NewsAPI, EventRegistry, and RSS feeds
- **Geographic Data**: PostGIS-powered geospatial queries with location extraction
- **Event Deduplication**: Fuzzy title matching using fuzzball library
- **Category Classification**: Automatic categorization (conflict, politics, disaster, etc.)
- **Intensity Scoring**: Algorithm based on source count, sentiment, and keywords
- **Geocoding Fallback**: OpenStreetMap Nominatim for events missing coordinates
- **Caching**: Redis with 15-minute TTL for aggregated data
- **Background Worker**: Polls sources every 5 minutes

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 16 with PostGIS extension
- **Cache**: Redis 7
- **Container**: Docker & Docker Compose

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Clone and navigate to project
cd globalAI

# Copy environment file
cp server/.env.example server/.env

# Edit .env with your API keys (optional for basic functionality)
# GDELT works without any API key

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec api node dist/db/migrate.js

# (Optional) Seed sample data
docker-compose exec api node dist/db/seed.js
```

### Local Development

```bash
# Prerequisites: PostgreSQL with PostGIS, Redis

# Navigate to server directory
cd server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration

# Run database migrations
npm run db:migrate

# (Optional) Seed sample data
npm run db:seed

# Start development server
npm run dev
```

## API Endpoints

### Events

```
GET /api/events
  Query Parameters:
    - bounds: lat1,lng1,lat2,lng2 (bounding box filter)
    - since: ISO8601 timestamp (time filter)
    - categories: comma-separated list (conflict,politics,disaster,etc.)
    - limit: number (default: 100, max: 500)
    - offset: number (default: 0)

GET /api/events/:id
  Returns a single event by UUID
```

### Heatmap

```
GET /api/heatmap
  Query Parameters:
    - resolution: low|medium|high (default: medium)
    - timeRange: 1h|6h|24h|7d (default: 24h)
    - categories: comma-separated list
```

### Categories

```
GET /api/categories
  Returns all categories with statistics

GET /api/categories/:category
  Returns specific category details
```

### Health

```
GET /api/health          # Basic health check
GET /api/health/detailed # Detailed status with data sources
GET /api/health/ready    # Kubernetes readiness probe
GET /api/health/live     # Kubernetes liveness probe
```

## Data Sources

| Source | Type | Rate Limit | Notes |
|--------|------|------------|-------|
| GDELT | API | ~10 req/min | Primary source, includes lat/lng |
| NewsAPI | API | 100 req/day | Requires API key |
| EventRegistry | API | 2000 tokens/month | Requires API key |
| RSS Feeds | Feed | None | Reuters, AP, BBC fallback |

## Event Schema

```typescript
interface NewsEvent {
  id: string;           // UUID
  title: string;
  summary: string;
  lat: number;
  lng: number;
  timestamp: Date;
  source: string;
  category: EventCategory;
  intensity: number;    // 0-100
  url: string;
  imageUrl?: string;
  gdeltTone?: number;   // GDELT sentiment score
  sourceCount?: number;
}

type EventCategory =
  | 'conflict'
  | 'politics'
  | 'disaster'
  | 'economics'
  | 'health'
  | 'technology'
  | 'environment';
```

## Intensity Scoring Algorithm

```
intensity = (
  sourceCount * 20 +           // More sources = bigger story
  abs(gdeltTone) * 10 +        // Strong sentiment = more significant
  keywordScore +               // High-impact keywords
  recencyBonus                 // Decay over 24h
) * categoryMultiplier         // Conflicts weighted higher
```

Normalized to 0-100 scale.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `REDIS_URL` | Yes | - | Redis connection string |
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment mode |
| `NEWSAPI_KEY` | No | - | NewsAPI.org API key |
| `EVENTREGISTRY_KEY` | No | - | EventRegistry API key |
| `GDELT_RATE_LIMIT` | No | 10 | GDELT requests per minute |
| `ENABLE_WORKER` | No | false | Enable background polling |

## Project Structure

```
server/
├── src/
│   ├── config/         # Configuration management
│   ├── db/             # Database setup and repositories
│   ├── middleware/     # Express middleware (rate limiting)
│   ├── routes/         # API route handlers
│   ├── services/
│   │   ├── aggregator/ # News source integrations
│   │   ├── dedup/      # Deduplication service
│   │   └── geocoder/   # Nominatim geocoding
│   ├── types/          # TypeScript interfaces
│   ├── utils/          # Utilities (logger, retry logic)
│   ├── workers/        # Background job processing
│   └── index.ts        # Application entry point
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Development

```bash
# Run tests
npm test

# Build for production
npm run build

# Run migrations
npm run db:migrate

# Run worker separately
npm run worker
```

## License

MIT
