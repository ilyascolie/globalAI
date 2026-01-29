import cron from 'node-cron';
import { newsAggregatorService } from '../services/aggregator/index.js';
import { geocodingService } from '../services/geocoder/nominatim.js';
import { deleteOldEvents } from '../db/eventRepository.js';
import { pool } from '../db/index.js';
import cache from '../services/cache.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

class WorkerManager {
  private isRunning = false;
  private aggregationTask: cron.ScheduledTask | null = null;
  private cleanupTask: cron.ScheduledTask | null = null;
  private healthCheckTask: cron.ScheduledTask | null = null;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker manager is already running');
      return;
    }

    logger.info('Starting worker manager...');
    this.isRunning = true;

    // Run initial aggregation
    await this.runAggregation();

    // Warm up geocoding cache
    await geocodingService.warmupCache().catch((err) => {
      logger.warn('Geocoding cache warmup failed:', err);
    });

    // Schedule periodic aggregation (every 5 minutes)
    this.aggregationTask = cron.schedule('*/5 * * * *', async () => {
      await this.runAggregation();
    });

    // Schedule daily cleanup (at 3 AM)
    this.cleanupTask = cron.schedule('0 3 * * *', async () => {
      await this.runCleanup();
    });

    // Schedule health check (every minute)
    this.healthCheckTask = cron.schedule('* * * * *', async () => {
      await this.runHealthCheck();
    });

    logger.info('Worker manager started successfully');
    logger.info(`Aggregation scheduled to run every 5 minutes`);
    logger.info(`Cleanup scheduled to run daily at 3 AM`);
  }

  async stop(): Promise<void> {
    logger.info('Stopping worker manager...');

    if (this.aggregationTask) {
      this.aggregationTask.stop();
      this.aggregationTask = null;
    }

    if (this.cleanupTask) {
      this.cleanupTask.stop();
      this.cleanupTask = null;
    }

    if (this.healthCheckTask) {
      this.healthCheckTask.stop();
      this.healthCheckTask = null;
    }

    this.isRunning = false;
    logger.info('Worker manager stopped');
  }

  private async runAggregation(): Promise<void> {
    const startTime = Date.now();
    logger.info('Running scheduled news aggregation...');

    try {
      const events = await newsAggregatorService.aggregateNews();
      const duration = Date.now() - startTime;

      logger.info(
        `Aggregation completed: ${events.length} events processed in ${duration}ms`
      );
    } catch (error) {
      logger.error('Aggregation failed:', error);
    }
  }

  private async runCleanup(): Promise<void> {
    logger.info('Running scheduled cleanup...');

    try {
      // Delete events older than 30 days
      const deletedCount = await deleteOldEvents(30);
      logger.info(`Cleanup completed: ${deletedCount} old events deleted`);

      // Clear old cache entries
      await cache.deletePattern('events:*');
      await cache.deletePattern('heatmap:*');
      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }

  private async runHealthCheck(): Promise<void> {
    try {
      // Check database connectivity
      await pool.query('SELECT 1');

      // Check Redis connectivity
      const redisHealthy = await cache.healthCheck();

      if (!redisHealthy) {
        logger.warn('Redis health check failed');
      }
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  }

  // Manual trigger for aggregation
  async triggerAggregation(): Promise<void> {
    await this.runAggregation();
  }

  // Manual trigger for cleanup
  async triggerCleanup(): Promise<void> {
    await this.runCleanup();
  }

  getStatus(): { running: boolean; nextAggregation?: Date } {
    return {
      running: this.isRunning,
    };
  }
}

export const workerManager = new WorkerManager();

// Run as standalone worker process
if (process.argv[1]?.includes('workers/index')) {
  logger.info('Starting worker process...');

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await workerManager.stop();
    await pool.end();
    await cache.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await workerManager.stop();
    await pool.end();
    await cache.close();
    process.exit(0);
  });

  workerManager.start().catch((error) => {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  });
}

export default workerManager;
