const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/stats', async (req, res) => {
  try {
    // 🎯 ADD THIS DEBUG CODE RIGHT HERE:
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
      console.log('✅ Created default stats:', defaultStats.rows[0]);
      return res.json(defaultStats.rows[0]);
    }

    console.log('✅ Returning user stats:', result.rows[0]);
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error('💥 Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

module.exports = router;