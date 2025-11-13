// app/(tabs)/map.tsx
// ride screen with distance (mi), bottom hud, privacy mask,
// loop detection → territory fill, a multi-route simulator,
// local persistence for claimed territory, and rawPaths recording
// (TEST MODE: records raw paths even when mask is ON, including sim rides)

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';

import {
  PathPoint,
  WalkSession,
  loadSessions,
  saveSessions,
} from '../data/rawPaths';

// tiny types
type LatLng = { latitude: number; longitude: number };
type XY = { x: number; y: number };

// thresholds for what counts as a “real” loop
const MIN_PERIMETER_M = 80;
const MIN_AREA_M2 = 800;
const MIN_RING_POINTS = 4;
const CLOSE_EPS_M = 12;

// local storage key for territory
const LOOPS_KEY = 'zoneconquer_loops_v1';

// allow turning privacy mask off via env if you want
const DEFAULT_MASK =
  (process.env.EXPO_PUBLIC_MASK_LOCATION ?? 'true').toString() === 'true';

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
  // live position (masked if privacy is on)
  const [current, setCurrent] = useState<LatLng | null>(null);
  // breadcrumb line you’re drawing this session
  const [path, setPath] = useState<LatLng[]>([]);
  // distance accumulator (meters)
  const [distanceMeters, setDistanceMeters] = useState(0);
  // privacy + tracking toggles
  const [maskLocation, setMaskLocation] =
    useState<boolean>(DEFAULT_MASK);
  const [isTracking, setIsTracking] = useState(false);
  // claimed polygons + total area (these are what we persist)
  const [loops, setLoops] = useState<LatLng[][]>([]);
  const [totalAreaM2, setTotalAreaM2] = useState(0);

  // rawPaths sessions
  const [sessions, setSessions] = useState<WalkSession[]>([]);

  // simulator state
  const [isSimulating, setIsSimulating] = useState(false);

  // refs
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const maskRef = useRef<{ dLat: number; dLon: number } | null>(
    null,
  );
  const originRef = useRef<{
    lat: number;
    lon: number;
    mPerDegLat: number;
    mPerDegLon: number;
  } | null>(null);
  const xyRef = useRef<XY[]>([]);

  const sessionsRef = useRef<WalkSession[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);

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

  // load saved territory once on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOOPS_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw) as {
          loops?: LatLng[][];
          totalAreaM2?: number;
        };
        if (Array.isArray(parsed.loops)) {
          setLoops(parsed.loops);
        }
        if (typeof parsed.totalAreaM2 === 'number') {
          setTotalAreaM2(parsed.totalAreaM2);
        }
      } catch (e: unknown) {
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
      } catch (e: unknown) {
        console.warn('failed to load raw sessions', e);
      }
    })();
  }, []);

  // init / reinit on mask toggle (live session only)
  useEffect(() => {
    stopTracking();
    stopSim();
    endActiveSession(); // close any open raw session

    maskRef.current = null;
    originRef.current = null;
    xyRef.current = [];
    setPath([]);
    setDistanceMeters(0);

    (async () => {
      await Location.requestForegroundPermissionsAsync();
      const loc = await Location.getCurrentPositionAsync({});
      const raw = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      // pick a random ~6–10 km mask offset so geometry still feels local
      if (maskLocation && !maskRef.current) {
        const distanceM = 6000 + Math.random() * 4000;
        const angle = Math.random() * Math.PI * 2;
        const metersPerDegLat = 111111;
        const metersPerDegLon =
          111111 * Math.cos((raw.latitude * Math.PI) / 180);
        const dLat =
          (distanceM * Math.cos(angle)) / metersPerDegLat;
        const dLon =
          (distanceM * Math.sin(angle)) / metersPerDegLon;
        maskRef.current = { dLat, dLon };
      }

      const first = mask(raw);
      setCurrent(first);
      setPath([first]);
      xyRef.current = [toXY(first)];
    })();

    return () => {
      stopTracking();
      stopSim();
      endActiveSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maskLocation]);

  // persist territory whenever loops / area change on real-location sessions
  useEffect(() => {
    (async () => {
      try {
        if (!maskLocation) {
          if (loops.length || totalAreaM2 > 0) {
            await AsyncStorage.setItem(
              LOOPS_KEY,
              JSON.stringify({ loops, totalAreaM2 }),
            );
          } else {
            await AsyncStorage.removeItem(LOOPS_KEY);
          }
        }
        // when mask is on we treat everything as “demo only”
      } catch (e: unknown) {
        console.warn('failed to save territory', e);
      }
    })();
  }, [loops, totalAreaM2, maskLocation]);

  // rawPaths helpers

  const persistSessions = async (next: WalkSession[]) => {
    setSessions(next);
    sessionsRef.current = next;
    try {
      await saveSessions(next);
    } catch (error: unknown) {
      console.warn('failed to save raw sessions', error);
    }
  };

  // TEST MODE: allow sessions even when maskLocation is true
  const ensureSessionStarted = () => {
    if (activeSessionIdRef.current) return; // already have an active session

    const now = Date.now();
    const points: PathPoint[] = [];

    if (current) {
      // NOTE: when mask is ON, `current` is masked — OK for testing
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

  // TEST MODE: record points even when maskLocation is true
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

  // TEST MODE: record loop summaries even when maskLocation is true
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

    Alert.alert(
      'Raw paths saved',
      `Session saved with ${numPoints} points and ${numLoops} loops.`,
    );
  };

  // handle a newly observed point
  const handleNewPoint = (p: LatLng, accuracy: number = 5) => {
    const t = Date.now();
    let accepted = false;

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

        // try to close a loop
        const closure = findClosure(xyRef.current);
        if (closure) {
          const loop = buildLoopLatLng(closure);
          if (validateLoop(loop)) {
            setLoops((prevLoops) => [...prevLoops, loop]);

            const areaM2 = polygonArea(loop.map(toXY));
            setTotalAreaM2((a) => a + areaM2);

            // record loop summary on the active session
            addLoopSummary(areaM2);

            // reset path starting at the closure point so you continue a fresh tail
            const tail = loop[0];
            originRef.current = null;
            xyRef.current = [toXY(tail)];
            accepted = true;
            return [tail];
          }
        }

        accepted = true;
        return [...prev, p];
      }

      return prev;
    });

    if (accepted) {
      appendRawPoint(p, t);
    }
  };

  // start/stop gps tracking
  const startTracking = async () => {
    if (watchRef.current) return;
    stopSim();

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
        const p = mask(raw);
        handleNewPoint(p, loc.coords.accuracy ?? 5);
      },
    );
  };

  const stopTracking = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setIsTracking(false);
  };

  // simple multi-route simulator (select route with the chip, then press sim ride)
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

  // short labels so the chip text stays compact
  const ROUTE_LABEL: Record<SimRouteName, string> = {
    campusSquare: 'campus',
    bigLoop: 'big loop',
    triangle: 'triangle',
    nearGate: 'near gate',
    figure8: 'figure-8',
    skinnyRibbon: 'ribbon',
  };

  // route shapes in local meters around (0,0) — closed loops
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

  // densify a coarse polyline to ~10 m hops
  function densify(vertices: XY[], step = 10) {
    const out: XY[] = [];
    for (let i = 0; i < vertices.length - 1; i++) {
      const a = vertices[i];
      const b = vertices[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++)
        out.push({
          x: a.x + (dx * k) / n,
          y: a.y + (dy * k) / n,
        });
    }
    out.push(vertices[vertices.length - 1]);
    return out;
  }

  // sim interval
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const simIndexRef = useRef(0);
  const simRouteRef = useRef<LatLng[] | null>(null);

  const startSim = () => {
    if (isSimulating || !current) return;
    stopTracking();
    setIsSimulating(true);

    // Start a rawPaths session for the sim ride (testing)
    ensureSessionStarted();

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

  // hud helpers
  const toggleMask = () => setMaskLocation((m) => !m);
  const distanceMi = distanceMeters / 1609.344;

  // map region fallback (central park if unknown)
  const region = {
    latitude: current?.latitude ?? 40.7812,
    longitude: current?.longitude ?? -73.9665,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // —— loop helpers ——  

  function findClosure(xy: XY[]) {
    const n = xy.length;
    if (n < 4) return null;

    const a = xy[n - 2];
    const b = xy[n - 1];

    // snap to the very first point if we’re close enough
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

    // check intersection with any older segment (skip neighbors)
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

    // snap to any earlier vertex if we’re within epsilon (not just the first)
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
    const simplified = rdp(ringXY, 2); // gentle simplify for demo
    return simplified.map(toLatLng);
  }

  function validateLoop(loop: LatLng[]) {
    if (loop.length < MIN_RING_POINTS) return false;
    const xy = loop.map(toXY);
    const peri = pathLength(xy);
    if (peri < MIN_PERIMETER_M) return false;
    const area = polygonArea(xy);
    if (area < MIN_AREA_M2) return false;
    return true;
  }

  function pathLength(xy: XY[]) {
    let sum = 0;
    for (let i = 1; i < xy.length; i++)
      sum += Math.hypot(
        xy[i].x - xy[i - 1].x,
        xy[i].y - xy[i - 1].y,
      );
    return sum;
  }

  function polygonArea(xy: XY[]) {
    let a = 0;
    for (let i = 0; i < xy.length - 1; i++)
      a += xy[i].x * xy[i + 1].y - xy[i + 1].x * xy[i].y;
    return Math.abs(a / 2);
  }

  function rdp(points: XY[], eps: number): XY[] {
    if (points.length < 3) return points;
    const first = points[0],
      last = points[points.length - 1];
    let index = -1,
      distMax = 0;
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
    const dx = b.x - a.x,
      dy = b.y - a.y;
    if (dx === 0 && dy === 0)
      return Math.hypot(p.x - a.x, p.y - a.y);
    const t =
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    return Math.hypot(p.x - proj.x, p.y - proj.y);
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        // hide native dot when masked so we don’t leak real location
        showsUserLocation={!maskLocation}
        followsUserLocation={!maskLocation}
        initialRegion={region}
        region={current ? region : undefined}
      >
        {/* custom blue dot when masked */}
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

        {/* claimed polygons */}
        {loops.map((ring, i) => (
          <Polygon
            key={i}
            coordinates={ring}
            strokeWidth={3}
            strokeColor="rgba(34,197,94,0.95)"
            fillColor="rgba(34,197,94,0.28)"
            zIndex={1000}
          />
        ))}
      </MapView>

      {/* bottom hud */}
      <View style={styles.hud}>
        {/* TOP: distance/area block kept full width */}
        <View style={styles.hudTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hudLabel}>distance</Text>
            <Text style={styles.hudValue}>
              {distanceMi.toFixed(2)} mi
            </Text>
            <Text style={styles.hudMeta}>
              territory{' '}
              {(totalAreaM2 * 0.000247105).toFixed(2)} acres · loops{' '}
              {loops.length}
            </Text>
          </View>
        </View>

        {/* MIDDLE: chips row */}
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

        {/* BOTTOM: buttons */}
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
            <Text style={styles.btnText}>start</Text>
          </Pressable>

          <Pressable
            style={[
              styles.btn,
              styles.stop,
              !isTracking && !isSimulating && styles.btnDisabled,
            ]}
            onPress={() => {
              stopTracking();
              stopSim();
              endActiveSession(); // triggers alert + log
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
            onPress={() => {
              stopTracking();
              stopSim();
              setPath(current ? [current] : []);
              xyRef.current = current ? [toXY(current)] : [];
              setLoops([]);
              setDistanceMeters(0);
              setTotalAreaM2(0);
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
  // floating panel at the bottom
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

  // keep distance block on its own line
  hudTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  // chips get their own row and can wrap
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

  // chips
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

  // buttons
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

  // custom masked blue dot
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
});
