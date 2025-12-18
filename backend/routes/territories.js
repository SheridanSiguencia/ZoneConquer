// routes/territories.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { auth } = require('./auth');

console.log('DEBUG auth type in territories:', typeof auth);

// ============================
// XP formula (must match frontend data/xp.ts)
// ============================
const SQ_METERS_PER_SQ_MILE = 2_589_988.110336;
const XP_PER_SQ_MILE = 1000;

function areaM2ToXp(areaM2) {
  const a = Number(areaM2 || 0);
  if (!a || a <= 0) return 0;
  const areaSqMiles = a / SQ_METERS_PER_SQ_MILE;
  const raw = areaSqMiles * XP_PER_SQ_MILE;
  const xp = Math.round(raw);
  return xp > 0 ? xp : 1;
}

// Logs ONE xp_events row. deltaAreaM2 sign determines delta_xp sign.
async function logXpEvent({ userId, territoryId = null, eventType, deltaAreaM2 }) {
  const deltaArea = Number(deltaAreaM2 || 0);
  const absArea = Math.abs(deltaArea);
  if (!absArea) return; // skip spam

  const xpAbs = areaM2ToXp(absArea);
  const deltaXp = deltaArea >= 0 ? xpAbs : -xpAbs;

  await db.query(
    `INSERT INTO xp_events (user_id, territory_id, event_type, delta_area_sq_meters, delta_xp)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, territoryId, eventType, deltaArea, deltaXp]
  );
}

/**
 * Overlap resolution (friends only):
 * - For each friend territory intersecting this user's territory:
 *   - captured_m2 := Area(Intersection(friendGeom, myGeom))
 *   - friendGeom := friendGeom - myGeom
 *   - If empty => delete friend territory, decrement territories_owned
 *   - Else => update geometry/coords/area_sq_meters
 *
 * XP logging (NO double-counting):
 * - attacker (userId) gets takeover_gain for captured_m2
 * - defender (friendId) gets takeover_loss for captured_m2
 *
 * Returns: totalCapturedM2 (sum of all captured areas from friends)
 */
async function adjustOverlapsForFriends(userId, territoryId) {
  try {
    console.log('[friends-overlap] Checking overlaps for user', userId, 'territory', territoryId);

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
      return 0;
    }

    const friendIds = friendsRes.rows.map((row) => row.friend_id);

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
      return 0;
    }

    let totalCapturedM2 = 0;

    // 3) Carve out stolen parts from each friend territory
    for (const row of overlappingRes.rows) {
      const friendTerritoryId = row.territory_id;
      const friendId = row.user_id;

      console.log('[friends-overlap] Adjusting friend territory', friendTerritoryId, 'owned by', friendId);

      // captured area = intersection(friend, myTerritory)
      const capRes = await db.query(
        `
        SELECT
          COALESCE(
            ST_Area(
              ST_Transform(
                ST_Intersection(t.geometry, mine.geometry),
                3857
              )
            ),
            0
          ) AS captured_m2
        FROM territories t
        JOIN territories mine ON mine.territory_id = $2
        WHERE t.territory_id = $1
        `,
        [friendTerritoryId, territoryId]
      );

      const capturedM2 = Number(capRes.rows[0]?.captured_m2) || 0;
      if (capturedM2 > 0) {
        totalCapturedM2 += capturedM2;

        // attacker gains, defender loses
        await logXpEvent({
          userId,
          territoryId, // keep tied to the attacker's territory
          eventType: 'takeover_gain',
          deltaAreaM2: +capturedM2,
        });

        await logXpEvent({
          userId: friendId,
          territoryId: friendTerritoryId, // may be deleted; FK is ON DELETE SET NULL
          eventType: 'takeover_loss',
          deltaAreaM2: -capturedM2,
        });
      }

      // difference geometry (friend - mine)
      const diffRes = await db.query(
        `
        WITH diff AS (
          SELECT ST_Difference(t.geometry, mine.geometry) AS geom
          FROM territories t, territories mine
          WHERE t.territory_id = $1
            AND mine.territory_id = $2
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
        console.warn('[friends-overlap] No diff row returned for territory', friendTerritoryId);
        continue;
      }

      const { is_empty, geojson, area_m2 } = diffRes.rows[0];

      // FULL capture: friend territory disappears
      if (is_empty || !geojson) {
        console.log('[friends-overlap] Friend territory fully captured; deleting', friendTerritoryId);

        await db.query('DELETE FROM territories WHERE territory_id = $1', [friendTerritoryId]);

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

      // PARTIAL capture: update friend territory geometry to the difference
      let coordsJson;
      try {
        const geom = JSON.parse(geojson);

        let rings = [];
        if (geom.type === 'Polygon') {
          rings = geom.coordinates; // includes holes if present
        } else if (geom.type === 'MultiPolygon') {
          // keep outer ring of each polygon
          rings = geom.coordinates.map((poly) => poly[0]);
        } else {
          console.warn('[friends-overlap] Unexpected geometry type:', geom.type);
          continue;
        }

        const latLngRings = rings.map((ring) =>
          ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
        );

        coordsJson = JSON.stringify(latLngRings);
      } catch (parseErr) {
        console.error('[friends-overlap] Failed to parse GeoJSON for territory', friendTerritoryId, parseErr);
        continue;
      }

      const newFriendArea = Number(area_m2 || 0);

      await db.query(
        `
        UPDATE territories
        SET 
          geometry = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
          coordinates = $2,
          area_sq_meters = $3
        WHERE territory_id = $4
        `,
        [geojson, coordsJson, newFriendArea, friendTerritoryId]
      );

      console.log(
        '[friends-overlap] Updated friend territory',
        friendTerritoryId,
        'new area (m²):',
        newFriendArea,
        'captured (m²):',
        capturedM2
      );
    }

    return totalCapturedM2;
  } catch (err) {
    console.error('[friends-overlap] Error while adjusting overlaps:', err);
    return 0;
  }
}

// ============================
// Test routes
// ============================
router.get('/test-connection', (req, res) => {
  res.json({ success: true, message: 'Territories route is working', timestamp: new Date().toISOString() });
});

router.get('/test-session', auth, (req, res) => {
  res.json({ success: true, userId: req.session.user_id, session: req.session });
});

// ============================
// Save a conquered territory (NEW territory)
// ============================
router.post('/save', auth, async (req, res) => {
  try {
    const { coordinates, area_sq_meters } = req.body;
    const userId = req.session.user_id;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ success: false, error: 'Invalid coordinates format' });
    }

    // Convert coordinates to PostGIS polygon WKT (outer ring only)
    const polygonCoords = coordinates[0].map((c) => `${c.longitude} ${c.latitude}`).join(',');
    const wktPolygon = `POLYGON((${polygonCoords}))`;

    const areaM2 = Number(area_sq_meters || 0);

    const result = await db.query(
      `INSERT INTO territories (user_id, geometry, coordinates, area_sq_meters)
       VALUES ($1, ST_GeomFromText($2, 4326), $3, $4)
       RETURNING territory_id, created_at`,
      [userId, wktPolygon, JSON.stringify(coordinates), areaM2]
    );

    await db.query(
      `UPDATE user_stats SET territories_owned = territories_owned + 1 WHERE user_id = $1`,
      [userId]
    );

    const newTerritoryId = result.rows[0].territory_id;

    // Resolve overlaps FIRST (logs takeover_gain/loss and returns captured area)
    const capturedM2 = await adjustOverlapsForFriends(userId, newTerritoryId);

    // Log XP: claim ONLY for non-stolen area (avoids double counting)
    const claimNonStolen = Math.max(0, areaM2 - capturedM2);
    if (claimNonStolen > 0) {
      await logXpEvent({
        userId,
        territoryId: newTerritoryId,
        eventType: 'claim',
        deltaAreaM2: claimNonStolen,
      });
    }

    res.json({ success: true, territory_id: newTerritoryId, created_at: result.rows[0].created_at });
  } catch (error) {
    console.error('Error saving territory:', error);
    res.status(500).json({ success: false, error: 'Failed to save territory' });
  }
});

// ============================
// Get all territories for a user
// ============================
router.get('/my-territories', auth, async (req, res) => {
  try {
    const userId = req.session.user_id;

    const result = await db.query(
      `SELECT t.territory_id, t.coordinates, t.area_sq_meters, t.created_at, t.user_id, u.username
       FROM territories t
       JOIN users u ON t.user_id = u.user_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );

    res.json({ success: true, territories: result.rows });
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch territories' });
  }
});

// ============================
// Get all territories for map display (no auth required)
// ============================
router.get('/all', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.territory_id, t.coordinates, t.area_sq_meters, t.created_at, u.username, u.user_id
       FROM territories t
       JOIN users u ON t.user_id = u.user_id
       ORDER BY t.created_at DESC`
    );

    res.json({ success: true, territories: result.rows });
  } catch (error) {
    console.error('Error fetching all territories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch all territories' });
  }
});

// ============================
// Update an existing territory (merge/expand)
// XP: logs 'expand' only for positive delta, excluding captured area
// ============================
router.put('/update', auth, async (req, res) => {
  try {
    const { territory_id, coordinates, area_sq_meters } = req.body;
    const userId = req.session.user_id;

    if (!territory_id || !coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({ success: false, error: 'Missing territory_id or invalid coordinates' });
    }

    // Fetch old area
    const oldRes = await db.query(
      `SELECT area_sq_meters FROM territories WHERE territory_id = $1 AND user_id = $2`,
      [territory_id, userId]
    );

    if (!oldRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Territory not found or not owned by user' });
    }

    const oldArea = Number(oldRes.rows[0].area_sq_meters || 0);
    const newArea = Number(area_sq_meters || 0);
    const delta = newArea - oldArea;

    // Convert coordinates to WKT (outer ring only)
    const polygonCoords = coordinates[0].map((c) => `${c.longitude} ${c.latitude}`).join(',');
    const wktPolygon = `POLYGON((${polygonCoords}))`;

    const result = await db.query(
      `UPDATE territories
       SET geometry = ST_GeomFromText($1, 4326),
           coordinates = $2,
           area_sq_meters = $3,
           created_at = NOW()
       WHERE territory_id = $4 AND user_id = $5
       RETURNING territory_id, created_at`,
      [wktPolygon, JSON.stringify(coordinates), newArea, territory_id, userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Territory not found or not owned by user' });
    }

    // Resolve overlaps (logs takeover_gain/loss and returns captured area)
    const capturedM2 = await adjustOverlapsForFriends(userId, territory_id);

    // Log XP: expand only for non-stolen growth (avoids double counting)
    const expandNonStolen = Math.max(0, delta - capturedM2);
    if (expandNonStolen > 0) {
      await logXpEvent({
        userId,
        territoryId: territory_id,
        eventType: 'expand',
        deltaAreaM2: expandNonStolen,
      });
    }

    res.json({ success: true, territory_id: result.rows[0].territory_id, created_at: result.rows[0].created_at });
  } catch (error) {
    console.error('Error updating territory:', error);
    res.status(500).json({ success: false, error: 'Failed to update territory' });
  }
});

module.exports = router;
