import { Router, Request, Response } from 'express';
import { healthCheck as dbHealthCheck } from '../db/index.js';
import cache from '../services/cache.js';
import { newsAggregatorService } from '../services/aggregator/index.js';
import { workerManager } from '../workers/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await dbHealthCheck();
    const redisHealthy = await cache.healthCheck();

    const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        redis: redisHealthy ? 'ok' : 'error',
      },
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /health/detailed
 * Detailed health check with source status
 */
router.get('/detailed', async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await dbHealthCheck();
    const redisHealthy = await cache.healthCheck();
    const sourcesStatus = await newsAggregatorService.getSourcesStatus();
    const workerStatus = workerManager.getStatus();

    const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      checks: {
        database: dbHealthy ? 'ok' : 'error',
        redis: redisHealthy ? 'ok' : 'error',
      },
      worker: workerStatus,
      dataSources: sourcesStatus,
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes/container orchestration
 */
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    const dbHealthy = await dbHealthCheck();

    if (dbHealthy) {
      res.status(200).json({ ready: true });
    } else {
      res.status(503).json({ ready: false, reason: 'Database not available' });
    }
  } catch (error) {
    res.status(503).json({ ready: false, reason: 'Readiness check failed' });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes/container orchestration
 */
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

export default router;
