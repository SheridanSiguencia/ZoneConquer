// app/(tabs)/two.tsx
// simple profile screen for demo
// shows a header card, some stats, small achievements list, a couple toggles, and actions

import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'

export default function ProfileScreen() {
  // demo state only, nothing is persisted yet
  const [shareLocation, setShareLocation] = useState(true)
  const [notifications, setNotifications] = useState(true)

  // quick share for invite button
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
    <ScrollView contentContainerStyle={styles.container}>
      {/* header card with avatar + name */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Alex Rider</Text>
          <Text style={styles.handle}>@alex</Text>
        </View>

        <Link href="/customize" asChild>
          <Pressable style={styles.editBtn}>
            <Ionicons name='create-outline' size={16} color='#111827' />
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </Link>

      </View>

      {/* quick stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#111827' }]}>
          <Ionicons name='trophy' size={18} color='#fde68a' />
          <Text style={styles.statValue}>7,750</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#14532d' }]}>
          <Ionicons name='earth' size={18} color='#bbf7d0' />
          <Text style={styles.statValue}>1.8</Text>
          <Text style={styles.statLabel}>sq km</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#064e3b' }]}>
          <Ionicons name='flame' size={18} color='#fde68a' />
          <Text style={styles.statValue}>4</Text>
          <Text style={styles.statLabel}>day streak</Text>
        </View>
      </View>

      {/* achievements list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>

        <View style={styles.achList}>
          <View style={styles.achItem}>
            <Ionicons name='medal-outline' size={18} color='#111827' />
            <Text style={styles.achText}>First Zone Captured</Text>
          </View>

          <View style={styles.achItem}>
            <Ionicons name='bicycle' size={18} color='#111827' />
            <Text style={styles.achText}>10 km in a day</Text>
          </View>

          <View style={styles.achItem}>
            <Ionicons name='people-outline' size={18} color='#111827' />
            <Text style={styles.achText}>Invite 3 friends</Text>
          </View>
        </View>
      </View>

      {/* settings toggles */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.rowItem}>
          <View style={styles.rowLeft}>
            <Ionicons name='location-outline' size={20} color='#111827' />
            <Text style={styles.rowText}>Share location with friends</Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={shareLocation ? '#22c55e' : '#f8fafc'}
          />
        </View>

        <View style={styles.rowItem}>
          <View style={styles.rowLeft}>
            <Ionicons name='notifications-outline' size={20} color='#111827' />
            <Text style={styles.rowText}>Push notifications</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: '#cbd5e1', true: '#86efac' }}
            thumbColor={notifications ? '#22c55e' : '#f8fafc'}
          />
        </View>
      </View>

      {/* actions */}
      <View style={styles.actions}>
        <Pressable style={[styles.actionBtn, styles.primary]} onPress={onInvite}>
          <Ionicons name='person-add' size={18} color='#fff' />
          <Text style={styles.actionTextPrimary}>Invite Friends</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.outline]}
          onPress={() => router.replace('/login')}
        >
          <Ionicons name='log-out-outline' size={18} color='#111827' />
          <Text style={styles.actionTextOutline}>Log out</Text>
        </Pressable>
      </View>

      {/* tiny disclaimer for the demo */}
      <Text style={styles.smallPrint}>Demo only — data isn’t saved yet.</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 16 },

  // header card bits
  headerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: {
    height: 56,
    width: 56,
    borderRadius: 9999,
    backgroundColor: '#e6ffef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#22c55e', fontSize: 22, fontWeight: '900' },
  name: { fontSize: 20, fontWeight: '900', color: '#111827' },
  handle: { color: '#64748b' },

  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtnText: { fontWeight: '800', color: '#111827' },

  // stat pills
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: { color: 'white', fontWeight: '900', fontSize: 16 },
  statLabel: { color: 'white', opacity: 0.9, fontSize: 12 },

  // sections
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 8, color: '#111827' },

  // achievements list
  achList: { gap: 8 },
  achItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  achText: { color: '#111827', fontWeight: '600' },

  // settings rows
  rowItem: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { color: '#111827', fontWeight: '600' },

  // action buttons
  actions: { gap: 10 },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: { backgroundColor: '#22c55e' },
  outline: { backgroundColor: 'white', borderWidth: 2, borderColor: '#111827' },
  actionTextPrimary: { color: 'white', fontWeight: '800' },
  actionTextOutline: { color: '#111827', fontWeight: '800' },

  smallPrint: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 8 },
})
