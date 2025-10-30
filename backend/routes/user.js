// backend/routes/user.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// GET user stats
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await pool.query(
      `SELECT 
        us.user_id,
        us.total_distance_km,
        us.territories_owned,
        us.current_streak,
        -- Calculate today's distance (you might want to track this separately)
        COALESCE(us.total_distance_km * 0.1, 0) as today_distance
       FROM user_stats us
       WHERE us.user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      // Create default stats if user doesn't have any
      const insertResult = await pool.query(
        `INSERT INTO user_stats (user_id, total_distance_km, territories_owned, current_streak)
         VALUES ($1, 0, 0, 0)
         RETURNING *`,
        [user_id]
      );
      return res.json(insertResult.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;