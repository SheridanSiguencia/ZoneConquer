// app/(tabs)/map.tsx
// Ride screen with distance, privacy mask, loop detection → Paper.io-style
// growing territory, raw path recording, simulator routes, and arrow controls.

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dissolve from '@turf/dissolve';
import { featureCollection } from '@turf/helpers';
import * as turf from '@turf/turf';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Polygon as MapPolygon,
  Marker,
  Polyline,
} from 'react-native-maps';

import { useUserStore } from '../../store/user';
import { useFocusEffect } from '@react-navigation/native';

import type {
  Feature,
  Polygon as GeoPolygon,
  MultiPolygon,
} from 'geojson';

// tiny types
type LatLng = { latitude: number; longitude: number };
type XY = { x: number; y: number };
type TerritoryFeature = Feature<GeoPolygon | MultiPolygon>;

// thresholds for what counts as a "real" loop
const MIN_PERIMETER_M = 80;
const MIN_AREA_M2 = 800;
const MIN_RING_POINTS = 4;
const CLOSE_EPS_M = 12;

// local storage keys
// const LOOPS_KEY = 'zoneconquer_loops_v1';
// const CURRENT_PATH_KEY = 'zoneconquer_current_path_v1'; //going to make it save based on user session 
const getCurrentPathKey = (userId: string) => 
  `zoneconquer_current_path_v1_${userId}`;

type SavedRide = {
  path: LatLng[];
  distanceMeters: number;
  maskOffset: { dLat: number; dLon: number } | null;
};

// allow turning privacy mask off via env if you want
const DEFAULT_MASK =
  (process.env.EXPO_PUBLIC_MASK_LOCATION ?? 'true').toString() === 'true';

// how far arrow buttons move per tap (meters in local XY)
const ARROW_STEP_M = 20;

// quick distance between two lat/lngs (meters)
const haversineMeters = (a: LatLng, b: LatLng) => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export default function MapScreen() {
  // make user is signed in for debugging will delete later
  useEffect(() => {
    console.log('🔗 FULL API URL DEBUG:');
    console.log('Base URL:', process.env.EXPO_PUBLIC_API_BASE);
    console.log(
      'Test URL:',
      `${process.env.EXPO_PUBLIC_API_BASE}/territories/test-session`,
    );
    console.log(
      'Save URL:',
      `${process.env.EXPO_PUBLIC_API_BASE}/territories/save`,
    );
  }, []);
  // using zustand
  const { user, fetchUserStats, updateDistance, stats } = useUserStore();
  const [current, setCurrent] = useState<LatLng | null>(null);

  const [allTerritories, setAllTerritories] = useState<{
    territory_id: string;
    coordinates: LatLng[][];
    username: string;
    user_id: string;
    area_sq_meters: number;
    created_at: string;
  }[]>([]);

  // breadcrumb line you're drawing this session
  const [path, setPath] = useState<LatLng[]>([]);
  // distance accumulator (meters)
  const [distanceMeters, setDistanceMeters] = useState(0);
  // privacy + tracking toggles
  const [maskLocation, setMaskLocation] =
   
    useState<boolean>(DEFAULT_MASK);
  const [isTracking, setIsTracking] = useState(false);
  // raw loops for stats/debug only
  const [loops, setLoops] = useState<LatLng[][]>([]);
  // merged Paper.io-style territory + area;
  const [territory, setTerritory] =
    useState<TerritoryFeature | null>(null);
  const [totalAreaM2, setTotalAreaM2] = useState(0);

  // rawPaths sessions
  const [sessions, setSessions] = useState<WalkSession[]>([]);

  // Dont send too little to backend
  const accumulatedDistanceRef = useRef(0);

  // simulator state
  const [isSimulating, setIsSimulating] = useState(false);

  // refs
  const watchRef = useRef<Location.LocationSubscription | null>(
    null,
  );
  const maskRef = useRef<{ dLat: number; dLon: number } | null>(
    null,
  );
  // skip first mask effect run (on mount) so we don't clobber restored rides
  const isFirstMaskEffectRef = useRef(true);
  const originRef = useRef<{
    lat: number;
    lon: number;
    mPerDegLat: number;
    mPerDegLon: number;
  } | null>(null);
  const xyRef = useRef<XY[]>([]);

  const sessionsRef = useRef<WalkSession[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  // Paper.io tail logic: track in/out-of-territory + the current "tail"
  const lastInsideRef = useRef<boolean>(false);
  const tailRef = useRef<LatLng[]>([]);

  // Paper.io cut state (leaving & re-entering territory)
  const cutStateRef = useRef<{
    isOutside: boolean;
    exitPoint: LatLng | null;
    path: LatLng[];
    lastInside: boolean | null;
  }>({
    isOutside: false,
    exitPoint: null,
    path: [],
    lastInside: null,
  });

  const resetCutState = () => {
    cutStateRef.current = {
      isOutside: false,
      exitPoint: null,
      path: [],
      lastInside: null,
    };
  };

  // track if we restored an unfinished ride this mount
  const hasRestoredCurrentPathRef = useRef(false);
  // track if there's an unfinished ride we can resume
  const [hasUnfinishedRide, setHasUnfinishedRide] = useState(false);

  // coordinate transforms (local meters ↔ latlng)
  const toXY = (p: LatLng): XY => {
    if (!originRef.current) {
      const mPerDegLat = 111111;
      const mPerDegLon =
        111111 * Math.cos((p.latitude * Math.PI) / 180);
      originRef.current = {
        lat: p.latitude,
        lon: p.longitude,
        mPerDegLat,
        mPerDegLon,
      };
    }
    const o = originRef.current!;
    return {
      x: (p.longitude - o.lon) * o.mPerDegLon,
      y: (p.latitude - o.lat) * o.mPerDegLat,
    };
  };

  const toLatLng = (xy: XY): LatLng => {
    const o = originRef.current!;
    return {
      latitude: o.lat + xy.y / o.mPerDegLat,
      longitude: o.lon + xy.x / o.mPerDegLon,
    };
  };

  // apply current mask offset to a raw lat/lng
  const mask = (p: LatLng): LatLng => {
    if (!maskLocation || !maskRef.current) return p;
    return {
      latitude: p.latitude + maskRef.current.dLat,
      longitude: p.longitude + maskRef.current.dLon,
    };
  };

  // hard reset breadcrumb after a successful capture/cut
  const hardResetBreadcrumb = (anchor: LatLng) => {
    originRef.current = null;
    xyRef.current = [toXY(anchor)];
    setPath([anchor]);
  };

  const loadAllTerritories = async () => {
    console.log('🔄 loadAllTerritories CALLED');
  
    if (!user) {
      console.log('❌ No user in loadAllTerritories');
      return;
    }
  
    try {
      console.log('🌐 Fetching territories from API...');
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_BASE}/territories/my-territories`,
        {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        }
      );
  
      const result = await response.json();
  
      if (result.success) {
        console.log('✅ Setting territories to state:', result.territories.length);
        setAllTerritories(result.territories);
      } else {
        console.warn('API error:', result.error);
      }
    } catch (error) {
      console.warn('Fetch error:', error);
    }
  };
  // ---------- load saved stuff on mount ----------

  /*
  // load saved territory once on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOOPS_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          loops?: LatLng[][];
          totalAreaM2?: number;
          territory?: TerritoryFeature;
        };

        if (Array.isArray(parsed.loops)) setLoops(parsed.loops);
        if (typeof parsed.totalAreaM2 === 'number')
          setTotalAreaM2(parsed.totalAreaM2);
        if (parsed.territory) setTerritory(parsed.territory);
      } catch (e) {
        console.warn('failed to load saved territory', e);
      }
    })();
  }, []);

  // load rawPaths sessions once on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await loadSessions();
        setSessions(stored);
        sessionsRef.current = stored;
      } catch (e) {
        console.warn('failed to load raw sessions', e);
      }
    })();
  }, []);
*/
  // restore unfinished ride (path + distance + mask offset) on mount
  useEffect(() => {
    if (!user?.user_id) return;
    (async () => {
      try {
        const key = getCurrentPathKey(user.user_id);
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
  
        const saved: SavedRide = JSON.parse(raw);
        if (!saved.path || saved.path.length === 0) return;
  
        if (maskLocation && saved.maskOffset) {
          maskRef.current = saved.maskOffset;
        }
  
        originRef.current = null;
        xyRef.current = [];
        xyRef.current = saved.path.map((p) => toXY(p));
  
        setPath(saved.path);
        setCurrent(saved.path[saved.path.length - 1]);
  
        if (typeof saved.distanceMeters === 'number') {
          setDistanceMeters(saved.distanceMeters);
        }
  
        hasRestoredCurrentPathRef.current = true;
        setHasUnfinishedRide(true);
  
        console.log(
          '[currentPath] restored',
          saved.path.length,
          'points for user',
          user.user_id,
        );
      } catch (e) {
        console.warn('failed to load unfinished ride', e);
      }
    })();
  }, [user?.user_id]);
    // Save territories to the database
 // Use YOUR OLD version (lines 120-165 in old_map.tsx)
const saveTerritoryToDB = async (loop: LatLng[], areaM2: number) => {
  if (!user) {
    console.log('User not logged in, skipping territory save');
    return;
  }

  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_API_BASE}/territories/save`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          coordinates: [loop],
          area_sq_meters: areaM2,
        }),
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('✅ Territory saved to database:', result.territory_id);
      loadAllTerritories(); // ✅ This reloads from DB
    } else {
      console.warn('❌ Failed to save territory:', result.error);
    }
  } catch (error) {
    console.warn('❌ Error saving territory:', error);
  }
};

  // ---------- react to mask toggle ----------

  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🗺️ Map tab focused - loading territories for user:', user.user_id);
        loadAllTerritories();
      }
      return () => {
        console.log('🗺️ Map tab unfocused');
      };
    }, [user]),
  );

  useEffect(() => {
    if (user) {
      console.log('👤 User logged in, testing territory load...');
      loadAllTerritories();
    }
  }, [user]);

  useEffect(() => {
    // Skip the very first run on mount so we don't clobber any restored ride.
    if (isFirstMaskEffectRef.current) {
      isFirstMaskEffectRef.current = false;
      return;
    }

    const init = async () => {
      // stop everything and clear breadcrumb
      stopTracking();
      stopSim();
      endActiveSession();
      resetCutState();

      originRef.current = null;
      xyRef.current = [];
      setPath([]);
      setDistanceMeters(0);

      const applyOffsetAndSetFirstPoint = (raw: LatLng) => {
        if (maskLocation) {
          // Teleport a few miles away (2–5 mi) in a random direction
          const minMiles = 2;
          const maxMiles = 5;
          const distanceMiles =
            minMiles + Math.random() * (maxMiles - minMiles);
          const distanceM = distanceMiles * 1609.34;
          const angle = Math.random() * Math.PI * 2;

          const metersPerDegLat = 111111;
          const metersPerDegLon =
            111111 *
            Math.cos((raw.latitude * Math.PI) / 180);

          const dLat =
            (distanceM * Math.cos(angle)) / metersPerDegLat;
          const dLon =
            (distanceM * Math.sin(angle)) / metersPerDegLon;

          maskRef.current = { dLat, dLon };

          console.log(
            '[mask] new offset (mi):',
            distanceMiles.toFixed(2),
          );
        } else {
          // mask off → no offset, real location
          maskRef.current = null;
        }

        const first = mask(raw);
        setCurrent(first);
        setPath([first]);
        xyRef.current = [toXY(first)];
      };

      try {
        const { status } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          console.warn(
            '[location] permission / getCurrentPosition failed, using fallback',
          );
          const fallback: LatLng = {
            latitude: 40.7812,
            longitude: -73.9665,
          };
          applyOffsetAndSetFirstPoint(fallback);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        const raw: LatLng = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        applyOffsetAndSetFirstPoint(raw);
      } catch (e) {
        console.warn(
          '[location] permission / getCurrentPosition failed, using fallback',
          e,
        );
        const fallback: LatLng = {
          latitude: 40.7812,
          longitude: -73.9665,
        };
        applyOffsetAndSetFirstPoint(fallback);
      }
    };

    init();

    return () => {
      stopTracking();
      stopSim();
      endActiveSession();
      resetCutState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskLocation]);

  // ---------- persistence ----------

  /*
  // persist merged territory when NOT masked
  useEffect(() => {
    (async () => {
      try {
        if (!maskLocation) {
          if (loops.length || totalAreaM2 > 0 || territory) {
            await AsyncStorage.setItem(
              LOOPS_KEY,
              JSON.stringify({ loops, totalAreaM2, territory }),
            );
          } else {
            await AsyncStorage.removeItem(LOOPS_KEY);
          }
        }
      } catch (e) {
        console.warn('failed to save territory', e);
      }
    })();
  }, [loops, totalAreaM2, territory, maskLocation]);
  */

  // persist unfinished ride breadcrumb
  useEffect(() => {
    if (!user?.user_id) return;
    
    (async () => {
      try {
        const key = getCurrentPathKey(user.user_id);
        
        if (!current || path.length === 0) {
          await AsyncStorage.removeItem(key);
          setHasUnfinishedRide(false);
          return;
        }
  
        const maskOffset =
          maskLocation && maskRef.current ? maskRef.current : null;
  
        const toSave: SavedRide = {
          path,
          distanceMeters,
          maskOffset,
        };
  
        await AsyncStorage.setItem(key, JSON.stringify(toSave));
        console.log('[currentPath] saved for user', user.user_id);
      } catch (e) {
        console.warn('failed to save unfinished ride', e);
      }
    })();
  }, [current, path, distanceMeters, maskLocation, user?.user_id]);

  // ---------- rawPaths helpers ----------

  const persistSessions = async (next: WalkSession[]) => {
    setSessions(next);
    sessionsRef.current = next;
    try {
      await saveSessions(next);
    } catch (error) {
      console.warn('failed to save raw sessions', error);
    }
  };

  const ensureSessionStarted = () => {
    if (activeSessionIdRef.current) return;

    const now = Date.now();
    const points: PathPoint[] = [];

    if (current) {
      points.push({
        lat: current.latitude,
        lng: current.longitude,
        t: now,
      });
    }

    const session: WalkSession = {
      id: String(now),
      startedAt: now,
      endedAt: null,
      points,
      loops: [],
    };

    const next = [...sessionsRef.current, session];
    activeSessionIdRef.current = session.id;
    persistSessions(next);
  };

  const appendRawPoint = (p: LatLng, t: number) => {
    if (!activeSessionIdRef.current) return;
    const id = activeSessionIdRef.current;
    const prev = sessionsRef.current;

    const next = prev.map((s) =>
      s.id === id
        ? {
            ...s,
            points: [
              ...s.points,
              { lat: p.latitude, lng: p.longitude, t },
            ],
          }
        : s,
    );

    persistSessions(next);
  };

  const addLoopSummary = (areaSqMeters: number) => {
    if (!activeSessionIdRef.current) return;

    const id = activeSessionIdRef.current;
    const prev = sessionsRef.current;
    const closedAt = Date.now();

    const next = prev.map((s) =>
      s.id === id
        ? {
            ...s,
            loops: [
              ...s.loops,
              {
                id: `${id}-loop-${s.loops.length + 1}`,
                closedAt,
                areaSqMeters,
              },
            ],
          }
        : s,
    );

    persistSessions(next);
  };

  const endActiveSession = () => {
    if (!activeSessionIdRef.current) return;

    const id = activeSessionIdRef.current;
    activeSessionIdRef.current = null;

    const prev = sessionsRef.current;
    const endedAt = Date.now();

    const next = prev.map((s) =>
      s.id === id && s.endedAt == null ? { ...s, endedAt } : s,
    );

    persistSessions(next);

    const finished = next.find((s) => s.id === id);
    const numPoints = finished?.points.length ?? 0;
    const numLoops = finished?.loops.length ?? 0;

    console.log(
      '[rawPaths] ended session',
      id,
      'points:',
      numPoints,
      'loops:',
      numLoops,
    );
  };

  // ---------- merge loops into territory (Paper.io blob) ----------

  // helper: extract plain Polygon geometries from the current territory
  function extractPolygons(
    t: TerritoryFeature | null,
  ): GeoPolygon[] {
    if (!t || !t.geometry) return [];

    const g = t.geometry;

    if (g.type === 'Polygon') {
      return [g];
    }

    if (g.type === 'MultiPolygon') {
      return g.coordinates.map(
        (coords) =>
          ({

            type: 'Polygon',
            coordinates: coords,
          } as GeoPolygon),
      );
    }

    return [];
  }

  function mergeLoopIntoTerritory(loop: LatLng[]) {
    if (loop.length < 3) return;
  
    // LatLng[] → GeoJSON ring [ [lng, lat], ... ]
    const ring: [number, number][] = loop.map((p) => [
      p.longitude,
      p.latitude,
    ]);
    if (!ring.length) return;
  
    // ensure closed ring
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first] as [number, number]);
    }
  
    const loopPoly = turf.polygon([ring]) as TerritoryFeature;
    const loopArea = turf.area(loopPoly);
  
    if (loopArea <= 0) {
      console.warn('[territory] new loop has zero area, skipping');
      return;
    }
  
    // 🔹 No existing territory → this is the first island
    const existingPolys = extractPolygons(territory);
    if (existingPolys.length === 0 || totalAreaM2 <= 0) {
      console.log(
        '[territory] setting FIRST loop, area m2 =',
        loopArea,
      );
      setTerritory(loopPoly);
      setTotalAreaM2(loopArea);
      return;
    }

    // 🔹 Build an array of polygon features = existing + new loop
    const polyFeatures: TerritoryFeature[] = [
      ...existingPolys.map((p) =>
        turf.polygon(p.coordinates) as TerritoryFeature,
      ),
      loopPoly,
    ];

    let acc: TerritoryFeature | null = null;

    try {
      const fc = featureCollection(
        polyFeatures as any,
      ) as any; // FeatureCollection<Polygon>
      const dissolved = dissolve(fc as any) as any;

      if (
        dissolved &&
        dissolved.features &&
        dissolved.features.length > 0
      ) {
        acc = dissolved.features[0] as TerritoryFeature;
      } else {
        console.warn(
          '[territory] dissolve returned no features, keeping previous territory',
        );
        return;
      }
    } catch (err) {
      console.warn(
        '[territory] dissolve failed, keeping previous territory',
        err,
      );
      return;
    }

    if (!acc) return;

    const mergedArea = turf.area(acc as any);

    // safety: never let area shrink due to a bad dissolve
    if (mergedArea + 1 < totalAreaM2) {
      console.warn(
        '[territory] merged area smaller than existing, ignoring this loop',
        { prev: totalAreaM2, merged: mergedArea },
      );
      return;
    }

    console.log('[territory] merged via dissolve, area =', mergedArea);

    console.log(
      '[territory-debug] MERGED GEOM',
      acc.geometry?.type,
      acc.geometry?.type === 'Polygon'
        ? (acc.geometry.coordinates[0] || [])
            .slice(0, 10)
            .map(([lng, lat]) => ({

              lat: Number(lat.toFixed(6)),
              lon: Number(lng.toFixed(6)),
            }))
        : acc.geometry?.type === 'MultiPolygon'
        ? 'MultiPolygon with ' +
          acc.geometry.coordinates.length +
          ' parts'
        : null,
    );

    setTerritory(acc);
    setTotalAreaM2(mergedArea);
  }

  // ---------- Paper.io cut logic (use existing territory edge as a side) ----------

  function processPaperCut(prev: LatLng, curr: LatLng) {
    if (!territory || !territory.geometry) {
      resetCutState();
      return;
    }

    const polys = extractPolygons(territory);
    if (!polys.length) return;
    const poly = polys[0]; // use primary polygon

    const ptPrev = turf.point([prev.longitude, prev.latitude]);
    const ptCurr = turf.point([curr.longitude, curr.latitude]);

    const insidePrev = turf.booleanPointInPolygon(
      ptPrev as any,
      poly as any,
    );
    const insideNow = turf.booleanPointInPolygon(
      ptCurr as any,
      poly as any,
    );

    const seg = turf.lineString([
      [prev.longitude, prev.latitude],
      [curr.longitude, curr.latitude],
    ]);

    const inter = turf.lineIntersect(seg as any, poly as any) as any;
    let intersectionLL: LatLng | null = null;
    if (inter && inter.features && inter.features.length > 0) {
      const g = inter.features[0].geometry;
      if (g && g.type === 'Point') {
        const [lng, lat] = g.coordinates;
        intersectionLL = { latitude: lat, longitude: lng };
      }
    }

    const state = cutStateRef.current;

    // leaving territory → start cut
    if (!state.isOutside && insidePrev && !insideNow) {
      const exitPoint = intersectionLL ?? prev;
      state.isOutside = true;
      state.exitPoint = exitPoint;
      state.path = [exitPoint, curr];
      state.lastInside = insideNow;

      console.log('[cut] EXIT at', exitPoint);
      return;
    }

    // currently outside: accumulate path & look for re-entry
    if (state.isOutside) {
      state.path.push(curr);

      if (!insidePrev && insideNow && state.exitPoint) {
        const entryPoint = intersectionLL ?? curr;
        // ensure last point is the entry point
        state.path[state.path.length - 1] = entryPoint;

        console.log('[cut] ENTER at', entryPoint);

        const cutLoop = buildCutLoop(
          state.exitPoint,
          entryPoint,
          state.path,
          poly,
        );

        if (cutLoop && cutLoop.length >= MIN_RING_POINTS) {
          const xy = cutLoop.map((ll) => toXY(ll));
          const area = polygonArea(xy);

          console.log('[cut-loop]', {
            points: cutLoop.length,
            area,
            hasTerritory: !!territory,
          });

          if (area >= MIN_AREA_M2) {
            addLoopSummary(area);
            mergeLoopIntoTerritory(cutLoop);
            setLoops((prev) => [...prev, cutLoop]);

            // 🧹 trim breadcrumbs after a successful cut
            hardResetBreadcrumb(entryPoint);
          }
        }

        resetCutState();
      } else {
        state.lastInside = insideNow;
      }

      return;
    }

    // not outside, just keep track
    cutStateRef.current.lastInside = insideNow;
  }

  function buildCutLoop(
    exitPoint: LatLng,
    entryPoint: LatLng,
    cutPath: LatLng[],
    poly: GeoPolygon,
  ): LatLng[] | null {
    const ring = poly.coordinates[0];
    if (!ring || ring.length < 4) return null;

    const ringLL: LatLng[] = ring.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));

    const idxExit = nearestRingIndex(ringLL, exitPoint);
    const idxEntry = nearestRingIndex(ringLL, entryPoint);
    if (idxExit === -1 || idxEntry === -1) return null;

    const n = ringLL.length;

    // entry → exit going forward along ring
    const forward: LatLng[] = [];
    let i = idxEntry;
    while (true) {
      forward.push(ringLL[i]);
      if (i === idxExit) break;
      i = (i + 1) % n;
    }

    // entry → exit going backward along ring
    const backward: LatLng[] = [];
    i = idxEntry;
    while (true) {
      backward.push(ringLL[i]);
      if (i === idxExit) break;
      i = (i - 1 + n) % n;
    }

    const boundary =
      forward.length <= backward.length ? forward : backward;

    // ensure cutPath starts at exit and ends at entry
    const path: LatLng[] = [...cutPath];
    if (!almostEqualLatLng(path[0], exitPoint)) {
      path.unshift(exitPoint);
    }
    if (!almostEqualLatLng(path[path.length - 1], entryPoint)) {
      path.push(entryPoint);
    }

    const loop: LatLng[] = [];

    // exit → entry via outside path
    for (let k = 0; k < path.length; k++) {
      loop.push(path[k]);
    }

    // entry → exit along territory boundary (skip first, which ≈ entry)
    for (let k = 1; k < boundary.length; k++) {
      loop.push(boundary[k]);
    }

    // close ring
    if (!almostEqualLatLng(loop[0], loop[loop.length - 1])) {
      loop.push(loop[0]);
    }

    return loop;
  }

  function nearestRingIndex(ring: LatLng[], target: LatLng): number {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const dLat = ring[i].latitude - target.latitude;
      const dLon = ring[i].longitude - target.longitude;
      const d = dLat * dLat + dLon * dLon;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function almostEqualLatLng(a: LatLng, b: LatLng, eps = 1e-6) {
    return (
      Math.abs(a.latitude - b.latitude) < eps &&
      Math.abs(a.longitude - b.longitude) < eps
    );
  }

  // ---------- Paper.io-style tail → territory merge ----------

  const applyPaperIoTailLogic = (p: LatLng) => {
    if (!territory) {
      // no territory yet → nothing to do
      lastInsideRef.current = false;
      tailRef.current = [];
      return;
    }

    // Is this point inside the current territory?
    const pt = turf.point([p.longitude, p.latitude]);
    const inside = turf.booleanPointInPolygon(pt, territory as any);
    const wasInside = lastInsideRef.current;

    console.log('[paperio-tail-state]', {
      lat: p.latitude.toFixed(6),
      lon: p.longitude.toFixed(6),
      wasInside,
      inside,
    });

    // 1) Leaving territory → start a new tail
    if (wasInside && !inside) {
      tailRef.current = [p];
    }
    // 2) Still outside → grow tail
    else if (!wasInside && !inside) {
      tailRef.current.push(p);
    }
    // 3) Re-entering territory → close the tail and merge
    else if (!wasInside && inside) {
      console.log('[paperio] re-enter territory, closing tail');

      if (tailRef.current.length >= 3) {
        const rawLoop = [...tailRef.current];

        // 🔒 Close the loop by repeating the first point at the end
        const loop = almostEqualLatLng(
          rawLoop[0],
          rawLoop[rawLoop.length - 1],
        )
          ? rawLoop
          : [...rawLoop, rawLoop[0]];

        // Re-use the same validation as self-intersection loops
        if (validateLoop(loop)) {
          const areaM2 = polygonArea(loop.map((ll) => toXY(ll)));
          addLoopSummary(areaM2);

          console.log('[paperio-loop]', {
            points: loop.length,
            area: areaM2,
          });

          mergeLoopIntoTerritory(loop);
          setLoops((prev) => [...prev, loop]);

          // 🧹 clear old trails after a capture, keep only current point
          hardResetBreadcrumb(p);
        }
      }

      // Tail is consumed once we've merged (or decided not to)
      tailRef.current = [];
    }

    // Update state for the next step
    lastInsideRef.current = inside;
  };

  // ---------- handle a newly observed point ----------

  const handleNewPoint = (p: LatLng, accuracy: number = 5) => {
    const t = Date.now();
    let accepted = false;
    const prevForCut = current;

    setCurrent(p);
    setPath((prev) => {
      if (prev.length === 0) {
        xyRef.current = [toXY(p)];
        accepted = true;
        return [p];
      }

      const last = prev[prev.length - 1];
      const delta = haversineMeters(last, p);

      const badAccuracy = accuracy > 50;
      const tooSmall = delta < 3; // jitter
      const tooLarge = delta > 200; // spikes

      if (!badAccuracy && !tooSmall && !tooLarge) {
        const xy = toXY(p);
        xyRef.current = [...xyRef.current, xy];
        setDistanceMeters((d) => d + delta);

        // try to close a self-loop (path-only)
        const closure = findClosure(xyRef.current);
        if (closure) {
          const loop = buildLoopLatLng(closure);

          console.log('[loop-debug] CLOSURE', {
            type: closure.type,
            startIdx: closure.startIdx,
            endIdx: closure.endIdx,
            atXY: {
              x: Number(closure.at.x.toFixed(2)),
              y: Number(closure.at.y.toFixed(2)),
            },
            xyLength: xyRef.current.length,
          });

          console.log(
            '[loop-debug] LOOP LATLNG',
            loop.map((pt, idx) => ({

              i: idx,
              lat: Number(pt.latitude.toFixed(6)),
              lon: Number(pt.longitude.toFixed(6)),
            })),
          );

          if (validateLoop(loop)) {
            const areaM2 = polygonArea(loop.map((ll) => toXY(ll)));
            addLoopSummary(areaM2);

            console.log(
              '[loop-debug] BEFORE MERGE path length',
              xyRef.current.length,
            );

            mergeLoopIntoTerritory(loop);

            // ✅ keep full path so future loops can reuse old sides
            setLoops((prevLoops) => [...prevLoops, loop]);
            accepted = true;
            return [...prev, p];
          }
        }

        accepted = true;
        return [...prev, p];
      }

      return prev;
    });

    if (accepted) {
      ensureSessionStarted();
      appendRawPoint(p, t);

      // ✅ Paper.io tail logic: leave territory, wander, re-enter
      applyPaperIoTailLogic(p);

      // ✅ Paper.io cut detection (loops that use existing territory edge)
      if (prevForCut && territory) {
        processPaperCut(prevForCut, p);
      }
    }
  };

  // ---------- GPS tracking ----------

  const startTracking = async () => {
    if (watchRef.current) return;
    stopSim();

    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('[location] tracking permission not granted');
        return;
      }
    } catch (e) {
      console.warn('[location] startTracking permission error', e);
      return;
    }

    ensureSessionStarted();
    setHasUnfinishedRide(false);
    setIsTracking(true);

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 2000,
        distanceInterval: 5,
      },
      (loc) => {
        const raw = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        const pt = mask(raw);
        handleNewPoint(pt, loc.coords.accuracy ?? 5);
      },
    );
  };

  const stopTracking = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsTracking(false);
  };

  // ---------- simulator ----------

  type SimRouteName =
    | 'campusSquare'
    | 'bigLoop'
    | 'triangle'
    | 'nearGate'
    | 'figure8'
    | 'skinnyRibbon';

  const [routeName, setRouteName] =
    useState<SimRouteName>('campusSquare');

  const ROUTE_ORDER: SimRouteName[] = [
    'campusSquare',
    'bigLoop',
    'triangle',
    'nearGate',
    'figure8',
    'skinnyRibbon',
  ];

  const ROUTE_LABEL: Record<SimRouteName, string> = {
    campusSquare: 'campus',
    bigLoop: 'big loop',
    triangle: 'triangle',
    nearGate: 'near gate',
    figure8: 'figure-8',
    skinnyRibbon: 'ribbon',
  };

  const ROUTES_XY: Record<SimRouteName, XY[]> = {
    campusSquare: [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: -120 },
      { x: 0, y: -120 },
      { x: 0, y: 0 },
    ],
    bigLoop: [
      { x: 0, y: 0 },
      { x: 200, y: 20 },
      { x: 240, y: -120 },
      { x: 120, y: -220 },
      { x: -40, y: -180 },
      { x: -60, y: -40 },
      { x: 0, y: 0 },
    ],
    triangle: [
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      { x: 80, y: -140 },
      { x: 0, y: 0 },
    ],
    nearGate: [
      { x: 0, y: 0 },
      { x: 90, y: 10 },
      { x: 110, y: -60 },
      { x: 40, y: -100 },
      { x: -50, y: -60 },
      { x: -40, y: -10 },
      { x: 0, y: 0 },
    ],
    figure8: [
      { x: 0, y: 0 },
      { x: 80, y: -40 },
      { x: 0, y: -80 },
      { x: -80, y: -40 },
      { x: 0, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 80 },
      { x: -80, y: 40 },
      { x: 0, y: 0 },
    ],
    skinnyRibbon: [
      { x: 0, y: 0 },
      { x: 160, y: 0 },
      { x: 160, y: -30 },
      { x: 0, y: -30 },
      { x: 0, y: 0 },
    ],
  };

  function densify(vertices: XY[], step = 10) {
    const out: XY[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i];
      const b = vertices[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++) {
        out.push({
          x: a.x + (dx * k) / n,
          y: a.y + (dy * k) / n,
        });
      }
    }
    out.push(vertices[vertices.length - 1]);
    return out;
  }

  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const simIndexRef = useRef(0);
  const simRouteRef = useRef<LatLng[] | null>(null);

  const startSim = () => {
    if (isSimulating || !current) return;
    stopTracking();
    setIsSimulating(true);

    // shift the chosen route so it starts at your current spot
    const base = toXY(current);
    const raw = ROUTES_XY[routeName];
    const shifted = raw.map((p) => ({
      x: p.x + base.x,
      y: p.y + base.y,
    }));
    const dense = densify(shifted, 10);
    const latlngRoute = dense.map(toLatLng);

    simRouteRef.current = latlngRoute;
    simIndexRef.current = 0;

    simTimerRef.current = setInterval(() => {
      const route = simRouteRef.current;
      if (!route) return;
      const i = simIndexRef.current;
      if (i >= route.length) {
        simIndexRef.current = 0;
        return;
      }
      handleNewPoint(route[i], 5);
      simIndexRef.current = i + 1;
    }, 250);
  };

  const stopSim = () => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = null;
    simRouteRef.current = null;
    setIsSimulating(false);
  };

  // ---------- Arrow controls (fake movement, counts as sessions) ----------

  const nudgeCurrent = (dxMeters: number, dyMeters: number) => {
    if (!current) return;

    ensureSessionStarted();

    if (!originRef.current) {
      const mPerDegLat = 111111;
      const mPerDegLon =
        111111 * Math.cos((current.latitude * Math.PI) / 180);
      originRef.current = {
        lat: current.latitude,
        lon: current.longitude,
        mPerDegLat,
        mPerDegLon,
      };
    }

    const lastXY = toXY(current);
    const nextXY: XY = {
      x: lastXY.x + dxMeters,
      y: lastXY.y + dyMeters,
    };
    const next = toLatLng(nextXY);

    console.log('[arrow] move', {
      from: {
        lat: Number(current.latitude.toFixed(6)),
        lon: Number(current.longitude.toFixed(6)),
      },
      to: {
        lat: Number(next.latitude.toFixed(6)),
        lon: Number(next.longitude.toFixed(6)),
      },
      dxMeters,
      dyMeters,
    });

    handleNewPoint(next, 5);
  };

  // ---------- HUD helpers ----------

  const toggleMask = () => {
    setMaskLocation((m) => !m);
  };

  const distanceMi = distanceMeters / 1609.344;

  const isResumeAvailable =
    hasUnfinishedRide &&
    path.length > 0 &&
    !isTracking &&
    !isSimulating;

  const region = {
    latitude: current?.latitude ?? 40.7812,
    longitude: current?.longitude ?? -73.9665,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // ---------- loop helpers ----------

  function findClosure(xy: XY[]) {
    const n = xy.length;
    if (n < 4) return null;

    const a = xy[n - 2];
    const b = xy[n - 1];

    // snap to very first point
    const dx0 = b.x - xy[0].x;
    const dy0 = b.y - xy[0].y;
    if (dx0 * dx0 + dy0 * dy0 <= CLOSE_EPS_M * CLOSE_EPS_M) {
      return {
        type: 'snap' as const,
        at: xy[0],
        startIdx: 0,
        endIdx: n - 1,
      };
    }

    // intersection with older segment
    for (let i = 0; i < n - 3; i++) {
      const c = xy[i];
      const d = xy[i + 1];
      const hit = segIntersect(a, b, c, d);
      if (hit)
        return {
          type: 'intersect' as const,
          at: hit,
          startIdx: i + 1,
          endIdx: n - 1,
        };
    }

    // snap to any earlier vertex
    const closeIdx = findNearbyVertex(xy, CLOSE_EPS_M);
    if (closeIdx !== -1 && closeIdx < n - 3) {
      return {
        type: 'snap' as const,
        at: xy[closeIdx],
        startIdx: closeIdx,
        endIdx: n - 1,
      };
    }

    return null;
  }

  function segIntersect(p: XY, p2: XY, q: XY, q2: XY): XY | null {
    const r = { x: p2.x - p.x, y: p2.y - p.y };
    const s = { x: q2.x - q.x, y: q2.y - q.y };
    const rxs = r.x * s.y - r.y * s.x;
    const qpxr = (q.x - p.x) * r.y - (q.y - p.y) * r.x;
    if (Math.abs(rxs) < 1e-9 && Math.abs(qpxr) < 1e-9) return null;
    if (Math.abs(rxs) < 1e-9 && Math.abs(qpxr) >= 1e-9) return null;

    const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / rxs;
    const u = ((q.x - p.x) * r.y - (q.y - p.y) * r.x) / rxs;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: p.x + t * r.x, y: p.y + t * r.y };
    }
    return null;
  }

  function findNearbyVertex(xy: XY[], epsM: number) {
    const n = xy.length;
    const last = xy[n - 1];
    for (let i = 0; i < n - 2; i++) {
      const dx = xy[i].x - last.x;
      const dy = xy[i].y - last.y;
      if (dx * dx + dy * dy <= epsM * epsM) return i;
    }
    return -1;
  }

  function buildLoopLatLng(closure: {
    type: 'intersect' | 'snap';
    at: XY;
    startIdx: number;
    endIdx: number;
  }): LatLng[] {
    const ringXY: XY[] = [];
    ringXY.push(closure.at);
    for (let i = closure.startIdx; i <= closure.endIdx; i++)
      ringXY.push(xyRef.current[i]);
    ringXY.push(closure.at);
    const simplified = rdp(ringXY, 2);
    return simplified.map(toLatLng);
  }

  function validateLoop(loop: LatLng[]) {
    if (loop.length < MIN_RING_POINTS) return false;
  
    const xy = loop.map(toXY);
    const peri = pathLength(xy);
    const area = polygonArea(xy);
  
    console.log('[loop] validation:', {
      points: loop.length,
      perimeter: peri,
      area,
      hasTerritory: !!territory,
    });
  
    // First loop: always accept (Paper.io "initial island")
    if (!territory) {
      console.log('[loop] accepting as FIRST territory loop');
      
      // Save to DB when it's the first territory (if not masked)
      if (!maskLocation) {
        console.log('[loop] Calling saveTerritoryToDB...');
        saveTerritoryToDB(loop, area);
      } else {
        console.log('[loop] Skipping DB save because maskLocation is ON');
      }
      
      return true;
    }
  
    // Later loops must be "big enough"
    if (peri < MIN_PERIMETER_M) {
      console.log('[loop] Rejected: perimeter too small', peri, '<', MIN_PERIMETER_M);
      return false;
    }
    if (area < MIN_AREA_M2) {
      console.log('[loop] Rejected: area too small', area, '<', MIN_AREA_M2);
      return false;
    }
  
    // doesnt save merged territories to backend! it acts as separate entities but may change to updating in future
    // The frontend will merge them visually, but we don't want duplicate DB records
    console.log('[loop] Accepting but NOT saving to DB (will be merged locally)');
    
    return true;
  }

  function pathLength(xy: XY[]) {
    let sum = 0;
    for (let i = 1; i < xy.length; i++) {
      sum += Math.hypot(
        xy[i].x - xy[i - 1].x,
        xy[i].y - xy[i - 1].y,
      );
    }
    return sum;
  }

  function polygonArea(xy: XY[]) {
    let a = 0;
    for (let i = 0; i < xy.length - 1; i++) {
      a += xy[i].x * xy[i + 1].y - xy[i + 1].x * xy[i].y;
    }
    return Math.abs(a / 2);
  }

  function rdp(points: XY[], eps: number): XY[] {
    if (points.length < 3) return points;
    const first = points[0];
    const last = points[points.length - 1];
    let index = -1;
    let distMax = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpDistance(points[i], first, last);
      if (d > distMax) {
        index = i;
        distMax = d;
      }
    }
    if (distMax > eps) {
      const left = rdp(points.slice(0, index + 1), eps);
      const right = rdp(points.slice(index), eps);
      return [...left.slice(0, -1), ...right];
    } else {
      return [first, last];
    }
  }

  function perpDistance(p: XY, a: XY, b: XY) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0)
      return Math.hypot(p.x - a.x, p.y - a.y);
    const t =
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  }

  // ---------- render helpers ----------

  function renderTerritory() {
    // ✅ Preferred: single merged territory
    if (territory && territory.geometry) {
      const geom = territory.geometry;

      if (geom.type === 'Polygon') {
        const outerRing = geom.coordinates[0];
        const coords: LatLng[] = outerRing.map(
          ([lng, lat]) => ({

            latitude: lat,
            longitude: lng,
          }),
        );

        return (
          <MapPolygon
            coordinates={coords}
            strokeWidth={3}
            strokeColor="rgba(34,197,94,0.95)"
            fillColor="rgba(34,197,94,0.6)"
            zIndex={1000}
          />
        );
      }

      if (geom.type === 'MultiPolygon') {
        return geom.coordinates.map((poly, idx) => {
          const outerRing = poly[0];
          const coords: LatLng[] = outerRing.map(
            ([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }),
          );

          return (
            <MapPolygon
              key={`territory-${idx}`}
              coordinates={coords}
              strokeWidth={3}
              strokeColor="rgba(34,197,94,0.95)"
              fillColor="rgba(34,197,94,0.6)"
              zIndex={1000}
            />
          );
        });
      }
    }

    // 🟢 Fallback: show each captured loop as its own polygon
    if (!territory && loops.length) {
      return loops.map((loop, idx) => (
        <MapPolygon
          key={`loop-fallback-${idx}`}
          coordinates={loop}
          strokeWidth={3}
          strokeColor="rgba(34,197,94,0.95)"
          fillColor="rgba(34,197,94,0.6)"
          zIndex={1000}
        />
      ));
    }

    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={!maskLocation}
        followsUserLocation={!maskLocation}
        initialRegion={region}
        region={current ? region : undefined}
      >
        {/* fake blue dot when masked */}
        {maskLocation && current && (
          <Marker
            coordinate={current}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.fakeDotOuter}>
              <View style={styles.fakeDotInner} />
            </View>
          </Marker>
        )}

        {/* breadcrumb line */}
        {path.length > 1 && (
          <Polyline coordinates={path} strokeWidth={4} />
        )}

        {/* Paper.io-style merged territory */}
        {renderTerritory()}

        {/* Database territories (from your old code) */}
        {allTerritories.map((territory, i) => {
          const polygonCoordinates = territory.coordinates[0];
          if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
            return null;
          }
          return (
            <MapPolygon
              key={`db-territory-${territory.territory_id}-${i}`}
              coordinates={polygonCoordinates}
              strokeWidth={2}
              strokeColor="rgba(59,130,246,0.8)" // Blue for DB territories
              fillColor="rgba(59,130,246,0.2)"
              zIndex={500} // Below the merged territory (zIndex 1000)
            />
          );
        })}
      </MapView>

      {/* Arrow pad (for testing) */}
      <View style={styles.arrowPad}>
        <Pressable
          style={styles.arrowBtn}
          onPress={() => nudgeCurrent(0, ARROW_STEP_M)}
        >
          <Ionicons
            name="chevron-up"
            size={18}
            color="#e5e7eb"
          />
        </Pressable>
        <View style={styles.arrowRow}>
          <Pressable
            style={styles.arrowBtn}
            onPress={() => nudgeCurrent(-ARROW_STEP_M, 0)}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color="#e5e7eb"
            />
          </Pressable>
          <Pressable
            style={styles.arrowBtn}
            onPress={() => nudgeCurrent(ARROW_STEP_M, 0)}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#e5e7eb"
            />
          </Pressable>
        </View>
        <Pressable
          style={styles.arrowBtn}
          onPress={() => nudgeCurrent(0, -ARROW_STEP_M)}
        >
          <Ionicons
            name="chevron-down"
            size={18}
            color="#e5e7eb"
          />
        </Pressable>
      </View>

      {/* bottom HUD */}
      <View style={styles.hud}>
        <View style={styles.hudTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hudLabel}>distance</Text>
            <Text style={styles.hudValue}>
              {distanceMi.toFixed(2)} mi
            </Text>
            <Text style={styles.hudMeta}>
              territory{' '}
              {(totalAreaM2 * 0.000247105).toFixed(2)} acres ·
              loops {loops.length}
            </Text>
          </View>
        </View>

        {/* chips row */}
        <View style={styles.chipsRow}>
          <Pressable
            onPress={toggleMask}
            style={[
              styles.chip,
              maskLocation ? styles.chipOn : styles.chipOff,
            ]}
          >
            <Ionicons
              name={
                maskLocation ? 'eye-off-outline' : 'eye-outline'
              }
              size={14}
              color={maskLocation ? '#86efac' : '#e5e7eb'}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.chipText}>
              {maskLocation ? 'mask on' : 'mask off'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              const idx = ROUTE_ORDER.indexOf(routeName);
              setRouteName(
                ROUTE_ORDER[(idx + 1) % ROUTE_ORDER.length],
              );
            }}
            style={[
              styles.chip,
              styles.routeChip,
              {
                backgroundColor: '#111827',
                borderColor: '#cbd5e1',
              },
            ]}
          >
            <Ionicons
              name="shapes"
              size={14}
              color="#e5e7eb"
              style={{ marginRight: 6 }}
            />
            <Text
              style={styles.chipText}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              route: {ROUTE_LABEL[routeName]}
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              isSimulating ? stopSim() : startSim()
            }
            style={[
              styles.chip,
              isSimulating ? styles.simOn : styles.simOff,
            ]}
          >
            <Ionicons
              name={isSimulating ? 'walk' : 'walk-outline'}
              size={14}
              color={isSimulating ? '#111827' : '#e5e7eb'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.chipText,
                isSimulating && { color: '#111827' },
              ]}
            >
              {isSimulating ? 'sim on' : 'sim ride'}
            </Text>
          </Pressable>
        </View>

        {/* bottom buttons */}
        <View style={styles.row}>
          <Pressable
            style={[
              styles.btn,
              styles.start,
              (isTracking || isSimulating) &&
                styles.btnDisabled,
            ]}
            onPress={startTracking}
            disabled={isTracking || isSimulating}
          >
            <Ionicons
              name="play"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.btnText}>
              {isResumeAvailable ? 'continue' : 'start'}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              styles.stop,
              !isTracking &&
                !isSimulating &&
                styles.btnDisabled,
            ]}
            onPress={() => {
              stopTracking();
              stopSim();
              endActiveSession();
            }}
            disabled={!isTracking && !isSimulating}
          >
            <Ionicons
              name="stop"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.btnText}>stop</Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              {
                backgroundColor: '#111827',
                borderWidth: 1,
                borderColor: '#cbd5e1',
              },
            ]}
            // Reset button onPress:
            onPress={async () => {
              stopTracking();
              stopSim();
              setPath(current ? [current] : []);
              xyRef.current = current ? [toXY(current)] : [];
              setLoops([]);
              setDistanceMeters(0);
              setTotalAreaM2(0);
              setTerritory(null);
              lastInsideRef.current = false;
              tailRef.current = [];
              setHasUnfinishedRide(false);
              resetCutState();
              
              try {
                if (user?.user_id) {
                  const key = getCurrentPathKey(user.user_id);
                  await AsyncStorage.removeItem(key);
                }
              } catch (e) {
                console.warn('failed to clear unfinished ride', e);
              }
            }}
          >
            <Ionicons
              name="refresh"
              size={16}
              color="#e5e7eb"
              style={{ marginRight: 6 }}
            />
            <Text
              style={[styles.btnText, { color: '#e5e7eb' }]}
            >
              reset
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: 'rgba(10,15,25,0.85)',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  hudTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  hudLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    textTransform: 'lowercase',
  },
  hudValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  hudMeta: {
    color: '#cbd5e1',
    opacity: 0.9,
    marginTop: 2,
    fontSize: 12,
    textTransform: 'lowercase',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
  },
  chipText: {
    color: '#e5e7eb',
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  chipOn: { backgroundColor: '#0a1a12', borderColor: '#22c55e' },
  chipOff: { backgroundColor: '#111827', borderColor: '#cbd5e1' },
  simOn: { backgroundColor: '#22c55e', borderColor: '#166534' },
  simOff: { backgroundColor: '#111827', borderColor: '#cbd5e1' },
  routeChip: { maxWidth: 160, flexShrink: 1 },
  row: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnDisabled: { opacity: 0.5 },
  start: { backgroundColor: '#22c55e' },
  stop: { backgroundColor: '#ef4444' },
  btnText: { color: '#fff', fontWeight: '800' },
  fakeDotOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderWidth: 2,
    borderColor: '#93c5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fakeDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  arrowPad: {
    position: 'absolute',
    right: 16,
    top: '35%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  arrowRow: {
    flexDirection: 'row',
    gap: 4,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});