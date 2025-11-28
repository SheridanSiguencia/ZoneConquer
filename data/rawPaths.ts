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

const STORAGE_KEY = 'zoneconquer_rawpaths_v1';

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
            .filter((p: PathPoint) =>
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
            .filter((l: LoopSummary) =>
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
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const json = JSON.parse(raw);
    return reviveSessions(json);
  } catch (e) {
    console.warn('[rawPaths] failed to load sessions', e);
    return [];
  }
}

// Save all sessions to AsyncStorage
export async function saveSessions(sessions: WalkSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.warn('[rawPaths] failed to save sessions', e);
  }
}
