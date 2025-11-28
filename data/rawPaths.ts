// data/rawPaths.ts
// Shared storage for raw walk/ride sessions + loop summaries

import AsyncStorage from '@react-native-async-storage/async-storage';

// A single GPS point in a session
export type PathPoint = {
  lat: number;
  lng: number;
  t: number; // timestamp (ms since epoch)
};

// Summary of a closed loop (territory) in a session
export type LoopSummary = {
  id: string;
  closedAt: number;      // timestamp when loop was closed
  areaSqMeters: number;  // area of the loop in m²
};

// A whole walking/riding session
export type WalkSession = {
  id: string;
  startedAt: number;        // ms since epoch
  endedAt: number | null;   // null if still in progress
  points: PathPoint[];      // breadcrumb of the ride
  loops: LoopSummary[];     // all closed territories in this session
};

// Use your teammate's key name for storage
const RAW_PATHS_KEY = 'rawPaths_v1';

// Make sure whatever we read from storage looks like a proper array of sessions
function reviveSessions(raw: unknown): WalkSession[] {
  if (!Array.isArray(raw)) return [];

  return (raw as unknown[])
    .map((sUnknown: unknown) => {
      const s = sUnknown as any;
      if (!s || typeof s !== 'object') return null;

      const id = String(s.id ?? '');
      const startedAt = Number(s.startedAt ?? 0);
      const endedAt =
        s.endedAt === null || s.endedAt === undefined
          ? null
          : Number(s.endedAt);

      const points: PathPoint[] = Array.isArray(s.points)
        ? (s.points as any[])
            .map((p: any) => ({
              lat: Number(p.lat),
              lng: Number(p.lng),
              t: Number(p.t),
            }))
            .filter(
              (p: PathPoint) =>
                Number.isFinite(p.lat) &&
                Number.isFinite(p.lng) &&
                Number.isFinite(p.t),
            )
        : [];

      const loops: LoopSummary[] = Array.isArray(s.loops)
        ? (s.loops as any[])
            .map((l: any) => ({
              id: String(l.id ?? ''),
              closedAt: Number(l.closedAt ?? 0),
              areaSqMeters: Number(l.areaSqMeters ?? 0),
            }))
            .filter(
              (l: LoopSummary) =>
                l.id &&
                Number.isFinite(l.closedAt) &&
                Number.isFinite(l.areaSqMeters),
            )
        : [];

      if (!id || !Number.isFinite(startedAt)) return null;

      return { id, startedAt, endedAt, points, loops } as WalkSession;
    })
    .filter((s): s is WalkSession => s !== null);
}

// Load all saved sessions from AsyncStorage
export async function loadSessions(): Promise<WalkSession[]> {
  try {
    const raw = await AsyncStorage.getItem(RAW_PATHS_KEY);
    if (!raw) return [];
    const json = JSON.parse(raw);
    return reviveSessions(json);
  } catch (e) {
    console.warn('[rawPaths] failed to load sessions', e);
    return [];
  }
}

// Save all sessions to AsyncStorage
export async function saveSessions(all: WalkSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(RAW_PATHS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[rawPaths] failed to save sessions', e);
  }
}

// 👉 Call this when a walk finishes
export async function appendSession(session: WalkSession): Promise<void> {
  const all = await loadSessions();
  all.push(session);
  await saveSessions(all);
}

// 👉 For history / debugging / backend
export async function getAllSessions(): Promise<WalkSession[]> {
  return loadSessions();
}

export async function clearAllSessions(): Promise<void> {
  await saveSessions([]);
}

// ---------- Backend JSON shape ----------

export type BackendLoopPayload = {
  sessionId: string;
  loopId: string;
  closedAt: string;
  areaSqMeters: number;
};

export type BackendSessionPayload = {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  numPoints: number;
  numLoops: number;
  loops: BackendLoopPayload[];
};

// Clean JSON your backend friend can POST / store
export function toBackendPayload(
  sessions: WalkSession[],
): BackendSessionPayload[] {
  return sessions.map((s) => ({
    sessionId: s.id,
    startedAt: new Date(s.startedAt).toISOString(),
    endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
    numPoints: s.points.length,
    numLoops: s.loops.length,
    loops: s.loops.map((loop) => ({
      sessionId: s.id,
      loopId: loop.id,
      closedAt: new Date(loop.closedAt).toISOString(),
      areaSqMeters: loop.areaSqMeters,
    })),
  }));
}
