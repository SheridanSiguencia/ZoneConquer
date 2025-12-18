// app/(tabs)/leaderboard.tsx
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { API_BASE } from '../../services/api';

type LeaderboardRow = {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
  xp_week: number | string; // pg can send bigint as string
  you?: boolean;
  rank?: number; // backend may send rank (we’ll compute anyway)
};

type Player = {
  rank: number;
  name: string;
  xp: number;
  you?: boolean;
};

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      (async () => {
        try {
          const url = `${API_BASE}/gamification/leaderboard`;
          console.log('[leaderboard] URL =', url);

          const res = await fetch(url, { credentials: 'include' });

          const text = await res.text();
          console.log('[leaderboard] status =', res.status);
          console.log('[leaderboard] body =', text);

          let json: any = {};
          try {
            json = text ? JSON.parse(text) : {};
          } catch {
            json = { error: text }; // not JSON (maybe HTML), keep raw body
          }

          if (!res.ok) throw new Error(json?.error || `Failed to load leaderboard (${res.status})`);

          if (!cancelled) setRows(json.leaderboard || []);

        } catch (e) {
          console.warn('[leaderboard] failed to load leaderboard', e);
          if (!cancelled) setRows([]);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const players: Player[] = useMemo(() => {
    const mapped: Player[] = (rows || []).map((r) => {
      const xpNum = typeof r.xp_week === 'string' ? Number(r.xp_week) : Number(r.xp_week);
      return {
        rank: 0,
        name: r.username,
        xp: Number.isFinite(xpNum) ? xpNum : 0,
        you: !!r.you,
      };
    });

    mapped.sort((a, b) => b.xp - a.xp);
    return mapped.map((p, idx) => ({ ...p, rank: idx + 1 }));
  }, [rows]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>weekly xp leaderboard</Text>
      <Text style={styles.subtitle}>
        XP comes from backend events. If you take territory you gain XP; if someone takes yours you
        lose XP. Leaderboard is the sum of XP this week.
      </Text>

      <FlatList
        data={players}
        keyExtractor={(item) => `${item.rank}-${item.name}`}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.you && styles.cardYou]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.rank}>{item.rank}</Text>
              <Ionicons name="person-circle-outline" size={22} color="#94a3b8" />
              <Text style={styles.name}>{item.you ? `${item.name} (you)` : item.name}</Text>
            </View>

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
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 6, marginBottom: 2, textTransform: 'lowercase' },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  card: {
    backgroundColor: '#111827',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  cardYou: { backgroundColor: '#14532d' },
  rank: { width: 28, color: '#9ca3af', fontWeight: '700', textAlign: 'right' },
  name: { fontSize: 16, fontWeight: '700', marginLeft: 6, color: 'white' },
  xp: { color: 'white', fontWeight: '700' },
});
