// app/(tabs)/leaderboard.tsx
// leaderboard screen with a simple segmented control (global / friends / nearby)

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

// tiny shape for players
type Player = { rank: number; name: string; xp: number; you?: boolean }

// demo data for now
const GLOBAL: Player[] = [
  { rank: 1, name: 'Sofia', xp: 12500 },
  { rank: 2, name: 'Elijah', xp: 11750 },
  { rank: 3, name: 'Jasmine', xp: 11000 },
  { rank: 20, name: 'You', xp: 7750, you: true },
  { rank: 21, name: 'Olivia', xp: 7500 },
  { rank: 22, name: 'Henry', xp: 7250 },
  { rank: 23, name: 'Amelia', xp: 7000 },
]

// quick clones to fake other tabs
const FRIENDS = GLOBAL.map(p => ({ ...p }))  // mock
const NEARBY = GLOBAL.map(p => ({ ...p }))   // mock

export default function Leaderboard() {
  // which tab is active
  const [tab, setTab] = useState<'Global' | 'Friends' | 'Nearby'>('Global')
  const data = tab === 'Global' ? GLOBAL : tab === 'Friends' ? FRIENDS : NEARBY

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      {/* segmented control */}
      <View style={styles.segment}>
        {(['Global', 'Friends', 'Nearby'] as const).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.segBtn, tab === t && styles.segBtnActive]}
          >
            <Text style={[styles.segText, tab === t && styles.segTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {/* list of players for the current tab */}
      <FlatList
        data={data}
        keyExtractor={item => String(item.rank)}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={[styles.card, item.you && styles.cardYou]}>
            {/* left side: rank + avatar-ish icon + name */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.rank}>{item.rank}</Text>
              <Ionicons name='person-circle-outline' size={22} color='#94a3b8' />
              <Text style={styles.name}>{item.name}</Text>
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
  )
}

const styles = StyleSheet.create({
  // basic page padding
  container: { flex: 1, padding: 16, gap: 12 },

  // big title up top
  title: { fontSize: 28, fontWeight: '800', marginTop: 6, marginBottom: 8 },

  // pill-style toggle
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    padding: 4,
    alignSelf: 'center',
    marginBottom: 8,
  },
  segBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  segBtnActive: { backgroundColor: '#111827' },
  segText: { fontWeight: '600', color: '#111827' },
  segTextActive: { color: 'white' },

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
  rank: { width: 24, color: '#9ca3af', fontWeight: '700', textAlign: 'right' },
  name: { fontSize: 16, fontWeight: '700', marginLeft: 6, color: 'white' },

  // right column text
  xp: { color: 'white', fontWeight: '700' },
})
