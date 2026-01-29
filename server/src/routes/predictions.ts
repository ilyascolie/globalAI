import { Router, Request, Response } from 'express';
import { polymarketService } from '../services/polymarket/index.js';
import type { PredictionFilters, PredictionCategory } from '../types/index.js';

const router = Router();

// GET /api/predictions - Get all predictions with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: PredictionFilters = {};

    // Parse probability filters
    if (req.query.minProbability) {
      filters.minProbability = parseFloat(req.query.minProbability as string);
    }
    if (req.query.maxProbability) {
      filters.maxProbability = parseFloat(req.query.maxProbability as string);
    }

    // Parse volume filter
    if (req.query.minVolume) {
      filters.minVolume = parseFloat(req.query.minVolume as string);
    }

    // Parse category filter
    if (req.query.categories) {
      filters.categories = (req.query.categories as string).split(',') as PredictionCategory[];
    }

    // Parse closing soon filter
    if (req.query.closingSoon !== undefined) {
      filters.closingSoon = req.query.closingSoon === 'true';
    }

    const predictions = await polymarketService.getPredictions(filters);
    const lastUpdated = polymarketService.getLastFetchTime();

    res.json({
      predictions,
      total: predictions.length,
      lastUpdated: lastUpdated || new Date(),
    });
  } catch (error) {
    console.error('Error fetching predictions:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// GET /api/predictions/:marketId - Get single prediction
router.get('/:marketId', async (req: Request, res: Response) => {
  try {
    const prediction = await polymarketService.getPredictionById(req.params.marketId);

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    res.json(prediction);
  } catch (error) {
    console.error('Error fetching prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// POST /api/predictions/refresh - Force refresh cache
router.post('/refresh', async (_req: Request, res: Response) => {
  try {
    await polymarketService.refresh();
    res.json({ success: true, message: 'Cache refreshed' });
  } catch (error) {
    console.error('Error refreshing predictions:', error);
    res.status(500).json({ error: 'Failed to refresh predictions' });
  }
});

export default router;
