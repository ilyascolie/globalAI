import express from 'express';
import cors from 'cors';
import eventsRouter from './routes/events.js';
import heatmapRouter from './routes/heatmap.js';
import predictionsRouter from './routes/predictions.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/events', eventsRouter);
app.use('/api/heatmap', heatmapRouter);
app.use('/api/predictions', predictionsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

export default app;
