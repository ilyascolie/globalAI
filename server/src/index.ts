import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { apiLimiter, healthLimiter } from './middleware/rateLimit.js';
import { pool } from './db/index.js';
import cache from './services/cache.js';
import { workerManager } from './workers/index.js';
import config from './config/index.js';
import logger from './utils/logger.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Rate limiting
app.use('/api/health', healthLimiter);
app.use('/api', apiLimiter);

// API routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Stop background worker
  await workerManager.stop();

  // Close database pool
  await pool.end();
  logger.info('Database pool closed');

  // Close Redis connection
  await cache.close();
  logger.info('Redis connection closed');

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`Server running on port ${config.server.port}`);
  logger.info(`Environment: ${config.server.nodeEnv}`);

  // Start background worker if in production or explicitly enabled
  if (config.server.nodeEnv === 'production' || process.env.ENABLE_WORKER === 'true') {
    workerManager.start().catch((error) => {
      logger.error('Failed to start worker:', error);
    });
  } else {
    logger.info('Background worker disabled in development. Set ENABLE_WORKER=true to enable.');
  }
});

export default app;
