import mongoose from 'mongoose';
import dns from 'node:dns';
import { config } from './env.js';

// Fix for Windows / ISP DNS querySrv ECONNREFUSED on mongodb+srv://
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore fallback if platform restricts dns.setServers
}

let isConnected = false;

export async function connectDB() {
  if (isConnected) return mongoose.connection;

  try {
    mongoose.set('strictQuery', true);
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 3000
    });
    isConnected = true;
    console.log(`[SARTHI] MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (err) {
    console.warn(`[SARTHI] MongoDB Connection warning: ${err.message}`);
    console.warn(`[SARTHI] Ensure MongoDB is running locally on mongodb://127.0.0.1:27017/sarthi or configure MONGODB_URI in .env with your MongoDB Atlas connection string.`);
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
