import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sarthi',
  jwtSecret: process.env.JWT_SECRET || 'sarthi_jwt_default_secret_dev_2026',
  sessionSecret: process.env.SESSION_SECRET || 'sarthi_session_secret_dev_2026',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  appName: 'SARTHI',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/integrations/google/callback',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@sarthi.app'
};
