// data/xp.ts
// XP & leaderboard helpers based on loop areas (square miles --> XP)

import { loadSessions, WalkSession } from './rawPaths';

// 1 square mile in square meters
const SQ_METERS_PER_SQ_MILE = 2_589_988.110336;
const M2_TO_SQMI = 1 / SQ_METERS_PER_SQ_MILE;

// Tune this to control how big the numbers look.
// 10000 XP per square mile ---> typical players end up in the hundreds / thousands.

const XP_PER_SQ_MILE = 10000;

export function areaM2ToXp(areaSqMeters: number): number {
  if (!areaSqMeters || areaSqMeters <= 0) return 0;

  const areaSqMiles = areaSqMeters * M2_TO_SQMI;
  const rawXp = areaSqMiles * XP_PER_SQ_MILE;

  // Round and guarantee at least 1 XP for any non-trivial loop
  const xp = Math.round(rawXp);
  return xp > 0 ? xp : 1;
}

export type XpTotals = {
  xpToday: number;
  xpThisWeek: number;
};


export function computeXpTotalsFromSessions(
  sessions: WalkSession[],
  now: Date = new Date(),
): XpTotals {
  const nowMs = now.getTime();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startTodayMs = startOfToday.getTime();

  // Week starts on Monday 
  const startOfWeek = new Date(startOfToday);
  const day = startOfWeek.getDay(); // 0 = Sun, 1 = Mon, ..
  const diffToMonday = (day + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
  const startWeekMs = startOfWeek.getTime();

  let xpToday = 0;
  let xpThisWeek = 0;

  for (const session of sessions) {
    for (const loop of session.loops) {
      const t = loop.closedAt;
      if (t < startWeekMs || t > nowMs) continue; // ignore loops outside this week

      const xp = areaM2ToXp(loop.areaSqMeters);
      xpThisWeek += xp;

      // “Areas reset daily”  today’s XP only counts loops from today
      if (t >= startTodayMs) {
        xpToday += xp;
      }
    }
  }

  return { xpToday, xpThisWeek };
}

// Main async helper: load all saved sessions and compute XP totals
// export async function getXpTotals(now: Date = new Date()): Promise<XpTotals> {
//   const sessions = await loadSessions();
//   return computeXpTotalsFromSessions(sessions, now);
// }


// Main async helper: load all saved sessions and compute XP totals
export async function getXpTotals(now: Date = new Date()): Promise<XpTotals> {
  const sessions = await loadSessions();
  console.log('[xp] sessions.length =', sessions.length);

  const totals = computeXpTotalsFromSessions(sessions, now);
  console.log('[xp] totals =', totals);

  return totals;
}

