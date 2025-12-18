// routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// --- DB TEST -------------------------------------------------
router.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      message: 'Database connected successfully!',
      time: result.rows[0].current_time,
      database: 'zoneconquer',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- REGISTER -----------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('👤 Registration attempt:', username, email);

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required',
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING user_id, username, email, created_at`,
      [username, email, password_hash],
    );

    const newUser = result.rows[0];
    console.log('New user registered:', newUser.username);

    await pool.query(
      `INSERT INTO user_stats
       (user_id, territories_owned, current_streak, today_distance, weekly_distance, weekly_goal)
       VALUES ($1, 0, 0, 0, 0, 15)`,
      [newUser.user_id],
    );

    console.log('User stats row created for user:', newUser.user_id);

    res.json({
      success: true,
      message: 'Registration successful! 🎉',
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.code === '23505') {
      if (error.constraint === 'users_username_key') {
        return res.status(400).json({
          success: false,
          error: 'Username already exists',
        });
      }
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({
          success: false,
          error: 'Email already registered',
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

// --- LOGIN --------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
    }

    const userResult = await pool.query(
      'SELECT user_id, username, email, password_hash FROM users WHERE email = $1',
      [email],
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const user = userResult.rows[0];

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    // ✅ SESSION SET HERE
    req.session.user_id = user.user_id;
    req.session.username = user.username;
    console.log('Session set for user:', user.user_id);

    res.json({
      success: true,
      message: 'Login successful! 🎉',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
      },
      game_data: {
        level: 1,
        territories_owned: 0,
        total_area: 0,
      },
    });
  } catch (error) {
    console.error('🔴 Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed: ' + error.message,
    });
  }
});

// --- REQUEST PASSWORD RESET --------------------------------
router.post('/request-password-reset', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@') || !email.includes('.')) {
    return res
      .status(400)
      .json({ success: false, error: 'Valid email is required.' });
  }

  try {
    const userResult = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email],
    );

    if (userResult.rows.length === 0) {
      // Don’t reveal if the email exists
      return res.json({
        success: true,
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    }

    const userId = userResult.rows[0].user_id;
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id)
       DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at`,
      [userId, resetToken, expiresAt],
    );

    const resetLink = `/reset-password?token=${resetToken}`;
    console.log(`Password reset link for ${email}: ${resetLink}`);

    res.json({
      success: true,
      message:
        'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request.',
    });
  }
});

// --- AUTH MIDDLEWARE (exported for other routes) -----------
const auth = (req, res, next) => {
  console.log('Auth check - session:', req.session?.user_id);

  if (req.session && req.session.user_id) {
    req.userId = req.session.user_id;
    req.username = req.session.username;
    return next();
  }

  console.log('🔐 Auth failed - no user session');
  return res.status(401).json({
    success: false,
    error: 'Not authenticated. Please log in.',
  });
};

// --- ME (who am I) -----------------------------------------
router.get('/me', auth, (req, res) => {
  res.json({
    success: true,
    user_id: req.session.user_id,
    username: req.session.username,
  });
});

// --- LOGOUT (optional but useful) ---------------------------
router.post('/logout', auth, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // default cookie name for express-session
    res.json({ success: true });
  });
});


module.exports = {
  router,
  auth,
};
