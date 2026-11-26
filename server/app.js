import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import apiRouter from './routes/api.js';
import { config } from './config/env.js';
import { pingDatabase, getDBStatus } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIR = path.resolve(__dirname, '../client');

export const app = express();

// Trust reverse proxy (Render, Cloudflare, Vercel) for secure cookies and accurate client IP
app.set('trust proxy', 1);

// Lightweight liveness probe for deployment infrastructure (checks if process is alive)
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Deep readiness probe (checks if MongoDB is actively reachable via ping)
app.get('/readyz', async (req, res) => {
  try {
    const pingPromise = pingDatabase();
    // Bounded timeout so readiness check never hangs indefinitely
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ ok: false, error: 'Readiness ping timed out after 3000ms' }), 3000));
    const pingResult = await Promise.race([pingPromise, timeoutPromise]);

    const dbStatus = getDBStatus();
    if (pingResult && pingResult.ok) {
      return res.status(200).json({
        status: 'ready',
        database: 'connected',
        latencyMs: pingResult.latencyMs,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    } else {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({
        status: 'not_ready',
        database: dbStatus.stateDescription,
        error: pingResult?.error || 'Database ping failed',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    res.setHeader('Retry-After', '3');
    return res.status(503).json({
      status: 'not_ready',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
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

// NoSQL operator injection and request body sanitization
import { sanitizeRequest } from './middleware/sanitize.js';
app.use(sanitizeRequest);

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

  // Redact potentially sensitive connection strings or internal database paths from production client errors
  let safeErrorMessage = err.message || 'An unexpected internal error occurred.';
  if (config.nodeEnv === 'production' && statusCode === 500) {
    if (safeErrorMessage.includes('mongodb') || safeErrorMessage.includes('connect') || safeErrorMessage.includes('topology')) {
      safeErrorMessage = 'Database service is temporarily unavailable. Please retry in a few moments.';
    }
  }

  res.status(statusCode).json({
    success: false,
    error: safeErrorMessage,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});
