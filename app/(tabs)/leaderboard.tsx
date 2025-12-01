// app/(tabs)/leaderboard.tsx
// friends-only leaderboard — simple list, now wired to area-based XP

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { getXpTotals } from '../../data/xp';

// tiny shape for players
type Player = { rank: number; name: string; xp: number; you?: boolean };

// static demo friends, "you" row will be overridden with real XP
const BASE_FRIENDS: Player[] = [
  { rank: 1, name: 'sofia', xp: 12500 },
  { rank: 2, name: 'elijah', xp: 11750 },
  { rank: 3, name: 'jasmine', xp: 11000 },
  { rank: 7, name: 'mason', xp: 9800 },
  { rank: 12, name: 'mia', xp: 9100 },
  { rank: 20, name: 'you', xp: 7750, you: true },
  { rank: 21, name: 'olivia', xp: 7500 },
  { rank: 22, name: 'henry', xp: 7250 },
];

export default function Leaderboard() {
  const [weeklyXp, setWeeklyXp] = useState<number | null>(null);

  // refresh XP every time the Leaderboard tab/screen gains focus
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          console.log('[leaderboard] refreshing XP on focus...');
          const { xpThisWeek } = await getXpTotals();
          if (!cancelled) {
            console.log('[leaderboard] xpThisWeek =', xpThisWeek);
            setWeeklyXp(xpThisWeek);
          }
        } catch (e) {
          console.warn('[leaderboard] failed to load XP totals', e);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  // Replace the "you" row with live weekly XP, then sort everyone by XP
  const playersWithYou: Player[] = (() => {
    const fallbackYou: Player = { rank: 0, name: 'you', xp: 0, you: true };

    const templateYou = BASE_FRIENDS.find((p) => p.you) ?? fallbackYou;

    const liveYou: Player = {
      ...templateYou,
      xp: weeklyXp != null ? weeklyXp : templateYou.xp,
      you: true,
    };

    const others = BASE_FRIENDS.filter((p) => !p.you);

    const combined = [...others, liveYou];

    const sorted = combined.sort((a, b) => b.xp - a.xp);
    return sorted.map((p, idx) => ({ ...p, rank: idx + 1 }));
  })();

  return (
    <View style={styles.container}>
      {/* simple header */}
      <Text style={styles.title}>weekly xp leaderboard</Text>
      <Text style={styles.subtitle}>
        XP is based on area you claimed this week. Areas reset daily; XP stacks
        across the week. Winner = whoever has the most XP at week end.
      </Text>

      {/* list of friends */}
      <FlatList
        data={playersWithYou}
        keyExtractor={(item) => String(item.rank)}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.you && styles.cardYou]}>
            {/* left side: rank + avatar-ish icon + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.rank}>{item.rank}</Text>
              <Ionicons name="person-circle-outline" size={22} color="#94a3b8" />
              <Text style={styles.name}>
                {item.you ? `${item.name} (you)` : item.name}
              </Text>
            </View>

            {/* right side: medal for top ranks + xp */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {item.rank <= 3 && (
                <Ionicons
                  name={item.rank === 1 ? 'trophy' : 'medal-outline'}
                  size={18}
                  color={item.rank === 1 ? '#f59e0b' : '#94a3b8'}
                  style={{ marginRight: 6 }}
                />
              )}
              <Text style={styles.xp}>{item.xp.toLocaleString()} XP</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // basic page padding
  container: { flex: 1, padding: 16, gap: 12 },

  // big title up top
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'lowercase',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },

  // leaderboard rows
  card: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  // highlight "you"
  cardYou: { backgroundColor: '#14532d' },

  // left column text
  rank: {
    width: 28,
    color: '#9ca3af',
    fontWeight: '700',
    textAlign: 'right',
  },
  name: { fontSize: 16, fontWeight: '700', marginLeft: 6, color: 'white' },

  // right column text
  xp: { color: 'white', fontWeight: '700' },
});
