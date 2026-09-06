import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import { logger } from './otel/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('http request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
    });
  });
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Single-artifact deploy: if a production build exists, serve it directly
// from this same process instead of running a separate frontend server.
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err, req, res, next) => {
  logger.error('unhandled request error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
});
