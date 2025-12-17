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
import { friendsAPI, FriendTerritory, territoryAPI, Territory } from '@/services/api';


import type {
  Feature,
  Polygon as GeoPolygon,
  MultiPolygon,
} from 'geojson';

// tiny types
type LatLng = { latitude: number; longitude: number };
type XY = { x: number; y: number };
type TerritoryFeature = Feature<GeoPolygon | MultiPolygon>;

// Add these near your other type definitions
type PathPoint = {
  lat: number;
  lng: number;
  t: number;
};

type LoopSummary = {
  id: string;
  closedAt: number;
  areaSqMeters: number;
};

type WalkSession = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  points: PathPoint[];
  loops: LoopSummary[];
};



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
    console.log('FULL API URL DEBUG:');
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

  const [allTerritories, setAllTerritories] = useState<Territory[]>([]);

  const [friendTerritories, setFriendTerritories] = useState<FriendTerritory[]>([]);
  // breadcrumb line you're drawing this session
  const [path, setPath] = useState<LatLng[]>([]);
  // distance accumulator (meters)
  const [distanceMeters, setDistanceMeters] = useState(0);
  // privacy + tracking toggles
  const [maskLocation, setMaskLocation] =
    useState<boolean>(DEFAULT_MASK);
    
  const toggleMask = () => {
    setMaskLocation(prev => !prev);
  };

    const [isTracking, setIsTracking] = useState(false);

  // merged territory + area;
  const [territory, setTerritory] =
    useState<TerritoryFeature | null>(null);
  const [totalAreaM2, setTotalAreaM2] = useState(0);
  const [currentTerritoryId, setCurrentTerritoryId] = useState<string | null>(null);

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
    console.log('loadAllTerritories CALLED');
  
    if (!user) {
      console.log(' No user in loadAllTerritories');
      return;
    }
  
    try {
      console.log('Fetching territories from API...');
      const territories = await territoryAPI.getHistory();
      console.log('Setting territories to state:', territories.length);
      setAllTerritories(territories);
    } catch (error) {
      console.warn('Fetch error:', error);
    }
  };

  const fetchFriendTerritories = async () => {
    try {
      console.log('Fetching friend territories...');
      const territories = await friendsAPI.getFriendsTerritories();
      console.log('Friend territories fetched:', territories.length);
      setFriendTerritories(territories);
    } catch (error) {
      console.error('❌ Failed to fetch friend territories:', error);
    }
  };

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

  
  // helper functions 
  const updateTerritoryInDB = async (
    territoryId: string,
    coordinates: LatLng[][],
    areaM2: number
  ): Promise<void> => {
    if (!user) {
      console.log('User not logged in, skipping territory update');
      return;
    }
  
    try {
      console.log('Updating territory in DB:', territoryId);
      const result = await territoryAPI.updateTerritory(territoryId, coordinates, areaM2);
  
      if (result.success) {
        console.log(' Territory updated in DB:', territoryId);
        
        // Refresh ALL territories from database
        loadAllTerritories();
        
      } else {
        console.warn('Failed to update territory:', result.error);
        console.warn('Response:', result);
      }
    } catch (error) {
      console.warn('Error updating territory:', error);
    }
  };
  
  // Add this helper function to extract coordinates from territory state
  const extractCoordinatesFromTerritory = (territory: TerritoryFeature | null): LatLng[][] => {
    if (!territory || !territory.geometry) return [];
    
    const geom = territory.geometry;
    
    if (geom.type === 'Polygon') {
      return [geom.coordinates[0].map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }))];
    }
    
    if (geom.type === 'MultiPolygon') {
      return geom.coordinates.map(poly => 
        poly[0].map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }))
      );
    }
    return [];
  };

  // ---------- react to mask toggle ----------

  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🗺️ Map tab focused - loading territories for user:', user.user_id);
        loadAllTerritories();
        fetchFriendTerritories();
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
      fetchFriendTerritories();
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
        //console.log('[currentPath] saved for user', user.user_id);
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
      await setSessions(next);
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

  async function mergeLoopIntoTerritory(loop: LatLng[]) {
    console.log('[mergeLoopIntoTerritory] START, loop length:', loop.length);
    if (loop.length < 3) return;
  
    // Create loop polygon
    const ring: [number, number][] = loop.map((p) => [
      p.longitude, p.latitude,
    ]);
    const loopPoly = turf.polygon([ring]) as TerritoryFeature;
    const loopArea = turf.area(loopPoly);
    
    console.log('[mergeLoopIntoTerritory] Loop area:', loopArea, 'm²');
    
    // Check against ALL territories in database
    console.log('[mergeLoopIntoTerritory] Checking connection...');
    const {territoryId, connected} = await checkLoopConnection(loopPoly);
    console.log('[mergeLoopIntoTerritory] Connection result:', { territoryId, connected });
    
    if (connected && territoryId) {
      console.log('[mergeLoopIntoTerritory] Loop is CONNECTED to territory:', territoryId);
      
      // Get the territory from allTerritories
      const existingTerritory = allTerritories.find(t => t.territory_id === territoryId);
      
      if (existingTerritory) {
        // Merge coordinates
        const existingCoords = existingTerritory.coordinates[0];
        const mergedCoords = await mergeCoordinates(existingCoords, loop);
        
        // Update territory in DB
        await updateTerritoryInDB(
          territoryId,
          [mergedCoords],
          existingTerritory.area_sq_meters + loopArea
        );
        
        // Update currentTerritoryId to point to the updated territory
        setCurrentTerritoryId(territoryId);
        
        // Also update local territory state for display
        const mergedPoly = turf.polygon([mergedCoords.map(coord => 
          [coord.longitude, coord.latitude] as [number, number]
        )]) as TerritoryFeature;
        setTerritory(mergedPoly);
        setTotalAreaM2(existingTerritory.area_sq_meters + loopArea);
      }
    } else {
      // No connection found - create new territory
      console.log('[mergeLoopIntoTerritory] No connection found, creating new territory');
      const newTerritoryId = await saveNewTerritoryToDB(loop, loopArea);
      if (newTerritoryId) {
        setCurrentTerritoryId(newTerritoryId);
        setTerritory(loopPoly);
        setTotalAreaM2(loopArea);
      }
    }
  }

  function mergeCoordinates(existingCoords: LatLng[], newLoop: LatLng[]): LatLng[] {
    try {
      // Convert to Turf polygons
      const existingRing = existingCoords.map(coord => 
        [coord.longitude, coord.latitude] as [number, number]
      );
      
      // Ensure closed ring for existing
      const eFirst = existingRing[0];
      const eLast = existingRing[existingRing.length - 1];
      if (eFirst[0] !== eLast[0] || eFirst[1] !== eLast[1]) {
        existingRing.push([...eFirst]);
      }
      
      const newRing = newLoop.map(coord => 
        [coord.longitude, coord.latitude] as [number, number]
      );
      
      // Ensure closed ring for new
      const nFirst = newRing[0];
      const nLast = newRing[newRing.length - 1];
      if (nFirst[0] !== nLast[0] || nFirst[1] !== nLast[1]) {
        newRing.push([...nFirst]);
      }
      
      const existingPoly = turf.polygon([existingRing]);
      const newPoly = turf.polygon([newRing]);
      
      const fc = featureCollection([existingPoly, newPoly] as any) as any;
      const dissolved = dissolve(fc as any) as any;
      
      if (dissolved?.features?.length > 0) {
        const mergedFeature = dissolved.features[0] as Feature<GeoPolygon>;
        
        // Extract coordinates from merged polygon
        const mergedCoords = mergedFeature.geometry.coordinates[0].map(
          ([lng, lat]) => ({ latitude: lat, longitude: lng })
        );
        
        return mergedCoords;
      }
    } catch (error) {
      console.warn('[mergeCoordinates] Error:', error);
    }
    
    // Fallback: just return the new loop if merge fails
    return newLoop;
  }

  // connection check function
  async function checkLoopConnection(loopPoly: TerritoryFeature): 
  Promise<{territoryId: string | null, connected: boolean}> {
  
  console.log('[connection-check] START - Checking loop against', allTerritories.length, 'territories');
  
  if (!user || allTerritories.length === 0) {
    console.log('[connection-check] No user or no territories');
    return {territoryId: null, connected: false};
  }
  
  for (const dbTerritory of allTerritories) {
    // Only check user's own territories
    if (dbTerritory.user_id !== user.user_id) {
      console.log('[connection-check] Skipping territory owned by different user:', dbTerritory.user_id);
      continue;
    }
    
    console.log('[connection-check] Checking territory:', dbTerritory.territory_id);
    
    try {
      // Convert database territory to Turf polygon
      const territoryCoords = dbTerritory.coordinates[0]; // Get first polygon ring
      if (!territoryCoords || territoryCoords.length < 3) {
        console.log('[connection-check] Territory has invalid coordinates');
        continue;
      }
      
      // Convert [LatLng] to [[lng, lat], [lng, lat], ...]
      const ring: [number, number][] = territoryCoords.map(coord => 
        [coord.longitude, coord.latitude]
      );
      
      const territoryPoly = turf.polygon([ring]);
      
      // 2. Check if loop INTERSECTS with territory (touches at any point)
      const intersects = turf.booleanIntersects(loopPoly, territoryPoly);
      
      // 3. Check if loop is WITHIN territory (completely inside)
      const within = turf.booleanWithin(loopPoly, territoryPoly);
      
      console.log('[connection-check] Results:', {
        territoryId: dbTerritory.territory_id,
        intersects,
        within,
        loopPoints: loopPoly.geometry.coordinates[0].length,
        territoryPoints: territoryCoords.length
      });
      
      // 4. If they intersect OR loop is within territory, consider connected
      if (intersects || within) {
        console.log('[connection-check] CONNECTED to territory:', dbTerritory.territory_id);
        return {territoryId: dbTerritory.territory_id, connected: true};
      }
      
    } catch (error) {
      console.warn(`[connection-check] Error checking territory ${dbTerritory.territory_id}:`, error);
    }
  }
  
  console.log('[connection-check] ❌ No connection found');
  return {territoryId: null, connected: false};
}

  // Helper for creating new territories
  const saveNewTerritoryToDB = async (
    coordinates: LatLng[],
    areaM2: number
  ): Promise<string | null> => {
    if (!user) return null;
    
    try {
      console.log('Saving NEW territory to DB');
      const result = await territoryAPI.saveTerritory([coordinates], areaM2);
      
      if (result.success) {
        console.log('New territory saved to DB:', result.territory_id);
        loadAllTerritories();
        return result.territory_id;
      } else {
        // If success is false but there's no error property
        console.warn('Failed to save territory: Success flag was false');
        return null;
      }
    } catch (error) {
      console.warn('Error saving territory:', error);
      return null;
    }
  };

  // ---------- Paper.io cut logic (use existing territory edge as a side) ----------

  function processPaperCut(prev: LatLng, curr: LatLng) {
    const prevTerritory = findContainingTerritory(prev);
    const currTerritory = findContainingTerritory(curr);
    
    const insidePrev = !!prevTerritory;
    const insideNow = !!currTerritory;
    
    const state = cutStateRef.current;
    
    // If we're not starting from inside a territory, reset
    if (!insidePrev && !state.isOutside) {
      resetCutState();
      return;
    }
    if (state.isOutside && state.path.length > 0) {
      logOutsidePath(state.path, 'processPaperCut');
    }

    // LEAVING territory (inside → outside)
    if (!state.isOutside && insidePrev && !insideNow) {
      console.log('[processPaperCut] LEAVING territory');
      
      state.isOutside = true;
      state.exitPoint = prev;
      state.path = [prev]; // Start with exit point
      state.lastInside = insideNow;
      
      // Store which territory we left
      (state as any).territoryId = prevTerritory?.territory_id;
      (state as any).territory = prevTerritory;
      
      return;
    }
    
    // Currently outside: accumulate path
    if (state.isOutside) {
      // Add current point to cut path (avoid duplicates)
      const lastPoint = state.path[state.path.length - 1];
      if (!lastPoint || haversineMeters(lastPoint, curr) > 1) {
        state.path.push(curr);
      }
      
      // ENTERING territory (outside → inside)
      if (!insidePrev && insideNow && state.exitPoint) {
        console.log('[processPaperCut] ENTERING territory');
        
        const entryPoint = curr;
        const storedTerritory = (state as any).territory as Territory;
        
        if (!storedTerritory) {
          resetCutState();
          return;
        }
        
        // Create Paper.io loop
        const tailLoop = createPaperIOLoop(
          state.exitPoint,
          entryPoint,
          state.path,
          storedTerritory
        );
        
        if (tailLoop && tailLoop.length >= 4) {
          console.log('[processPaperCut] Created valid loop with', tailLoop.length, 'points');
          
          // Merge the loop
          mergeLoopIntoTerritory(tailLoop);
          
          // Trim breadcrumbs
          hardResetBreadcrumb(entryPoint);
        } else {
          console.log('[processPaperCut] Failed to create valid loop');
        }
        
        resetCutState();
      }
      
      return;
    }
  }

  function createPaperIOLoop(
    exitPoint: LatLng,
    entryPoint: LatLng,
    outsidePath: LatLng[],
    territory: Territory
  ): LatLng[] | null {
    console.log('[createPaperIOLoop] Creating proper Paper.io loop');
    
    if (!territory || territory.coordinates.length === 0) {
      return null;
    }
    
    // Get the territory border polygon
    const borderPolygon = territory.coordinates[0];
    if (borderPolygon.length < 3) {
      return null;
    }
    
    // Convert border to LatLng[]
    const borderPoints: LatLng[] = borderPolygon.map(coord => ({
      latitude: coord.latitude,
      longitude: coord.longitude,
    }));
    
    // Clean outside path: remove points too close to exit/entry
    const cleanOutsidePath: LatLng[] = [];
    for (const point of outsidePath) {
      // Skip if too close to exit point
      if (haversineMeters(point, exitPoint) < 1) continue;
      // Skip if too close to entry point
      if (haversineMeters(point, entryPoint) < 1) continue;
      // Skip duplicates
      if (cleanOutsidePath.length > 0 && 
          haversineMeters(point, cleanOutsidePath[cleanOutsidePath.length - 1]) < 1) {
        continue;
      }
      cleanOutsidePath.push(point);
    }
    
    console.log('[createPaperIOLoop] Cleaned outside path:', cleanOutsidePath.length, 'points');
    
    // If outside path is too short, we can't create a valid loop
    if (cleanOutsidePath.length < 2) {
      console.log('[createPaperIOLoop] Outside path too short for valid loop');
      return null;
    }
    
    // Find nearest border points
    const exitIndex = findNearestBorderPointIndex(borderPoints, exitPoint);
    const entryIndex = findNearestBorderPointIndex(borderPoints, entryPoint);
    
    if (exitIndex === -1 || entryIndex === -1) {
      return null;
    }
    
    // Build the loop
    const loop: LatLng[] = [];
    
    // 1. Start at exit point
    loop.push(exitPoint);
    
    // 2. Add outside path
    for (const point of cleanOutsidePath) {
      loop.push(point);
    }
    
    // 3. Add entry point
    loop.push(entryPoint);
    
    // 4. Add border segment from entry back to exit
    const borderSegment = getBorderSegment(borderPoints, entryIndex, exitIndex);
    
    // Add border segment (skip first since it's the entry point)
    for (let i = 1; i < borderSegment.length; i++) {
      // Skip duplicates
      const lastPoint = loop[loop.length - 1];
      if (!almostEqualLatLng(borderSegment[i], lastPoint)) {
        loop.push(borderSegment[i]);
      }
    }
    
    // 5. Ensure loop is closed
    const first = loop[0];
    const last = loop[loop.length - 1];
    if (!almostEqualLatLng(first, last)) {
      loop.push(first);
    }
    
    // 6. Remove any remaining consecutive duplicates
    const finalLoop: LatLng[] = [];
    for (let i = 0; i < loop.length; i++) {
      if (i === 0 || !almostEqualLatLng(loop[i], loop[i - 1])) {
        finalLoop.push(loop[i]);
      }
    }
    
    // 7. Validate the loop
    if (finalLoop.length < 4) {
      console.log('[createPaperIOLoop] Loop too short after cleaning');
      return null;
    }
    
    // Calculate area for debugging
    const ring: [number, number][] = finalLoop.map(p => 
      [p.longitude, p.latitude] as [number, number]
    );
    const poly = turf.polygon([ring]);
    const area = turf.area(poly);
    
    console.log('[createPaperIOLoop] Final loop:', {
      points: finalLoop.length,
      area: area.toFixed(2) + ' m²',
      uniquePoints: new Set(finalLoop.map(p => `${p.latitude},${p.longitude}`)).size
    });
    
    if (area < MIN_AREA_M2) {
      console.log('[createPaperIOLoop] Loop area too small:', area, '<', MIN_AREA_M2);
      return null;
    }
    
    return finalLoop;
  }
  
  function projectPointToBorder(point: LatLng, borderPoints: LatLng[]): LatLng | null {
    // Simple: find nearest border point
    // In reality, you'd project onto the nearest border segment
    let minDist = Infinity;
    let nearest: LatLng | null = null;
    
    for (const borderPoint of borderPoints) {
      const dist = haversineMeters(point, borderPoint);
      if (dist < minDist) {
        minDist = dist;
        nearest = borderPoint;
      }
    }
    
    return nearest;
  }
  
  function findNearestBorderIndex(borderPoints: LatLng[], target: LatLng): number {
    let minDist = Infinity;
    let minIndex = -1;
    
    for (let i = 0; i < borderPoints.length; i++) {
      const dist = haversineMeters(borderPoints[i], target);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    }
    
    return minIndex;
  }
  //for debugging
  function logOutsidePath(path: LatLng[], label: string) {
    console.log(`[${label}] Outside path (${path.length} points):`);
    path.forEach((p, i) => {
      console.log(`  [${i}] ${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`);
    });
  }

  function getBorderSegment(borderPoints: LatLng[], startIdx: number, endIdx: number): LatLng[] {
    console.log('Calling getBorderSegment function start')
    const segment: LatLng[] = [];
    const n = borderPoints.length;
    
    // Choose the shorter direction around the polygon
    const forwardDistance = (endIdx - startIdx + n) % n;
    const backwardDistance = (startIdx - endIdx + n) % n;
    
    // Go in the shorter direction
    let currentIdx = startIdx;
    const step = forwardDistance <= backwardDistance ? 1 : -1;
    const targetIdx = endIdx;
    
    do {
      segment.push(borderPoints[currentIdx]);
      
      // Move to next point
      currentIdx = (currentIdx + step + n) % n;
      
      // Check if we've reached the target
      if (currentIdx === targetIdx) {
        segment.push(borderPoints[currentIdx]);
        break;
      }
    } while (segment.length < n * 2); // Safety check
    
    // Remove consecutive duplicates
    const cleanSegment: LatLng[] = [];
    for (let i = 0; i < segment.length; i++) {
      if (i === 0 || !almostEqualLatLng(segment[i], segment[i - 1])) {
        cleanSegment.push(segment[i]);
      }
    }
    
    return cleanSegment;
  }
  
  
  
  // Helper to find nearest point on border
  function findNearestBorderPointIndex(borderPoints: LatLng[], target: LatLng): number {
    let minDist = Infinity;
    let minIndex = -1;
    
    for (let i = 0; i < borderPoints.length; i++) {
      const dist = haversineMeters(borderPoints[i], target);
      if (dist < minDist) {
        minDist = dist;
        minIndex = i;
      }
    }
    
    return minIndex;
  }
 

  // Find which specific territory contains a point
  function findContainingTerritory(point: LatLng): Territory | null {
    console.log('[findaContainingTerritory]: is called');
    if (!user || allTerritories.length === 0) return null;
    
    const pt = turf.point([point.longitude, point.latitude]);
    
    for (const dbTerritory of allTerritories) {
      if (dbTerritory.user_id !== user.user_id) continue;
      
      const territoryCoords = dbTerritory.coordinates[0];
      if (!territoryCoords || territoryCoords.length < 3) continue;
      
      const ring: [number, number][] = territoryCoords.map(coord => 
        [coord.longitude, coord.latitude]
      );
      
      try {
        const territoryPoly = turf.polygon([ring]);
        if (turf.booleanPointInPolygon(pt, territoryPoly)) {
          return dbTerritory;
        }
      } catch (error) {
        console.warn('Error finding containing territory:', error);
      }
    }
    
    return null;
  }
  

  function almostEqualLatLng(a: LatLng, b: LatLng, eps = 1e-6) {
    return (
      Math.abs(a.latitude - b.latitude) < eps &&
      Math.abs(a.longitude - b.longitude) < eps
    );
  }

  

  // ---------- handle a newly observed point ----------

  // This is where all the magic happens 
  const handleNewPoint = (p: LatLng, accuracy: number = 5) => {
    const t = Date.now();
    const prevPoint = current;
    
    setCurrent(p);
    setPath((prev) => {
      let newPath = prev;
      
      if (prev.length === 0) {
        xyRef.current = [toXY(p)];
        newPath = [p];
      } else {
        const last = prev[prev.length - 1];
        const delta = haversineMeters(last, p);
  
        const badAccuracy = accuracy > 50;
        const tooSmall = delta < 3;
        const tooLarge = delta > 200;
  
        if (!badAccuracy && !tooSmall && !tooLarge) {
          const xy = toXY(p);
          xyRef.current = [...xyRef.current, xy];
          setDistanceMeters((d) => d + delta);
          
          if (delta > 0) {
            const distanceMiles = delta / 1609.344;
            updateDistance(distanceMiles).catch((error: Error) => {
              console.warn('Failed to update distance:', error);
            });
          }
          
          const closure = findClosure(xyRef.current);
          if (closure) {
            console.log('findClosure returned true');
            const loop = buildLoopLatLng(closure);
  
            if (validateLoop(loop)) {
              const areaM2 = polygonArea(loop.map((ll) => toXY(ll)));
              addLoopSummary(areaM2);
              
              mergeLoopIntoTerritory(loop);
              xyRef.current = [toXY(p)];
              
              newPath = [p];
            } else {
              newPath = [...prev, p];
            }
          } else {
            newPath = [...prev, p];
          }
        }
      }
      
      return newPath;
    });
    
    // Call processPaperCut to detect connection to existing Polygon from user
    if (prevPoint) {
      processPaperCut(prevPoint, p);
    }
    
    // Record raw point for sessions
    ensureSessionStarted();
    appendRawPoint(p, t);
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
  
    // Just call handleNewPoint
    handleNewPoint(next, 5);
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
      currentTerritoryId, // Log the current ID
    });
  

    
    // First loop: always accept: a single island (can have multiple)
    if (!territory) {
      console.log('[loop] accepting as FIRST territory loop');
      // DON'T save here - let mergeLoopIntoTerritory handle it
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
  
    // This loop will merge with existing territory
    console.log('[loop] Accepting for merge with existing territory');
    console.log('[loop] Will update territory ID:', currentTerritoryId);
    
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
    // Instead of using local territory state, use ALL territories from database
    if (!user || allTerritories.length === 0) {
      return null;
    }
  
    // Filter to only show current user's territories
    const userTerritories = allTerritories.filter(t => t.user_id === user.user_id);
    
    if (userTerritories.length === 0) {
      return null;
    }
  
    return userTerritories.map((territory, index) => {
      try {
        // Territory coordinates are already in LatLng[][] format
        const polygonCoordinates = territory.coordinates[0];
        
        if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
          console.warn(`Territory ${territory.territory_id} has invalid coordinates`);
          return null;
        }
  
        return (
          <MapPolygon
            key={`user-territory-${territory.territory_id}-${index}`}
            coordinates={polygonCoordinates}
            strokeWidth={3}
            strokeColor="rgba(34,197,94,0.95)"
            fillColor="rgba(34,197,94,0.6)"
            zIndex={1000}
          />
        );
      } catch (error) {
        console.error('Error rendering territory:', error);
        return null;
      }
    });
  }

  function renderFriendTerritories() {
    if (!friendTerritories || friendTerritories.length === 0) {
      //console.log('No friend territories to render');
      return null;
    }

    return friendTerritories.map((territory, index) => {
      try {
        // Friend territories might have nested coordinates array
        const coordinates = territory.coordinates[0] || territory.coordinates;
        const flatCoords = coordinates.flat();
        
        return (
          <MapPolygon
            key={`friend-${territory.territory_id}-${index}`}
            coordinates={flatCoords.map(coord => ({
              latitude: coord.latitude,
              longitude: coord.longitude,
            }))}
            fillColor="rgba(255, 105, 180, 0.2)"  // Pink for friends
            strokeColor="rgba(255, 105, 180, 0.7)"
            strokeWidth={1.5}
            zIndex={600} // Between user territories (1000) and DB territories (500)
          />
        );
      } catch (error) {
        console.error('Error rendering friend territory:', error);
        return null;
      }
    });
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

        {/* merged territory */}
        {renderTerritory()}
        
        {/* Display friends territories */}
        {renderFriendTerritories()}
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
              
              setDistanceMeters(0);
              setTotalAreaM2(0);
              setTerritory(null);
              
              setHasUnfinishedRide(false);
              resetCutState();
              setCurrentTerritoryId(null); // resets the current territory id 
              
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