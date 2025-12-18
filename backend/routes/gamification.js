const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('./auth'); // session auth middleware

// @route   GET /api/gamification/achievements
// @desc    Get all available achievements
// @access  Public (or Private if achievements are user-specific)
router.get('/achievements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM achievements ORDER BY achievement_id');
    res.json({ success: true, achievements: result.rows });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch achievements' });
  }
});

// @route   GET /api/gamification/challenges
// @desc    Get all available challenges
// @access  Public (or Private if challenges are user-specific)
router.get('/challenges', async (req, res) => {
  try {
    // Fetch all challenges from the challenges table
    const result = await pool.query('SELECT * FROM challenges ORDER BY challenge_id');
    // Send the challenges as a JSON response
    res.json({ success: true, challenges: result.rows });
  } catch (error) {
    // Log any errors and send a 500 status code
    console.error('Error fetching challenges:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch challenges' });
  }
});

// @route   GET /api/gamification/user-progress
// @desc    Get a user's progress on achievements and challenges
// @access  Private (requires authentication)
router.get('/user-progress', auth, async (req, res) => {
  try {
    // Get the user ID from the session
    const userId = req.session.user_id;

    // Fetch user's achievement progress
    const userAchievements = await pool.query(
      `SELECT ua.achievement_id, a.name, a.description, a.icon, a.threshold, a.metric, ua.progress, ua.unlocked_at
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.achievement_id
       WHERE ua.user_id = $1`,
      [userId]
    );

    // Fetch user's challenge progress
    const userChallenges = await pool.query(
      `SELECT uc.challenge_id, c.name, c.description, c.icon, c.goal_value, c.metric, uc.current_value, uc.completed_at
       FROM user_challenges uc
       JOIN challenges c ON uc.challenge_id = c.challenge_id
       WHERE uc.user_id = $1`,
      [userId]
    );

    // Send the user's progress as a JSON response
    res.json({
      success: true,
      achievements: userAchievements.rows,
      challenges: userChallenges.rows,
    });
  } catch (error) {
    // Log any errors and send a 500 status code
    console.error('Error fetching user progress:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user progress' });
  }
});

// =====================================================
// @route   GET /api/gamification/leaderboard
// @desc    Friends-only weekly XP leaderboard (you + accepted friends)
// @access  Private
// =====================================================
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Get accepted friends (returns friend_id)
    const friendsRes = await pool.query(
      `
      SELECT 
        CASE 
          WHEN user_id_1 = $1 THEN user_id_2 
          ELSE user_id_1 
        END AS friend_id
      FROM friends
      WHERE (user_id_1 = $1 OR user_id_2 = $1)
        AND status = 'accepted'
      `,
      [userId]
    );

    const friendIds = friendsRes.rows.map(r => r.friend_id);

    // If no friends, still show "you" as rank 1
    // Participants = [you] + friends
    const leaderboardRes = await pool.query(
      `
      WITH participants AS (
        SELECT $1::uuid AS user_id
        UNION
        SELECT unnest($2::uuid[]) AS user_id
      )
      SELECT
        u.user_id,
        u.username,
        u.profile_picture_url,
        COALESCE(SUM(x.delta_xp), 0) AS xp_week
      FROM participants p
      JOIN users u ON u.user_id = p.user_id
      LEFT JOIN xp_events x
        ON x.user_id = p.user_id
       AND x.created_at >= date_trunc('week', now())
       AND x.created_at <= now()
      GROUP BY u.user_id, u.username, u.profile_picture_url
      ORDER BY xp_week DESC, u.username ASC
      `,
      [userId, friendIds]
    );

    // Add rank + normalize bigint strings -> numbers
    const rows = leaderboardRes.rows.map((r) => ({
      user_id: r.user_id,
      username: r.username,
      profile_picture_url: r.profile_picture_url ?? null,
      xp_week: Number(r.xp_week) || 0,
      you: r.user_id === userId,
    }));

    const withRank = rows.map((r, idx) => ({ ...r, rank: idx + 1 }));

    res.json({ success: true, leaderboard: withRank });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
