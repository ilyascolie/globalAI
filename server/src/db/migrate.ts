import { pool, query } from './index.js';
import logger from '../utils/logger.js';

const migrations = [
  {
    name: '001_enable_postgis',
    up: `
      CREATE EXTENSION IF NOT EXISTS postgis;
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
    `,
  },
  {
    name: '002_create_events_table',
    up: `
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT,
        location GEOGRAPHY(POINT, 4326) NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL,
        source VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        intensity SMALLINT NOT NULL DEFAULT 0,
        url TEXT NOT NULL,
        image_url TEXT,
        gdelt_tone REAL,
        source_count INTEGER DEFAULT 1,
        entities TEXT[],
        related_event_ids UUID[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_events_location ON events USING GIST(location);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
      CREATE INDEX IF NOT EXISTS idx_events_intensity ON events(intensity DESC);
      CREATE INDEX IF NOT EXISTS idx_events_title_trgm ON events USING GIN(title gin_trgm_ops);
    `,
  },
  {
    name: '003_create_geocoding_cache',
    up: `
      CREATE TABLE IF NOT EXISTS geocoding_cache (
        location_name VARCHAR(500) PRIMARY KEY,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        display_name TEXT,
        confidence REAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_geocoding_cache_name ON geocoding_cache(location_name);
    `,
  },
  {
    name: '004_create_source_tracking',
    up: `
      CREATE TABLE IF NOT EXISTS source_requests (
        id SERIAL PRIMARY KEY,
        source_name VARCHAR(100) NOT NULL,
        request_count INTEGER DEFAULT 0,
        last_request_at TIMESTAMPTZ,
        daily_limit INTEGER,
        reset_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_source_requests_name ON source_requests(source_name);
    `,
  },
  {
    name: '005_create_event_sources_junction',
    up: `
      CREATE TABLE IF NOT EXISTS event_sources (
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        source_name VARCHAR(255) NOT NULL,
        source_url TEXT NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (event_id, source_url)
      );
    `,
  },
  {
    name: '006_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations...');

  // Ensure migrations table exists first
  await query(`
    CREATE TABLE IF NOT EXISTS migrations (
      name VARCHAR(255) PRIMARY KEY,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  for (const migration of migrations) {
    try {
      // Check if migration has already been run
      const result = await query<{ name: string }>(
        'SELECT name FROM migrations WHERE name = $1',
        [migration.name]
      );

      if (result.rows.length > 0) {
        logger.debug(`Migration ${migration.name} already executed, skipping...`);
        continue;
      }

      logger.info(`Running migration: ${migration.name}`);
      await query(migration.up);

      // Record migration
      await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      logger.info(`Migration ${migration.name} completed successfully`);
    } catch (error) {
      logger.error(`Migration ${migration.name} failed:`, error);
      throw error;
    }
  }

  logger.info('All migrations completed successfully');
}

// Run if called directly
runMigrations()
  .then(() => {
    logger.info('Migration process finished');
    pool.end();
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration process failed:', error);
    pool.end();
    process.exit(1);
  });

export default runMigrations;
