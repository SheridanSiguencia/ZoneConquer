// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('./auth');

// Monday-start week in Postgres using date_trunc('week', now())
router.get('/weekly', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const result = await db.query(
      `
      SELECT
        u.user_id,
        u.username,
        u.profile_picture_url,
        COALESCE(SUM(e.delta_xp), 0)::bigint AS xp_this_week
      FROM users u
      LEFT JOIN xp_events e
        ON e.user_id = u.user_id
       AND e.created_at >= date_trunc('week', now())
      GROUP BY u.user_id, u.username, u.profile_picture_url
      ORDER BY xp_this_week DESC, u.username ASC
      LIMIT $1
      `,
      [limit]
    );

    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    console.error('[leaderboard weekly] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load weekly leaderboard' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 50), 200);

    const result = await db.query(
      `
      SELECT
        u.user_id,
        u.username,
        u.profile_picture_url,
        COALESCE(SUM(e.delta_xp), 0)::bigint AS xp_today
      FROM users u
      LEFT JOIN xp_events e
        ON e.user_id = u.user_id
       AND e.created_at >= date_trunc('day', now())
      GROUP BY u.user_id, u.username, u.profile_picture_url
      ORDER BY xp_today DESC, u.username ASC
      LIMIT $1
      `,
      [limit]
    );

    res.json({ success: true, leaderboard: result.rows });
  } catch (err) {
    console.error('[leaderboard today] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load today leaderboard' });
  }
});

// Useful for the current user "Your XP today/this week" card
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

    const r = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', now()) THEN delta_xp ELSE 0 END), 0)::bigint AS xp_today,
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('week', now()) THEN delta_xp ELSE 0 END), 0)::bigint AS xp_this_week
      FROM xp_events
      WHERE user_id = $1
      `,
      [userId]
    );

    res.json({ success: true, ...r.rows[0] });
  } catch (err) {
    console.error('[leaderboard me] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load your XP totals' });
  }
});

module.exports = router;
