import { Router } from 'express';
import eventsRouter from './events.js';
import heatmapRouter from './heatmap.js';
import categoriesRouter from './categories.js';
import healthRouter from './health.js';

const router = Router();

// API routes
router.use('/events', eventsRouter);
router.use('/heatmap', heatmapRouter);
router.use('/categories', categoriesRouter);
router.use('/health', healthRouter);

// Root endpoint
router.get('/', (_req, res) => {
  res.json({
    name: 'Global News Aggregator API',
    version: '1.0.0',
    endpoints: {
      events: {
        'GET /events': 'Get events with optional filters (bounds, since, categories)',
        'GET /events/:id': 'Get a specific event by ID',
      },
      heatmap: {
        'GET /heatmap': 'Get heatmap data with resolution and time range options',
        'GET /heatmap/bounds': 'Get geographic bounds of all events',
      },
      categories: {
        'GET /categories': 'Get all categories with statistics',
        'GET /categories/:category': 'Get specific category details',
      },
      health: {
        'GET /health': 'Basic health check',
        'GET /health/detailed': 'Detailed health check with data source status',
        'GET /health/ready': 'Readiness probe',
        'GET /health/live': 'Liveness probe',
      },
    },
  });
});

export default router;
