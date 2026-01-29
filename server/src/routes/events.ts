import { Router, Request, Response } from 'express';
import { aggregatorService } from '../services/aggregator/index.js';
import type { EventFilters, EventCategory } from '../types/index.js';

const router = Router();

// GET /api/events - Get all events with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: EventFilters = {};

    // Parse category filter
    if (req.query.categories) {
      filters.categories = (req.query.categories as string).split(',') as EventCategory[];
    }

    // Parse since filter
    if (req.query.since) {
      filters.since = new Date(req.query.since as string);
    }

    // Parse bounds filter
    if (req.query.bounds) {
      const [lat1, lng1, lat2, lng2] = (req.query.bounds as string).split(',').map(Number);
      filters.bounds = {
        south: Math.min(lat1, lat2),
        north: Math.max(lat1, lat2),
        west: Math.min(lng1, lng2),
        east: Math.max(lng1, lng2),
      };
    }

    const events = await aggregatorService.getEvents(filters);
    const limit = parseInt(req.query.limit as string) || 100;

    res.json({
      events: events.slice(0, limit),
      total: events.length,
      hasMore: events.length > limit,
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id - Get single event
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const events = await aggregatorService.getEvents();
    const event = events.find((e) => e.id === req.params.id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

export default router;
