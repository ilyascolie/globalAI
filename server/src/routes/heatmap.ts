import { Router, Request, Response } from 'express';
import { getHeatmapData } from '../db/eventRepository.js';
import { HeatmapQuery, EventCategory } from '../types/index.js';
import cache from '../services/cache.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /heatmap
 * Query parameters:
 *   resolution: low | medium | high (default: medium)
 *   timeRange: 1h | 6h | 24h | 7d (default: 24h)
 *   categories: comma-separated list
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Parse resolution
    const resolutionParam = req.query.resolution as string;
    const validResolutions = ['low', 'medium', 'high'] as const;
    const resolution: 'low' | 'medium' | 'high' = validResolutions.includes(
      resolutionParam as 'low' | 'medium' | 'high'
    )
      ? (resolutionParam as 'low' | 'medium' | 'high')
      : 'medium';

    // Parse time range
    const timeRangeParam = req.query.timeRange as string;
    const validTimeRanges = ['1h', '6h', '24h', '7d'] as const;
    const timeRange: '1h' | '6h' | '24h' | '7d' | undefined = validTimeRanges.includes(
      timeRangeParam as '1h' | '6h' | '24h' | '7d'
    )
      ? (timeRangeParam as '1h' | '6h' | '24h' | '7d')
      : '24h';

    // Parse categories
    let categories: EventCategory[] | undefined;
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

      categories = categoriesStr
        .split(',')
        .filter((c) => validCategories.includes(c as EventCategory)) as EventCategory[];

      if (categories.length === 0) {
        categories = undefined;
      }
    }

    // Generate cache key
    const cacheKey = cache.constructor.keys.heatmap(
      resolution,
      timeRange,
      categories ? categories.join(',') : 'all'
    );

    // Check cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for heatmap query`);
      return res.json(cached);
    }

    // Fetch from database
    const heatmapData = await getHeatmapData(resolution, timeRange, categories);

    // Add metadata to response
    const response = {
      resolution,
      timeRange,
      categories: categories || 'all',
      generatedAt: new Date().toISOString(),
      pointCount: heatmapData.length,
      points: heatmapData,
    };

    // Cache result
    await cache.set(cacheKey, response);

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch heatmap:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /heatmap/bounds
 * Returns the geographic bounds of all events
 */
router.get('/bounds', async (req: Request, res: Response) => {
  try {
    // This could be computed from the database, but for now return world bounds
    const bounds = {
      minLat: -90,
      maxLat: 90,
      minLng: -180,
      maxLng: 180,
    };

    res.json(bounds);
  } catch (error) {
    logger.error('Failed to fetch bounds:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
