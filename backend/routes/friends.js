const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { auth } = require('./auth'); // Use your existing auth middleware

// Send friend request
router.post('/send-request', auth, async (req, res) => {
  try {
    const { username } = req.body;
    const senderId = req.session.user_id;

    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required' });
    }

    // Find the user to send request to
    const targetUser = await pool.query(
      'SELECT user_id FROM users WHERE username = $1',
      [username]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const receiverId = targetUser.rows[0].user_id;

    if (senderId === receiverId) {
      return res.status(400).json({ success: false, error: 'Cannot send request to yourself' });
    }

    // Ensure consistent ordering (smaller ID first) to use UNIQUE constraint
    const userId1 = senderId < receiverId ? senderId : receiverId;
    const userId2 = senderId < receiverId ? receiverId : senderId;
    const requestSentBy = senderId; // Track who sent the request

    // Check if friendship already exists
    const existing = await pool.query(
      'SELECT * FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2',
      [userId1, userId2]
    );

    if (existing.rows.length > 0) {
      const status = existing.rows[0].status;
      if (status === 'pending') {
        return res.status(400).json({ 
          success: false, 
          error: 'Friend request already pending' 
        });
      } else if (status === 'accepted') {
        return res.status(400).json({ 
          success: false, 
          error: 'Already friends' 
        });
      } else if (status === 'blocked') {
        return res.status(400).json({ 
          success: false, 
          error: 'Cannot send request' 
        });
      }
    }

    // Create friend request
    await pool.query(
      `INSERT INTO friends (user_id_1, user_id_2, status, created_at) 
       VALUES ($1, $2, 'pending', NOW())`,
      [userId1, userId2]
    );

    // Get sender username for response
    const senderResult = await pool.query(
      'SELECT username FROM users WHERE user_id = $1',
      [senderId]
    );

    res.json({
      success: true,
      message: 'Friend request sent',
      sender_username: senderResult.rows[0]?.username
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/accept-request', auth, async (req, res) => {
  try {
    const { friendship_id } = req.body;
    const userId = req.session.user_id;

    if (!friendship_id) {
      return res.status(400).json({ success: false, error: 'Friendship ID required' });
    }

    // Get the friendship
    const friendship = await pool.query(
      `SELECT * FROM friends WHERE friendship_id = $1 
       AND (user_id_1 = $2 OR user_id_2 = $2)`,
      [friendship_id, userId]
    );

    if (friendship.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Friend request not found' });
    }

    if (friendship.rows[0].status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        error: 'Request is not pending' 
      });
    }

    // Update to accepted
    await pool.query(
      'UPDATE friends SET status = $1 WHERE friendship_id = $2',
      ['accepted', friendship_id]
    );

    // Get the other user's info
    const friendId = friendship.rows[0].user_id_1 === userId 
      ? friendship.rows[0].user_id_2 
      : friendship.rows[0].user_id_1;

    const friendInfo = await pool.query(
      'SELECT username FROM users WHERE user_id = $1',
      [friendId]
    );

    res.json({
      success: true,
      message: 'Friend request accepted',
      friend_username: friendInfo.rows[0]?.username
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Reject friend request
router.post('/reject-request', auth, async (req, res) => {
  try {
    const { friendship_id } = req.body;
    const userId = req.session.user_id;

    if (!friendship_id) {
      return res.status(400).json({ success: false, error: 'Friendship ID required' });
    }

    // Delete the pending request
    const result = await pool.query(
      `DELETE FROM friends WHERE friendship_id = $1 
       AND (user_id_1 = $2 OR user_id_2 = $2) 
       AND status = 'pending' 
       RETURNING *`,
      [friendship_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Pending friend request not found' 
      });
    }

    res.json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user's friends
router.get('/list', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;

    const friends = await pool.query(
      `SELECT 
        f.friendship_id,
        f.status,
        f.created_at,
        u.user_id,
        u.username,
        us.territories_owned,
        us.weekly_distance
       FROM friends f
       JOIN users u ON (
         (f.user_id_1 = u.user_id AND f.user_id_2 = $1) OR
         (f.user_id_2 = u.user_id AND f.user_id_1 = $1)
       )
       LEFT JOIN user_stats us ON u.user_id = us.user_id
       WHERE f.status = 'accepted'
       ORDER BY u.username`,
      [userId]
    );

    res.json({
      success: true,
      friends: friends.rows
    });
  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get pending friend requests (received)
router.get('/pending', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;

    const pendingRequests = await pool.query(
      `SELECT 
        f.friendship_id,
        f.created_at,
        u.user_id,
        u.username
       FROM friends f
       JOIN users u ON (
         (f.user_id_1 = u.user_id AND f.user_id_2 = $1) OR
         (f.user_id_2 = u.user_id AND f.user_id_1 = $1)
       )
       WHERE f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      pending_requests: pendingRequests.rows
    });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get friends' territories for map display
router.get('/territories', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;

    const friendsTerritories = await pool.query(
      `SELECT 
        t.territory_id,
        t.coordinates,
        t.area_sq_meters,
        t.created_at,
        u.user_id,
        u.username
       FROM territories t
       JOIN users u ON t.user_id = u.user_id
       JOIN friends f ON (
         (f.user_id_1 = u.user_id AND f.user_id_2 = $1) OR
         (f.user_id_2 = u.user_id AND f.user_id_1 = $1)
       )
       WHERE f.status = 'accepted'
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      territories: friendsTerritories.rows
    });
  } catch (error) {
    console.error('Get friends territories error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Remove friend (unfriend)
router.post('/remove', auth, async (req, res) => {
  try {
    const { friend_id } = req.body;
    const userId = req.session.user_id;

    if (!friend_id) {
      return res.status(400).json({ success: false, error: 'Friend ID required' });
    }

    // Ensure consistent ordering for query
    const userId1 = userId < friend_id ? userId : friend_id;
    const userId2 = userId < friend_id ? friend_id : userId;

    const result = await pool.query(
      `DELETE FROM friends 
       WHERE user_id_1 = $1 AND user_id_2 = $2 
       RETURNING *`,
      [userId1, userId2]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Friend not found' 
      });
    }

    res.json({
      success: true,
      message: 'Friend removed'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;