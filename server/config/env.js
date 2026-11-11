import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'sarthi_jwt_default_secret_dev_2026';
const sessionSecret = process.env.SESSION_SECRET || 'sarthi_session_secret_dev_2026';

// Reject unsafe default credentials in production
if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'sarthi_jwt_default_secret_dev_2026') {
    throw new Error('[SARTHI CONFIG] In production, JWT_SECRET must be explicitly defined with a strong unique value.');
  }
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'sarthi_session_secret_dev_2026') {
    throw new Error('[SARTHI CONFIG] In production, SESSION_SECRET must be explicitly defined with a strong unique value.');
  }
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi',
  jwtSecret,
  sessionSecret,
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  appName: 'SARTHI',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/integrations/google/callback',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@sarthi.app'
};
