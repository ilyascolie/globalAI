import { query, transaction } from './index.js';
import { NewsEvent, EventsQuery, HeatmapPoint, CategorySummary, EventCategory } from '../types/index.js';
import logger from '../utils/logger.js';

interface EventRow {
  id: string;
  title: string;
  summary: string | null;
  lat: number;
  lng: number;
  timestamp: Date;
  source: string;
  category: EventCategory;
  intensity: number;
  url: string;
  image_url: string | null;
  gdelt_tone: number | null;
  source_count: number | null;
  entities: string[] | null;
  related_event_ids: string[] | null;
}

function mapRowToEvent(row: EventRow): NewsEvent {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || '',
    lat: row.lat,
    lng: row.lng,
    timestamp: new Date(row.timestamp),
    source: row.source,
    category: row.category,
    intensity: row.intensity,
    url: row.url,
    imageUrl: row.image_url || undefined,
    gdeltTone: row.gdelt_tone || undefined,
    sourceCount: row.source_count || undefined,
    entities: row.entities || undefined,
    relatedEventIds: row.related_event_ids || undefined,
  };
}

export async function insertEvent(event: NewsEvent): Promise<void> {
  const sql = `
    INSERT INTO events (
      id, title, summary, location, lat, lng, timestamp, source,
      category, intensity, url, image_url, gdelt_tone, source_count, entities, related_event_ids
    ) VALUES (
      $1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326), $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      intensity = EXCLUDED.intensity,
      source_count = EXCLUDED.source_count,
      updated_at = NOW()
  `;

  await query(sql, [
    event.id,
    event.title,
    event.summary,
    event.lat,
    event.lng,
    event.timestamp,
    event.source,
    event.category,
    event.intensity,
    event.url,
    event.imageUrl || null,
    event.gdeltTone || null,
    event.sourceCount || 1,
    event.entities || null,
    event.relatedEventIds || null,
  ]);
}

export async function insertEvents(events: NewsEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  let inserted = 0;

  await transaction(async (client) => {
    for (const event of events) {
      try {
        await client.query(
          `
          INSERT INTO events (
            id, title, summary, location, lat, lng, timestamp, source,
            category, intensity, url, image_url, gdelt_tone, source_count, entities, related_event_ids
          ) VALUES (
            $1, $2, $3, ST_SetSRID(ST_MakePoint($5, $4), 4326), $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14, $15
          )
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            intensity = GREATEST(events.intensity, EXCLUDED.intensity),
            source_count = events.source_count + 1,
            updated_at = NOW()
          `,
          [
            event.id,
            event.title,
            event.summary,
            event.lat,
            event.lng,
            event.timestamp,
            event.source,
            event.category,
            event.intensity,
            event.url,
            event.imageUrl || null,
            event.gdeltTone || null,
            event.sourceCount || 1,
            event.entities || null,
            event.relatedEventIds || null,
          ]
        );
        inserted++;
      } catch (error) {
        logger.warn(`Failed to insert event ${event.id}: ${error}`);
      }
    }
  });

  return inserted;
}

export async function getEvents(queryParams: EventsQuery): Promise<NewsEvent[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (queryParams.bounds) {
    const { lat1, lng1, lat2, lng2 } = queryParams.bounds;
    conditions.push(`
      ST_Intersects(
        location,
        ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)
      )
    `);
    params.push(lng1, lat1, lng2, lat2);
    paramIndex += 4;
  }

  if (queryParams.since) {
    conditions.push(`timestamp >= $${paramIndex}`);
    params.push(queryParams.since);
    paramIndex++;
  }

  if (queryParams.categories && queryParams.categories.length > 0) {
    conditions.push(`category = ANY($${paramIndex})`);
    params.push(queryParams.categories);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = queryParams.limit || 100;
  const offset = queryParams.offset || 0;

  const sql = `
    SELECT
      id, title, summary, lat, lng, timestamp, source, category,
      intensity, url, image_url, gdelt_tone, source_count, entities, related_event_ids
    FROM events
    ${whereClause}
    ORDER BY timestamp DESC, intensity DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await query<EventRow>(sql, params);
  return result.rows.map(mapRowToEvent);
}

export async function getEventById(id: string): Promise<NewsEvent | null> {
  const sql = `
    SELECT
      id, title, summary, lat, lng, timestamp, source, category,
      intensity, url, image_url, gdelt_tone, source_count, entities, related_event_ids
    FROM events
    WHERE id = $1
  `;

  const result = await query<EventRow>(sql, [id]);
  return result.rows.length > 0 ? mapRowToEvent(result.rows[0]) : null;
}

export async function getHeatmapData(
  resolution: 'low' | 'medium' | 'high',
  timeRange?: '1h' | '6h' | '24h' | '7d',
  categories?: EventCategory[]
): Promise<HeatmapPoint[]> {
  // Grid cell size based on resolution
  const gridSize = resolution === 'low' ? 5 : resolution === 'medium' ? 2 : 1;

  const conditions: string[] = [];
  const params: unknown[] = [gridSize];
  let paramIndex = 2;

  // Time range filter
  if (timeRange) {
    const intervals: Record<string, string> = {
      '1h': '1 hour',
      '6h': '6 hours',
      '24h': '24 hours',
      '7d': '7 days',
    };
    conditions.push(`timestamp >= NOW() - INTERVAL '${intervals[timeRange]}'`);
  }

  if (categories && categories.length > 0) {
    conditions.push(`category = ANY($${paramIndex})`);
    params.push(categories);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      ROUND(lat / $1) * $1 as lat,
      ROUND(lng / $1) * $1 as lng,
      AVG(intensity)::INTEGER as intensity,
      COUNT(*)::INTEGER as event_count,
      MODE() WITHIN GROUP (ORDER BY category) as dominant_category
    FROM events
    ${whereClause}
    GROUP BY ROUND(lat / $1) * $1, ROUND(lng / $1) * $1
    ORDER BY intensity DESC
  `;

  interface HeatmapRow {
    lat: number;
    lng: number;
    intensity: number;
    event_count: number;
    dominant_category: EventCategory;
  }

  const result = await query<HeatmapRow>(sql, params);

  return result.rows.map((row) => ({
    lat: row.lat,
    lng: row.lng,
    intensity: row.intensity,
    eventCount: row.event_count,
    dominantCategory: row.dominant_category,
  }));
}

export async function getCategorySummaries(): Promise<CategorySummary[]> {
  const sql = `
    SELECT
      category,
      COUNT(*)::INTEGER as count,
      ROUND(AVG(intensity))::INTEGER as avg_intensity
    FROM events
    WHERE timestamp >= NOW() - INTERVAL '24 hours'
    GROUP BY category
    ORDER BY count DESC
  `;

  interface CategoryRow {
    category: EventCategory;
    count: number;
    avg_intensity: number;
  }

  const result = await query<CategoryRow>(sql);

  return result.rows.map((row) => ({
    category: row.category,
    count: row.count,
    avgIntensity: row.avg_intensity,
  }));
}

export async function findSimilarEvents(
  title: string,
  lat: number,
  lng: number,
  timestamp: Date,
  radiusKm: number = 50,
  hoursWindow: number = 24
): Promise<NewsEvent[]> {
  const sql = `
    SELECT
      id, title, summary, lat, lng, timestamp, source, category,
      intensity, url, image_url, gdelt_tone, source_count, entities, related_event_ids,
      similarity(title, $1) as title_similarity
    FROM events
    WHERE
      ST_DWithin(
        location,
        ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
        $4 * 1000
      )
      AND timestamp BETWEEN $5 - INTERVAL '${hoursWindow} hours' AND $5 + INTERVAL '${hoursWindow} hours'
      AND similarity(title, $1) > 0.3
    ORDER BY title_similarity DESC
    LIMIT 10
  `;

  const result = await query<EventRow & { title_similarity: number }>(sql, [
    title,
    lat,
    lng,
    radiusKm,
    timestamp,
  ]);

  return result.rows.map(mapRowToEvent);
}

export async function deleteOldEvents(daysOld: number = 30): Promise<number> {
  const sql = `
    DELETE FROM events
    WHERE timestamp < NOW() - INTERVAL '${daysOld} days'
    RETURNING id
  `;

  const result = await query(sql);
  return result.rowCount || 0;
}

export default {
  insertEvent,
  insertEvents,
  getEvents,
  getEventById,
  getHeatmapData,
  getCategorySummaries,
  findSimilarEvents,
  deleteOldEvents,
};
