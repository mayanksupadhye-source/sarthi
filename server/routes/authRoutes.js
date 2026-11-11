import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, tokenLogin, tokenRefresh, tokenLogout } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rate limiting for auth endpoints: 30 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);

// Native Bearer token routes
router.post('/token/login', authLimiter, tokenLogin);
router.post('/token/refresh', authLimiter, tokenRefresh);
router.post('/token/logout', tokenLogout);

export default router;
