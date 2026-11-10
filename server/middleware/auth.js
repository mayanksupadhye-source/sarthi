import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function authenticate(req, res, next) {
  let token = null;

  // 1. Check cookies
  if (req.cookies && req.cookies.sarthi_token) {
    token = req.cookies.sarthi_token;
  } 
  // 2. Check Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to access this resource.'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.'
    });
  }
}

export function optionalAuth(req, res, next) {
  let token = null;
  if (req.cookies && req.cookies.sarthi_token) {
    token = req.cookies.sarthi_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;
    } catch {
      // Ignore token error for optional auth
    }
  }
  next();
}
