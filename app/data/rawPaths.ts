// data/rawPaths.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const RAW_PATHS_KEY = 'rawPaths_v1';

export type PathPoint = {
  lat: number;
  lng: number;
  t: number; // timestamp (ms since epoch)
};

export type LoopSummary = {
  id: string;
  closedAt: number;      // timestamp
  areaSqMeters: number;  // whatever you already compute
};

export type WalkSession = {
  id: string;
  startedAt: number;
  endedAt: number | null;
  points: PathPoint[];
  loops: LoopSummary[];
};


// 
export async function loadSessions(): Promise<WalkSession[]> {
  try {
    const raw = await AsyncStorage.getItem(RAW_PATHS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WalkSession[];
  } catch (e) {
    console.warn('[rawPaths] loadSessions error', e);
    return [];
  }
}

// 
export async function saveSessions(all: WalkSession[]) {
  try {
    await AsyncStorage.setItem(RAW_PATHS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('[rawPaths] saveSessions error', e);
  }
}


// 👉 Call this when a walk finishes
export async function appendSession(session: WalkSession) {
  const all = await loadSessions();
  all.push(session);
  await saveSessions(all);
}

// 👉 For history / debugging / backend
export async function getAllSessions() {
  return loadSessions();
}

export async function clearAllSessions() {
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
