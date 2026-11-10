import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import apiRouter from './routes/api.js';
import { config } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, '../client');

export const app = express();

// Security middleware (relaxed CSP for local scripts/styles)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve static frontend files from client/
app.use(express.static(CLIENT_DIR));

// Mount core API
app.use('/api', apiRouter);

// Frontend clean page routes fallback: e.g. /tasks -> client/pages/tasks.html
app.get('/:page', (req, res, next) => {
  const pageName = req.params.page;
  const pagePath = path.join(CLIENT_DIR, 'pages', `${pageName}.html`);
  res.sendFile(pagePath, err => {
    if (err) next();
  });
});

// Root route -> client/pages/dashboard.html or index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'pages', 'dashboard.html'), err => {
    if (err) res.sendFile(path.join(CLIENT_DIR, 'index.html'));
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error(`[SARTHI Error] [${req.method} ${req.url}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal error occurred.',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});
