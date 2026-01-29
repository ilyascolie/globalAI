import { Router, Request, Response } from 'express';
import { aggregatorService } from '../services/aggregator/index.js';

const router = Router();

// GET /api/heatmap - Get heatmap data
router.get('/', async (req: Request, res: Response) => {
  try {
    const resolution = (req.query.resolution as 'low' | 'medium' | 'high') || 'medium';
    const points = await aggregatorService.getHeatmap(resolution);

    const maxIntensity = points.reduce((max, p) => Math.max(max, p.intensity), 0);

    res.json({
      points,
      maxIntensity,
      timeRange: req.query.timeRange || '24h',
    });
  } catch (error) {
    console.error('Error fetching heatmap:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
});

export default router;
