import { Router, Request, Response } from 'express';
import { getEvents, getEventById, getHeatmapData, getCategorySummaries } from '../db/eventRepository.js';
import { EventsQuery, HeatmapQuery, BoundingBox, EventCategory } from '../types/index.js';
import cache from '../services/cache.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /events
 * Query parameters:
 *   bounds: lat1,lng1,lat2,lng2 (bounding box)
 *   since: ISO8601 timestamp
 *   categories: comma-separated list
 *   limit: number (default 100)
 *   offset: number (default 0)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query: EventsQuery = {};

    // Parse bounds parameter
    if (req.query.bounds) {
      const boundsStr = req.query.bounds as string;
      const parts = boundsStr.split(',').map(Number);

      if (parts.length === 4 && parts.every((n) => !isNaN(n))) {
        query.bounds = {
          lat1: parts[0],
          lng1: parts[1],
          lat2: parts[2],
          lng2: parts[3],
        } as BoundingBox;
      } else {
        return res.status(400).json({
          error: 'Invalid bounds format. Expected: lat1,lng1,lat2,lng2',
        });
      }
    }

    // Parse since parameter
    if (req.query.since) {
      const since = new Date(req.query.since as string);
      if (isNaN(since.getTime())) {
        return res.status(400).json({
          error: 'Invalid since format. Expected ISO8601 timestamp',
        });
      }
      query.since = since;
    }

    // Parse categories parameter
    if (req.query.categories) {
      const categoriesStr = req.query.categories as string;
      const validCategories: EventCategory[] = [
        'conflict',
        'politics',
        'disaster',
        'economics',
        'health',
        'technology',
        'environment',
      ];

      const categories = categoriesStr.split(',').filter((c) =>
        validCategories.includes(c as EventCategory)
      ) as EventCategory[];

      if (categories.length > 0) {
        query.categories = categories;
      }
    }

    // Parse pagination parameters
    query.limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    query.offset = parseInt(req.query.offset as string) || 0;

    // Generate cache key
    const cacheKey = cache.constructor.keys.events(
      query.bounds ? `${query.bounds.lat1},${query.bounds.lng1},${query.bounds.lat2},${query.bounds.lng2}` : 'all',
      query.since ? query.since.toISOString() : 'none',
      query.categories ? query.categories.join(',') : 'all'
    );

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for events query`);
      return res.json(cached);
    }

    // Fetch from database
    const events = await getEvents(query);

    // Cache result
    await cache.set(cacheKey, events);

    res.json(events);
  } catch (error) {
    logger.error('Failed to fetch events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /events/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid event ID format' });
    }

    // Check cache
    const cacheKey = cache.constructor.keys.event(id);
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Fetch from database
    const event = await getEventById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Cache result
    await cache.set(cacheKey, event, 300); // 5 minute TTL for individual events

    res.json(event);
  } catch (error) {
    logger.error('Failed to fetch event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
