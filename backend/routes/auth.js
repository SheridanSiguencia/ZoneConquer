const express = require('express');
const router = express.Router();  // ← CRITICAL: This defines 'router'
const pool = require('../config/database');
const bcrypt = require('bcrypt');

// ✅ DATABASE TEST ROUTE
router.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({ 
      message: 'Database connected successfully!', 
      time: result.rows[0].current_time,
      database: 'zoneconquer'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ USER REGISTRATION ROUTE
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('👤 Registration attempt:', username, email);

    // 🛡️ Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false,
        error: 'Username, email, and password are required' 
      });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }

    // 🔐 Hash password with bcrypt
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

   
// 🗄️ Insert into database
const result = await pool.query(
    `INSERT INTO users (username, email, password_hash) 
     VALUES ($1, $2, $3)
     RETURNING user_id, username, email, created_at`,
    [username, email, password_hash]
  );
  
  const newUser = result.rows[0];
  console.log('New user registered:', newUser.username);
  
  await pool.query(
    `INSERT INTO user_stats (user_id, territories_owned, current_streak, today_distance, weekly_distance, weekly_goal) 
     VALUES ($1, 0, 0, 0, 0, 15)`,
    [newUser.user_id]
  );
  
  console.log('📊 User stats row created for user:', newUser.user_id);

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === '23505') {
      if (error.constraint === 'users_username_key') {
        return res.status(400).json({ 
          success: false,
          error: 'Username already exists' 
        });
      }
      if (error.constraint === 'users_email_key') {
        return res.status(400).json({ 
          success: false,
          error: 'Email already registered' 
        });
      }
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Registration failed' 
    });
  }
});

// ✅ USER LOGIN ROUTE - FIXED VERSION
router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      console.log('🔐 Login attempt for:', email);
  
      // 🛡️ Validation
      if (!email || !password) {
        return res.status(400).json({ 
          success: false,
          error: 'Email and password are required' 
        });
      }
  
      if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({
          success: false, 
          error: 'Invalid email format'
        });
      }
  
      // 🗄️ Check if user exists
      const userResult = await pool.query(
        'SELECT user_id, username, email, password_hash FROM users WHERE email = $1',
        [email]
      );
    
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
  
      const user = userResult.rows[0];
    
      // 🔐 Check password with bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password'
        });
      }
  
      // ✅ SET SESSION - THIS IS WHAT WAS MISSING!
      req.session.user_id = user.user_id;
      req.session.username = user.username;
      console.log('🔐 Session set for user:', user.user_id);
  
      // ✅ SUCCESS
      console.log('Login successful for user:', user.username);
      
      res.json({
        success: true,
        message: 'Login successful! 🎉',
        user: {
          id: user.user_id,
          username: user.username,
          email: user.email
        },
        game_data: {
          level: 1,
          territories_owned: 0,
          total_area: 0
        }
      });
  
    } catch (error) {
      console.error('🔴 Login error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Login failed: ' + error.message
      });
    }
  });

// AUTH MIDDLEWARE 
const auth = (req, res, next) => {
  console.log('🔐 Auth check - session:', req.session?.user_id);
  
  if (req.session && req.session.user_id) {
    // Add user info to request for easier access in routes
    req.userId = req.session.user_id;
    req.username = req.session.username;
    return next();
  }
  
  console.log('🔐 Auth failed - no user session');
  return res.status(401).json({ 
    success: false, 
    error: 'Not authenticated. Please log in.' 
  });
};

// ✅ Export both the router AND the auth middleware
module.exports = {
  router: router,
  auth: auth
};