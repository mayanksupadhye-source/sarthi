import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { User } from '../models/User.js';
import { Setting } from '../models/Setting.js';
import { config } from '../config/env.js';
import { seedUserData } from '../services/courseSeeder.js';

function createToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, name: user.name, role: user.role, type: 'cookie' },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

function createAccessToken(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, name: user.name, role: user.role, type: 'access' },
    config.jwtSecret,
    { expiresIn: '15m' }
  );
}

function createRefreshToken(userId, tokenId) {
  return jwt.sign(
    { id: userId.toString(), tokenId, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: '30d' }
  );
}

function setCookie(res, token) {
  res.cookie('sarthi_token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });
}

export async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash
    });

    // Auto seed initial data for the student OS
    try {
      await seedUserData(user._id);
    } catch (seedErr) {
      console.warn('[Auth] Seeding warning:', seedErr.message);
    }

    const token = createToken(user);
    setCookie(res, token);

    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = createToken(user);
    setCookie(res, token);

    return res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie('sarthi_token');
  return res.json({ success: true, message: 'Signed out successfully.' });
}

export async function tokenLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    user.lastLogin = new Date();
    if (typeof user.cleanExpiredTokens === 'function') {
      user.cleanExpiredTokens();
    }

    const tokenId = randomUUID();
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user._id, tokenId);

    if (!Array.isArray(user.refreshTokens)) {
      user.refreshTokens = [];
    }

    user.refreshTokens.push({
      tokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await user.save();

    return res.json({
      success: true,
      tokenType: 'Bearer',
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function tokenRefresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token. Please sign in again.'
      });
    }

    if (decoded.type !== 'refresh' || !decoded.tokenId || !decoded.id) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token structure.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User associated with token does not exist.' });
    }

    if (typeof user.cleanExpiredTokens === 'function') {
      user.cleanExpiredTokens();
    }

    const existingTokenIndex = (user.refreshTokens || []).findIndex(t => t.tokenId === decoded.tokenId);
    if (existingTokenIndex === -1) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token has been revoked or expired.'
      });
    }

    // Rotate refresh token
    const newTokenId = randomUUID();
    user.refreshTokens[existingTokenIndex] = {
      tokenId: newTokenId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
    await user.save();

    const newAccessToken = createAccessToken(user);
    const newRefreshToken = createRefreshToken(user._id, newTokenId);

    return res.json({
      success: true,
      tokenType: 'Bearer',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900
    });
  } catch (err) {
    next(err);
  }
}

export async function tokenLogout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret);
        if (decoded?.id && decoded?.tokenId) {
          await User.updateOne(
            { _id: decoded.id },
            { $pull: { refreshTokens: { tokenId: decoded.tokenId } } }
          );
        }
      } catch {
        // Token already expired or invalid, nothing to revoke
      }
    }
    return res.json({ success: true, message: 'Native session terminated successfully.' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const settings = await Setting.findOne({ userId: user._id });

    return res.json({
      success: true,
      user,
      settings
    });
  } catch (err) {
    next(err);
  }
}
