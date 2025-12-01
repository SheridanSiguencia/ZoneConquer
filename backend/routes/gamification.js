const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('./auth'); // Assuming you have an auth middleware

// @route   GET /api/gamification/achievements
// @desc    Get all available achievements
// @access  Public (or Private if achievements are user-specific)
router.get('/achievements', async (req, res) => {
  try {
    // Fetch all achievements from the achievements table
    const result = await pool.query('SELECT * FROM achievements ORDER BY achievement_id');
    // Send the achievements as a JSON response
    res.json({ success: true, achievements: result.rows });
  } catch (error) {
    // Log any errors and send a 500 status code
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

module.exports = router;
