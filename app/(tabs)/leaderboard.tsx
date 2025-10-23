// app/(tabs)/leaderboard.tsx
// friends-only leaderboard — simple list, no tabs

import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, View } from 'react-native';

// tiny shape for players
type Player = { rank: number; name: string; xp: number; you?: boolean }

// demo friends data
const FRIENDS: Player[] = [
  { rank: 1, name: 'sofia', xp: 12500 },
  { rank: 2, name: 'elijah', xp: 11750 },
  { rank: 3, name: 'jasmine', xp: 11000 },
  { rank: 7, name: 'mason', xp: 9800 },
  { rank: 12, name: 'mia', xp: 9100 },
  { rank: 20, name: 'you', xp: 7750, you: true },
  { rank: 21, name: 'olivia', xp: 7500 },
  { rank: 22, name: 'henry', xp: 7250 },
]

export default function Leaderboard() {
  const data = FRIENDS

  return (
    <View style={styles.container}>
      {/* simple header */}
      <Text style={styles.title}>friends leaderboard</Text>

      {/* list of friends */}
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
  title: { fontSize: 28, fontWeight: '800', marginTop: 6, marginBottom: 8, textTransform: 'lowercase' },

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
  rank: { width: 28, color: '#9ca3af', fontWeight: '700', textAlign: 'right' },
  name: { fontSize: 16, fontWeight: '700', marginLeft: 6, color: 'white' },

  // right column text
  xp: { color: 'white', fontWeight: '700' },
})
