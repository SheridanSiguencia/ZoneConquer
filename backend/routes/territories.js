// territories.js file
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Using your existing database config
const { auth } = require('./auth'); // Import auth from your existing auth routes


// In backend/routes/territories.js 
router.get('/test-connection', (req, res) => {
    console.log('Territories test route hit!');
    res.json({ 
      success: true, 
      message: 'Territories route is working!',
      timestamp: new Date().toISOString()
    });
  });


router.get('/test-session', auth, (req, res) => {
    console.log('🔐 Session test - user_id:', req.session.user_id);
    res.json({ 
      success: true, 
      userId: req.session.user_id,
      session: req.session
    });
  });
  
// Save a conquered territory
router.post('/save', auth, async (req, res) => {
  try {
    const { coordinates, area_sq_meters } = req.body;
    // DEBUG: Check what's in the session
    console.log('🔐 Session data:', req.session);
    //console.log('🔐 Session user_id:', req.session.user_id);
    //console.log('🔐 Session userId:', req.session.userId);
    const userId = req.session.user_id; // Using session like your existing auth

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid coordinates format' 
      });
    }

    console.log('Saving territory for user:', userId, 'Area:', area_sq_meters);

    // Convert coordinates to PostGIS polygon format
    const polygonCoords = coordinates[0].map(coord => 
      `${coord.longitude} ${coord.latitude}`
    ).join(',');
    
    const wktPolygon = `POLYGON((${polygonCoords}))`;

    const result = await db.query(
      `INSERT INTO territories (user_id, geometry, coordinates, area_sq_meters)
       VALUES ($1, ST_GeomFromText($2, 4326), $3, $4)
       RETURNING territory_id, created_at`,
      [userId, wktPolygon, JSON.stringify(coordinates), area_sq_meters]
    );

    // Update user stats - increment territories_owned
    await db.query(
      `UPDATE user_stats 
       SET territories_owned = territories_owned + 1
       WHERE user_id = $1`,
      [userId]
    );

    console.log('Territory saved successfully:', result.rows[0].territory_id);

    res.json({
      success: true,
      territory_id: result.rows[0].territory_id,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Error saving territory:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save territory'
    });
  }
});

// Get all territories for a user
router.get('/my-territories', auth, async (req, res) => {
    try {
      const userId = req.session.user_id;
      
      const result = await db.query(
        `SELECT t.territory_id, t.coordinates, t.area_sq_meters, 
                t.created_at, t.user_id, u.username
         FROM territories t
         JOIN users u ON t.user_id = u.user_id
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );
  
      console.log('Found territories for user:', userId, 'Count:', result.rows.length);
  
      res.json({ 
        success: true, 
        territories: result.rows 
      });
    } catch (error) {
      console.error('Error fetching territories:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch territories' 
      });
    }
  });

// Get all territories for map display (no auth required)
router.get('/all', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.territory_id, t.coordinates, t.area_sq_meters, 
              t.created_at, u.username, u.user_id
       FROM territories t
       JOIN users u ON t.user_id = u.user_id
       ORDER BY t.created_at DESC`
    );

    console.log('Found all territories:', result.rows.length);

    res.json({ 
      success: true, 
      territories: result.rows 
    });
  } catch (error) {
    console.error('Error fetching all territories:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch territories' 
    });
  }
});

module.exports = router;