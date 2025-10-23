// app/(tabs)/index.tsx
// home screen hub: quick stats up top, big action tiles below

import { Ionicons } from '@expo/vector-icons'
import { Link } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  // fake stats for demo
  const [stats] = useState({ distanceKm: 3.2, zones: 2, streak: 4 })

  // quick share for the invite button
  const onInvite = useCallback(async () => {
    try {
      await Share.share({
        message:
          'join me on zoneconquer — walk, ride, and claim territory!\nhttps://zoneconquer.example',
      })
    } catch {
      // ignore share errors for now
    }
  }, [])

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* tiny brand moment up top */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name='map-outline' size={32} color='#22c55e' />
          </View>
          <Text style={styles.title}>ZoneConquer</Text>
          <Text style={styles.subtitle}>Walk. Ride. Claim your territory.</Text>
        </View>

        {/* lightweight stats so the page isn’t empty */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#1f2937', borderColor: '#374151' }]}>
            <Ionicons name='footsteps' size={18} color='#a7f3d0' />
            <Text style={styles.statValue}>{stats.distanceKm.toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#14532d', borderColor: '#166534' }]}>
            <Ionicons name='earth' size={18} color='#bbf7d0' />
            <Text style={styles.statValue}>{stats.zones}</Text>
            <Text style={styles.statLabel}>Zones</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#0f766e', borderColor: '#115e59' }]}>
            <Ionicons name='flame' size={18} color='#fde68a' />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
        </View>

        {/* big tap targets for the main actions */}
        <View style={styles.grid}>
          {/* start ride → goes to map tab */}
          <Link href='/(tabs)/map' asChild>
            <Pressable style={[styles.card, { backgroundColor: '#16a34a', borderColor: '#065f46' }]}>
              <Ionicons name='bicycle' size={26} color='#3b9c2eff' />
              <Text style={styles.cardTextLight}>Start Ride</Text>
            </Pressable>
          </Link>

          {/* open map (same destination, different label) */}
          <Link href='/(tabs)/map' asChild>
            <Pressable style={[styles.card, { backgroundColor: '#2563eb', borderColor: '#1e40af' }]}>
              <Ionicons name='map' size={26} color='#55d63cff' />
              <Text style={styles.cardTextLight}>Open Map</Text>
            </Pressable>
          </Link>

          {/* leaderboard lives on its own tab */}
          <Link href='/(tabs)/leaderboard' asChild>
            <Pressable style={[styles.card, { backgroundColor: '#111827', borderColor: '#374151' }]}>
              <Ionicons name='trophy' size={26} color='#e3f15eff' />
              <Text style={styles.cardTextLight}>Leaderboard</Text>
            </Pressable>
          </Link>

          {/* invite brings up native share sheet */}
          <Pressable style={[styles.card, styles.cardAmber]} onPress={onInvite}>
            <Ionicons name='person-add' size={26} color='#111827' />
            <Text style={styles.cardTextDark}>Invite Friends</Text>
          </Pressable>
        </View>

        {/* tiny note so folks know we’re privacy-aware */}
        <View style={styles.note}>
          <Ionicons name='lock-closed-outline' size={16} color='#cbd5e1' />
          <Text style={styles.noteText}>
            Privacy-first: location is only tracked when you start a ride.
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  // dark background so the tiles pop
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: { padding: 16, paddingBottom: 28 },

  // lil logo + tagline
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 16 },
  logoCircle: {
    height: 60,
    width: 60,
    borderRadius: 9999,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#fff' },
  subtitle: { color: '#cbd5e1', marginTop: 4, textAlign: 'center' },

  // quick stat pills
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 2,
  },
  statValue: { color: 'white', fontWeight: '900', fontSize: 16 },
  statLabel: { color: 'white', opacity: 0.9, fontSize: 12 },

  // main action tiles
  grid: { gap: 12 },
  card: {
    height: 68,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 2, // borders stay visible even if shadows get clipped
  },
  cardAmber: {
    backgroundColor: '#f59e0b',
    borderColor: '#b45309',
  },
  cardTextLight: { color: 'white', fontSize: 16, fontWeight: '800' },
  cardTextDark: { color: '#111827', fontSize: 16, fontWeight: '800' },

  // tiny info bar at the bottom
  note: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#1f2937',
    borderRadius: 12,
  },
  noteText: { color: '#e5e7eb', fontSize: 12, flex: 1 },
})
