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

// Trust reverse proxy (Render, Cloudflare, Vercel) for secure cookies and accurate client IP
app.set('trust proxy', 1);

// Lightweight liveness probe for deployment infrastructure
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS Allowlist Configuration
const allowedOrigins = [
  'https://localhost',
  'capacitor://localhost'
];

if (config.clientOrigin) {
  // Normalize client origin without trailing slash
  allowedOrigins.push(config.clientOrigin.replace(/\/$/, ''));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile app native fetch, curl, health checks)
    if (!origin) return callback(null, true);

    const normalized = origin.replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }

    // In development mode, allow localhost and local loopback origins
    if (config.nodeEnv !== 'production') {
      if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Serve static frontend files from client/
app.use(express.static(CLIENT_DIR));
app.use('/client', express.static(CLIENT_DIR));

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
  const RED = '\x1b[31m';
  const BOLD = '\x1b[1m';
  const RESET = '\x1b[0m';
  console.error(`${BOLD}${RED}[SARTHI Error]${RESET} [${req.method} ${req.url}]:`, err.message);

  res.status(statusCode).json({
    success: false,
    error: err.message || 'An unexpected internal error occurred.',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});
