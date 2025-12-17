// territories.js file
const express = require('express');
const router = express.Router();
const db = require('../config/database'); // Using your existing database config
const { auth } = require('./auth'); // Import auth from your existing auth routes
console.log('DEBUG auth type in territories:', typeof auth);

/**
 * When userId creates or updates territoryId, this:
 * 1) Finds all accepted friends of that user.
 * 2) For each friend territory that intersects this new territory:
 *    - Computes difference = friendGeom - newGeom (ST_Difference).
 *    - If empty, deletes that friend territory and decrements their territories_owned.
 *    - Otherwise, updates the friend's geometry, coordinates JSON, and area_sq_meters.
 */
async function adjustOverlapsForFriends(userId, territoryId) {
  try {
    console.log(
      '[friends-overlap] Checking overlaps for user',
      userId,
      'territory',
      territoryId
    );

    // 1) Find accepted friends
    const friendsRes = await db.query(
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

    if (friendsRes.rows.length === 0) {
      console.log('[friends-overlap] No friends, skipping overlap logic');
      return;
    }

    const friendIds = friendsRes.rows.map((row) => row.friend_id);
    console.log('[friends-overlap] Friend IDs:', friendIds);

    // 2) Friend territories that intersect this territory
    const overlappingRes = await db.query(
      `
      SELECT 
        t.territory_id,
        t.user_id
      FROM territories t
      WHERE t.user_id = ANY($1::uuid[])
        AND ST_Intersects(
          t.geometry,
          (SELECT geometry FROM territories WHERE territory_id = $2)
        )
      `,
      [friendIds, territoryId]
    );

    if (overlappingRes.rows.length === 0) {
      console.log('[friends-overlap] No overlapping friend territories');
      return;
    }

    console.log(
      '[friends-overlap] Overlapping friend territories:',
      overlappingRes.rows.map((r) => r.territory_id)
    );

    // 3) For each overlapping friend territory, carve out the part taken by this user
    for (const row of overlappingRes.rows) {
      const friendTerritoryId = row.territory_id;
      const friendId = row.user_id;

      console.log(
        '[friends-overlap] Adjusting friend territory',
        friendTerritoryId,
        'owned by',
        friendId
      );

      // Compute difference geometry and area
      const diffRes = await db.query(
        `
        WITH diff AS (
          SELECT 
            ST_Difference(t.geometry, newt.geometry) AS geom
          FROM territories t,
               territories newt
          WHERE t.territory_id = $1
            AND newt.territory_id = $2
        )
        SELECT
          ST_IsEmpty(geom) AS is_empty,
          ST_AsGeoJSON(geom) AS geojson,
          ST_Area(ST_Transform(geom, 3857)) AS area_m2
        FROM diff
        `,
        [friendTerritoryId, territoryId]
      );

      if (!diffRes.rows.length) {
        console.warn(
          '[friends-overlap] No diff row returned for territory',
          friendTerritoryId
        );
        continue;
      }

      const { is_empty, geojson, area_m2 } = diffRes.rows[0];

      // Entire friend territory was captured -> delete and decrement count
      if (is_empty || !geojson) {
        console.log(
          '[friends-overlap] Friend territory fully captured; deleting',
          friendTerritoryId
        );

        await db.query('DELETE FROM territories WHERE territory_id = $1', [
          friendTerritoryId,
        ]);

        await db.query(
          `
          UPDATE user_stats
          SET territories_owned = GREATEST(territories_owned - 1, 0)
          WHERE user_id = $1
          `,
          [friendId]
        );

        continue;
      }

      // Otherwise, update friend territory geometry with the difference
      let coordsJson;
      try {
        const geom = JSON.parse(geojson);

        let rings = [];

        if (geom.type === 'Polygon') {
          // Polygon: [ [ [lng, lat], ... ] ]
          rings = geom.coordinates; // array of rings, use all outer rings
        } else if (geom.type === 'MultiPolygon') {
          // MultiPolygon: [ [ [ [lng, lat], ... ] ], ... ]
          // Flatten outer rings of each polygon
          rings = geom.coordinates.map((poly) => poly[0]);
        } else {
          console.warn(
            '[friends-overlap] Unexpected geometry type:',
            geom.type
          );
          continue;
        }

        const latLngRings = rings.map((ring) =>
          ring.map(([lng, lat]) => ({
            latitude: lat,
            longitude: lng,
          }))
        );

        coordsJson = JSON.stringify(latLngRings);
      } catch (parseErr) {
        console.error(
          '[friends-overlap] Failed to parse GeoJSON for territory',
          friendTerritoryId,
          parseErr
        );
        continue;
      }

      await db.query(
        `
        UPDATE territories
        SET 
          geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
          coordinates = $2,
          area_sq_meters = $3
        WHERE territory_id = $4
        `,
        [geojson, coordsJson, area_m2, friendTerritoryId]
      );

      console.log(
        '[friends-overlap] Updated friend territory',
        friendTerritoryId,
        'new area (m²):',
        area_m2
      );
    }
  } catch (err) {
    // Swallow errors so they do not break the main save/update route
    console.error(
      '[friends-overlap] Error while adjusting overlaps:',
      err
    );
  }
}

// Test routes
router.get('/test-connection', (req, res) => {
  console.log('Territories test route hit');
  res.json({
    success: true,
    message: 'Territories route is working',
    timestamp: new Date().toISOString(),
  });
});

router.get('/test-session', auth, (req, res) => {
  console.log('Session test - user_id:', req.session.user_id);
  res.json({
    success: true,
    userId: req.session.user_id,
    session: req.session,
  });
});

// Save a conquered territory
router.post('/save', auth, async (req, res) => {
  try {
    const { coordinates, area_sq_meters } = req.body;

    console.log('Session data:', req.session);
    const userId = req.session.user_id;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates format',
      });
    }

    console.log(
      'Saving territory for user:',
      userId,
      'Area:',
      area_sq_meters
    );

    // Convert coordinates to PostGIS polygon format
    const polygonCoords = coordinates[0]
      .map((coord) => `${coord.longitude} ${coord.latitude}`)
      .join(',');

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

    const newTerritoryId = result.rows[0].territory_id;
    console.log('Territory saved successfully:', newTerritoryId);

    // After saving, adjust overlaps with friends
    await adjustOverlapsForFriends(userId, newTerritoryId);

    res.json({
      success: true,
      territory_id: newTerritoryId,
      created_at: result.rows[0].created_at,
    });
  } catch (error) {
    console.error('Error saving territory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save territory',
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

    console.log(
      'Found territories for user:',
      userId,
      'Count:',
      result.rows.length
    );

    res.json({
      success: true,
      territories: result.rows,
    });
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch territories',
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
      territories: result.rows,
    });
  } catch (error) {
    console.error('Error fetching all territories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch territories',
    });
  }
});

// Update an existing territory (for merging/expanding)
router.put('/update', auth, async (req, res) => {
  try {
    const { territory_id, coordinates, area_sq_meters } = req.body;
    const userId = req.session.user_id;

    if (!territory_id || !coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({
        success: false,
        error: 'Missing territory_id or invalid coordinates',
      });
    }

    console.log(
      'Updating territory:',
      territory_id,
      'for user:',
      userId,
      'Area:',
      area_sq_meters
    );

    // Convert coordinates to PostGIS polygon format
    const polygonCoords = coordinates[0]
      .map((coord) => `${coord.longitude} ${coord.latitude}`)
      .join(',');

    const wktPolygon = `POLYGON((${polygonCoords}))`;

    // Update the territory in database
    const result = await db.query(
      `UPDATE territories 
       SET geometry = ST_GeomFromText($1, 4326), 
           coordinates = $2, 
           area_sq_meters = $3,
           created_at = NOW()  
       WHERE territory_id = $4 AND user_id = $5
       RETURNING territory_id, created_at`,
      [wktPolygon, JSON.stringify(coordinates), area_sq_meters, territory_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Territory not found or not owned by user',
      });
    }

    console.log('Territory updated successfully:', territory_id);

    // After update, adjust overlaps with friends
    await adjustOverlapsForFriends(userId, territory_id);

    res.json({
      success: true,
      territory_id: result.rows[0].territory_id,
      created_at: result.rows[0].created_at,
    });
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update territory',
    });
  }
});

module.exports = router;
