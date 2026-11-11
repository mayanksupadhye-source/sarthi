import mongoose from 'mongoose';
import dns from 'node:dns';
import { config } from './env.js';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// Fix for Windows / ISP DNS querySrv ECONNREFUSED on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore fallback if platform restricts dns.setServers
}

// Fail fast on disconnected queries instead of buffering for 10000ms
mongoose.set('bufferCommands', false);
mongoose.set('bufferTimeoutMS', 2500);

let isConnected = false;

/**
 * Inspect MongoDB URI for common syntax / configuration mistakes
 * without exposing sensitive password values.
 */
export function inspectMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') {
    return { valid: false, error: 'MONGODB_URI is empty or not defined.' };
  }

  const hasAngleBrackets = rawUri.includes('<') || rawUri.includes('>');
  const sanitizedUri = rawUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, '$1[REDACTED]$3');

  let protocol = 'unknown';
  let username = null;
  let host = null;
  let database = null;

  try {
    const match = rawUri.match(/^(mongodb(?:\+srv)?):\/\/([^@]+)@([^\/\?]+)(?:\/([^\?]*))?/);
    if (match) {
      protocol = match[1];
      const credentials = match[2];
      const colonIndex = credentials.indexOf(':');
      username = colonIndex !== -1 ? credentials.substring(0, colonIndex) : credentials;
      host = match[3];
      database = match[4] || null;
    }
  } catch {
    // Non-fatal parse failure
  }

  return {
    valid: true,
    hasAngleBrackets,
    sanitizedUri,
    protocol,
    username,
    host,
    database: database || 'default (test/admin)'
  };
}

export async function connectDB() {
  if (isConnected) return mongoose.connection;

  const inspection = inspectMongoUri(config.mongodbUri);

  if (inspection.hasAngleBrackets) {
    console.error(`\n${BOLD}${RED}[SARTHI CONFIG ERROR]${RESET} MONGODB_URI contains literal '<' or '>' angle brackets!`);
    console.error(`  - Sanitized URI: ${inspection.sanitizedUri}`);
    console.error(`  - Detected Username: ${inspection.username}`);
    console.error(`  - In MongoDB Atlas, '<username>' and '<password>' are template placeholders.`);
    console.error(`  - You MUST remove the angle brackets: e.g. change '<${inspection.username?.replace(/[<>]/g, '')}>' to '${inspection.username?.replace(/[<>]/g, '')}'.`);
    console.error(`  - MongoDB treats '<>' as literal characters, which causes Atlas authentication to fail with 'bad auth'.\n`);
  }

  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 4000
    });
    isConnected = true;
    console.log(`${BOLD}${CYAN}[SARTHI]${RESET} ${GREEN}MongoDB Connected:${RESET} ${conn.connection.host} (DB: ${conn.connection.name})`);
    return conn.connection;
  } catch (err) {
    isConnected = false;
    console.warn(`${BOLD}${YELLOW}[SARTHI]${RESET} ${YELLOW}MongoDB Connection warning:${RESET} ${err.message}`);
    console.warn(`${BOLD}${YELLOW}[SARTHI]${RESET} Ensure MongoDB is running locally on mongodb://127.0.0.1:27017/sarthi or configure MONGODB_URI in .env with your MongoDB Atlas connection string.`);
    return null;
  }
}

export function getDBStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host || 'not connected',
    name: mongoose.connection.name || 'sarthi'
  };
}

/**
 * Express middleware to ensure database readiness.
 * Returns immediate HTTP 503 rather than timing out on Mongoose operation buffering.
 */
export function requireDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: 'Database unavailable: MongoDB is not connected. Please verify your MONGODB_URI credentials in .env.',
      dbStatus: getDBStatus()
    });
  }
  next();
}
