const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/stats', async (req, res) => {
  try {
    
    console.log('🔍 SESSION DEBUG:', {
      session: req.session,
      userId: req.session.user_id,
      sessionID: req.sessionID,
      cookies: req.headers.cookie,
      headers: req.headers
    });
    
    const userId = req.session.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    console.log('📊 Fetching stats for user:', userId);

    // Query the database for user stats
    const result = await pool.query(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userId]
    );

    console.log('📈 Database result:', result.rows);

    if (result.rows.length === 0) {
      // Create default stats if none exist - MOST THINGS 0, GOAL 15
      console.log('⚡ Creating default stats for new user');
      const defaultStats = await pool.query(
        `INSERT INTO user_stats 
         (user_id, territories_owned, current_streak, today_distance, weekly_distance, weekly_goal) 
         VALUES ($1, 0, 0, 0, 0, 15) 
         RETURNING *`,
        [userId]
      );
      console.log('Created default stats:', defaultStats.rows[0]);
      return res.json(defaultStats.rows[0]);
    }

    console.log('Returning user stats:', result.rows[0]);
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Add distance tracking endpoint
router.post('/update-distance', async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { distance_meters } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!distance_meters || distance_meters < 0) {
      return res.status(400).json({ error: 'Valid distance required' });
    }

    //console.log('📏 Updating distance for user:', userId, 'Distance:', distance_meters);

    // Update distance stats
    const result = await pool.query(
      `UPDATE user_stats 
       SET today_distance = COALESCE(today_distance, 0) + $1,
           weekly_distance = COALESCE(weekly_distance, 0) + $1
       WHERE user_id = $2
       RETURNING *`,
      [distance_meters, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User stats not found' });
    }

    //console.log('Distance updated successfully ^_^');
    res.json({ 
      success: true, 
      stats: result.rows[0] 
    });
  } catch (error) {
    console.error('Distance update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const userId = req.session.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT username, email, created_at FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/user/update-profile
// @desc    Update user's profile data
// @access  Private (requires authentication)
router.post('/update-profile', async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { username, email } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Basic validation
    if (!username || !email) {
      return res.status(400).json({ success: false, error: 'Username and email are required.' });
    }

    // Update user in the database
    const result = await pool.query(
      `UPDATE users SET username = $1, email = $2 WHERE user_id = $3 RETURNING username, email, created_at`,
      [username, email, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update user profile.' });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const userId = req.session.user_id;

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await pool.query(
      `SELECT username, email, created_at FROM users WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// @route   POST /api/user/update-profile
// @desc    Update user's profile data
// @access  Private (requires authentication)
router.post('/update-profile', async (req, res) => {
  try {
    const userId = req.session.user_id;
    const { username, email } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Basic validation
    if (!username || !email) {
      return res.status(400).json({ success: false, error: 'Username and email are required.' });
    }

    // Update user in the database
    const result = await pool.query(
      `UPDATE users SET username = $1, email = $2 WHERE user_id = $3 RETURNING username, email, created_at`,
      [username, email, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ success: false, error: 'Failed to update user profile.' });
  }
});

// Add streak check endpoint (logic implemented later)
router.post('/check-streak', async (req, res) => {
  try {
    const userId = req.session.user_id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }


    // For now, just return current stats 
    const result = await pool.query(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userId]
    );

    res.json({ 
      success: true, 
      stats: result.rows[0] 
    });
  } catch (error) {
    console.error('Streak check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;