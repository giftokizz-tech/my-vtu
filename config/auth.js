const jwt = require('jsonwebtoken');
const db = require('./database');

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Generate JWT token
const generateToken = (userId, isAdmin = false) => {
  return jwt.sign(
    { userId, isAdmin },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists in database
    const user = await db.get('SELECT id, username, email, is_admin, is_verified FROM users WHERE id = ?', [decoded.userId]);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token - user not found'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Admin only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// User only middleware
const requireUser = (req, res, next) => {
  if (!req.user || req.user.is_admin) {
    return res.status(403).json({
      success: false,
      message: 'User access required'
    });
  }
  next();
};

// Optional authentication (for public endpoints that can show different content for logged in users)
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT id, username, email, is_admin, is_verified FROM users WHERE id = ?', [decoded.userId]);
    
    if (user) {
      req.user = user;
    } else {
      req.user = null;
    }
  } catch (error) {
    req.user = null;
  }
  
  next();
};

module.exports = {
  generateToken,
  authenticateToken,
  requireAdmin,
  requireUser,
  optionalAuth
};