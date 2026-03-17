const express = require('express');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const db = require('../config/database');
const { generateToken } = require('../config/auth');

const router = express.Router();

// Helper function to validate email
const validateEmail = (email) => {
  return validator.isEmail(email);
};

// Helper function to validate phone number (Nigerian format)
const validatePhone = (phone) => {
  const phoneRegex = /^(?:\+234|0)[7-9][0-1]\d{8}$/;
  return phoneRegex.test(phone);
};

// Helper function to validate password strength
const validatePassword = (password) => {
  // At least 5 characters, letters or numbers only
  const passwordRegex = /^[a-zA-Z0-9]{5,}$/;
  return passwordRegex.test(password);
};

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, fullName, phone } = req.body;

    // Validation
    if (!username || !email || !password || !confirmPassword || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 5 characters long and contain only letters and numbers'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Check if user already exists
    const existingUser = await db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.username === username ? 'Username already exists' : 'Email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert user into database
    const result = await db.run(
      'INSERT INTO users (username, email, password, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, fullName, phone || null]
    );

    // Create wallet for user
    await db.run(
      'INSERT INTO wallets (user_id, balance) VALUES (?, ?)',
      [result.lastID, 0]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId: result.lastID,
        username,
        email
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Find user by username or email
    const user = await db.get(
      'SELECT id, username, email, password, full_name, phone, wallet_balance, is_verified, is_admin FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.is_admin);

    // Update last login time
    await db.run(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          walletBalance: user.wallet_balance,
          isVerified: user.is_verified,
          isAdmin: user.is_admin
        }
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify token (for client-side token validation)
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists
    const user = await db.get(
      'SELECT id, username, email, full_name, phone, wallet_balance, is_verified, is_admin FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          phone: user.phone,
          walletBalance: user.wallet_balance,
          isVerified: user.is_verified,
          isAdmin: user.is_admin
        }
      }
    });

  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Logout (client-side token removal, server-side token blacklisting could be implemented)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
    const decoded = jwt.verify(token, JWT_SECRET);

    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 5 characters long and contain only letters and numbers'
      });
    }

    // Get current user
    const user = await db.get('SELECT password FROM users WHERE id = ?', [decoded.userId]);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, decoded.userId]
    );

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;