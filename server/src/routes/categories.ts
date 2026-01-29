import { Router, Request, Response } from 'express';
import { getCategorySummaries } from '../db/eventRepository.js';
import { EventCategory } from '../types/index.js';
import cache from '../services/cache.js';
import logger from '../utils/logger.js';

const router = Router();

// Category metadata
const CATEGORY_METADATA: Record<
  EventCategory,
  { label: string; description: string; color: string }
> = {
  conflict: {
    label: 'Conflict',
    description: 'Wars, military operations, armed conflicts, and violence',
    color: '#ef4444', // red
  },
  politics: {
    label: 'Politics',
    description: 'Elections, government activities, diplomacy, and policy',
    color: '#8b5cf6', // purple
  },
  disaster: {
    label: 'Disaster',
    description: 'Natural disasters, accidents, and emergencies',
    color: '#f97316', // orange
  },
  economics: {
    label: 'Economics',
    description: 'Markets, trade, business, and financial news',
    color: '#22c55e', // green
  },
  health: {
    label: 'Health',
    description: 'Medical news, epidemics, healthcare, and research',
    color: '#06b6d4', // cyan
  },
  technology: {
    label: 'Technology',
    description: 'Tech industry, innovations, AI, and digital developments',
    color: '#3b82f6', // blue
  },
  environment: {
    label: 'Environment',
    description: 'Climate change, conservation, and environmental issues',
    color: '#10b981', // emerald
  },
};

/**
 * GET /categories
 * Returns all categories with metadata and current statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check cache
    const cacheKey = cache.constructor.keys.categories();
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for categories`);
      return res.json(cached);
    }

    // Get statistics from database
    const summaries = await getCategorySummaries();

    // Build response with metadata
    const categories = Object.entries(CATEGORY_METADATA).map(([key, meta]) => {
      const summary = summaries.find((s) => s.category === key);

      return {
        id: key,
        ...meta,
        stats: summary
          ? {
              count: summary.count,
              avgIntensity: summary.avgIntensity,
            }
          : {
              count: 0,
              avgIntensity: 0,
            },
      };
    });

    // Sort by event count
    categories.sort((a, b) => b.stats.count - a.stats.count);

    const response = {
      categories,
      totalEvents: categories.reduce((sum, c) => sum + c.stats.count, 0),
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    await cache.set(cacheKey, response, 300); // 5 minute TTL

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /categories/:category
 * Returns metadata for a specific category
 */
router.get('/:category', async (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    const validCategories = Object.keys(CATEGORY_METADATA);
    if (!validCategories.includes(category)) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const meta = CATEGORY_METADATA[category as EventCategory];
    const summaries = await getCategorySummaries();
    const summary = summaries.find((s) => s.category === category);

    const response = {
      id: category,
      ...meta,
      stats: summary
        ? {
            count: summary.count,
            avgIntensity: summary.avgIntensity,
          }
        : {
            count: 0,
            avgIntensity: 0,
          },
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
