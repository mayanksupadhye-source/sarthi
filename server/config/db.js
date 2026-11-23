import mongoose from "mongoose";
import dns from "node:dns";
import { config } from "./env.js";

const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

// Fix for Windows / ISP DNS querySrv ECONNREFUSED on mongodb+srv://
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // Ignore fallback if platform restricts dns.setServers
}

// Gracefully buffer commands during initial connection & transient reconnects
mongoose.set("bufferCommands", true);
mongoose.set("bufferTimeoutMS", 15000);
mongoose.set("strictQuery", true);

let isConnected = false;
let isReconnecting = false;
let reconnectAttempts = 0;
let reconnectTimer = null;
let lastPingLatencyMs = null;
let lastConnectedTimestamp = null;
let lastDisconnectedTimestamp = null;

const HIGH_AVAILABILITY_OPTIONS = {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 25,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  w: "majority",
};

/**
 * Inspect MongoDB URI for common syntax / configuration mistakes
 * without exposing sensitive password values.
 */
export function inspectMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== "string") {
    return { valid: false, error: "MONGODB_URI is empty or not defined." };
  }

  const hasAngleBrackets = rawUri.includes("<") || rawUri.includes(">");
  const sanitizedUri = rawUri.replace(
    /(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/,
    "$1[REDACTED]$3",
  );

  let protocol = "unknown";
  let username = null;
  let host = null;
  let database = null;

  try {
    const match = rawUri.match(
      /^(mongodb(?:\+srv)?):\/\/([^@]+)@([^\/\?]+)(?:\/([^\?]*))?/,
    );
    if (match) {
      protocol = match[1];
      const credentials = match[2];
      const colonIndex = credentials.indexOf(":");
      username =
        colonIndex !== -1 ? credentials.substring(0, colonIndex) : credentials;
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
    database: database || "default (test/admin)",
  };
}

/**
 * Schedules background reconnection with exponential backoff & jitter
 */
function scheduleReconnect() {
  if (
    isReconnecting ||
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return;
  }

  isReconnecting = true;
  reconnectAttempts++;

  // Exponential backoff: min 1000ms, max 30000ms, with 10% jitter
  const baseDelay = Math.min(
    30000,
    1000 * Math.pow(1.5, Math.min(reconnectAttempts, 8)),
  );
  const jitter = baseDelay * (0.1 * Math.random());
  const delayMs = Math.round(baseDelay + jitter);

  console.warn(
    `${BOLD}${YELLOW}[SARTHI DB]${RESET} Scheduling automatic reconnect attempt #${reconnectAttempts} in ${(delayMs / 1000).toFixed(1)}s...`,
  );

  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(async () => {
    isReconnecting = false;
    try {
      console.log(
        `${BOLD}${CYAN}[SARTHI DB]${RESET} Executing automatic reconnect attempt #${reconnectAttempts}...`,
      );
      await connectDB();
    } catch (err) {
      console.warn(
        `${BOLD}${YELLOW}[SARTHI DB]${RESET} Reconnect attempt #${reconnectAttempts} failed: ${err.message}`,
      );
      scheduleReconnect();
    }
  }, delayMs);

  if (reconnectTimer.unref) reconnectTimer.unref();
}

/**
 * Register connection lifecycle event handlers
 */
function attachConnectionHandlers() {
  const db = mongoose.connection;

  // Prevent duplicate handler attachment
  if (db._sarthiHandlersAttached) return;
  db._sarthiHandlersAttached = true;

  db.on("connected", () => {
    isConnected = true;
    isReconnecting = false;
    reconnectAttempts = 0;
    lastConnectedTimestamp = new Date();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    console.log(
      `${BOLD}${CYAN}[SARTHI]${RESET} ${GREEN}MongoDB Connected:${RESET} ${db.host} (DB: ${db.name})`,
    );
  });

  db.on("disconnected", () => {
    isConnected = false;
    lastDisconnectedTimestamp = new Date();
    console.warn(
      `${BOLD}${YELLOW}[SARTHI DB]${RESET} MongoDB disconnected from cluster. Database operations will be held or rejected safely.`,
    );
    scheduleReconnect();
  });

  db.on("reconnected", () => {
    isConnected = true;
    isReconnecting = false;
    reconnectAttempts = 0;
    lastConnectedTimestamp = new Date();
    console.log(
      `${BOLD}${CYAN}[SARTHI DB]${RESET} ${GREEN}MongoDB Reconnected successfully.${RESET}`,
    );
  });

  db.on("error", (err) => {
    console.error(
      `${BOLD}${RED}[SARTHI DB ERROR]${RESET} Connection error:`,
      err.message,
    );
    if (mongoose.connection.readyState !== 1) {
      scheduleReconnect();
    }
  });
}

// Attach listeners immediately
attachConnectionHandlers();

/**
 * Connects to MongoDB with production-grade reliability options
 */
export async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  const inspection = inspectMongoUri(config.mongodbUri);

  if (inspection.hasAngleBrackets) {
    console.error(
      `\n${BOLD}${RED}[SARTHI CONFIG ERROR]${RESET} MONGODB_URI contains literal '<' or '>' angle brackets!`,
    );
    console.error(`  - Sanitized URI: ${inspection.sanitizedUri}`);
    console.error(`  - Detected Username: ${inspection.username}`);
    console.error(
      `  - In MongoDB Atlas, '<username>' and '<password>' are template placeholders.`,
    );
    console.error(
      `  - You MUST remove the angle brackets: e.g. change '<${inspection.username?.replace(/[<>]/g, "")}>' to '${inspection.username?.replace(/[<>]/g, "")}'.`,
    );
    console.error(
      `  - MongoDB treats '<>' as literal characters, which causes Atlas authentication to fail with 'bad auth'.\n`,
    );
  }

  try {
    const conn = await mongoose.connect(
      config.mongodbUri,
      HIGH_AVAILABILITY_OPTIONS,
    );
    isConnected = true;
    reconnectAttempts = 0;
    return conn.connection;
  } catch (err) {
    isConnected = false;
    console.warn(
      `${BOLD}${YELLOW}[SARTHI]${RESET} ${YELLOW}MongoDB Connection notice:${RESET} ${err.message}`,
    );
    scheduleReconnect();
    return null;
  }
}

/**
 * Pings the database to verify active round-trip communication
 */
export async function pingDatabase() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return { ok: false, latencyMs: null, error: "Database not connected" };
  }

  const start = Date.now();
  try {
    await mongoose.connection.db.admin().ping();
    const latency = Date.now() - start;
    lastPingLatencyMs = latency;
    return { ok: true, latencyMs: latency };
  } catch (err) {
    return { ok: false, latencyMs: null, error: err.message };
  }
}

/**
 * Retrieves comprehensive database health diagnostics
 */
export function getDBStatus() {
  const states = [
    "disconnected",
    "connected",
    "connecting",
    "disconnecting",
    "uninitialized",
  ];
  const readyState = mongoose.connection.readyState;

  return {
    connected: readyState === 1,
    readyState,
    stateDescription: states[readyState] || "unknown",
    host: mongoose.connection.host || "not connected",
    name: mongoose.connection.name || "sarthi",
    reconnectAttempts,
    isReconnecting,
    lastPingLatencyMs,
    lastConnectedTimestamp,
    lastDisconnectedTimestamp,
    poolSize:
      mongoose.connection.getClient?.()?.topology?.s?.servers?.size || null,
  };
}

/**
 * Express middleware to ensure database readiness.
 * Returns immediate HTTP 503 with Retry-After header rather than timing out.
 */
export function requireDB(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    res.setHeader("Retry-After", "3");
    return res.status(503).json({
      success: false,
      error:
        "Database temporarily unavailable: MongoDB is reconnecting. Your data is protected. Please retry in a few seconds.",
      dbStatus: getDBStatus(),
    });
  }
  next();
}

/**
 * Gracefully closes database connection on server termination
 */
export async function closeDB() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.connection.close(false);
      console.log(
        `${BOLD}${CYAN}[SARTHI DB]${RESET} Closed MongoDB connection cleanly.`,
      );
    } catch (e) {
      console.warn(
        `${BOLD}${YELLOW}[SARTHI DB]${RESET} Error closing connection:`,
        e.message,
      );
    }
  }
}
