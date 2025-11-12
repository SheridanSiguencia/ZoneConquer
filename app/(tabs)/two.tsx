// app/(tabs)/two.tsx
// simple profile screen for demo
// shows a header card, some stats, small achievements list, a couple toggles, and actions

import { Link, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_PROFILE_KEY = 'zoneconquer_user_profile_v1';

// --- Gamified Achievements Data ---
type Achievement = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    status: 'unlocked' | 'locked' | 'progress';
    progress?: number; // 0 to 100
};

const achievements: Achievement[] = [
    { icon: 'medal', title: 'First Zone Captured', status: 'unlocked' },
    { icon: 'bicycle', title: '10 km in a Day', status: 'unlocked' },
    { icon: 'walk', title: '5,000 Steps', status: 'progress', progress: 75 },
    { icon: 'people', title: 'Invite 3 Friends', status: 'locked' },
    { icon: 'calendar', title: '7-Day Streak', status: 'locked' },
];
// --- End Achievements Data ---


export default function ProfileScreen() {
  const [name, setName] = useState('Alex Rider');
  const [handle, setHandle] = useState('@alex');

  // Load profile data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(USER_PROFILE_KEY);
          if (!raw) return;

          const parsed = JSON.parse(raw) as { name?: string; handle?: string };
          if (parsed.name) setName(parsed.name);
          if (parsed.handle) setHandle(parsed.handle);
        } catch (e) {
          console.warn('failed to load user profile', e);
        }
      })();
    }, [])
  );

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
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.handle}>{handle}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
            <Link href="/customize" asChild>
                <Pressable style={styles.editBtn}>
                <Ionicons name='create-outline' size={16} color='#111827' />
                <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
            </Link>
            <Link href="/settings" asChild>
                <Pressable style={styles.settingsBtn}>
                <Ionicons name='settings-outline' size={18} color='#111827' />
                </Pressable>
            </Link>
        </View>
      </View>

      {/* quick stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#111827' }]}>
          <Ionicons name='trophy-outline' size={18} color='#fde68a' />
          <Text style={styles.statValue}>7,750</Text>
          <Text style={styles.statLabel}>XP</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#14532d' }]}>
          <Ionicons name='expand-outline' size={18} color='#bbf7d0' />
          <Text style={styles.statValue}>1.8</Text>
          <Text style={styles.statLabel}>Territory</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#064e3b' }]}>
          <Ionicons name='flame-outline' size={18} color='#fde68a' />
          <Text style={styles.statValue}>4</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
      </View>

      {/* achievements list */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achList}>
          {achievements.map((ach) => (
            <View key={ach.title} style={styles.achItem}>
              <View style={[styles.achIcon, ach.status === 'locked' && styles.achIconLocked]}>
                <Ionicons
                  name={ach.status === 'locked' ? 'lock-closed' : ach.icon}
                  size={20}
                  color={ach.status === 'unlocked' ? '#f59e0b' : '#9ca3af'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.achText, ach.status === 'locked' && styles.achTextLocked]}>
                  {ach.title}
                </Text>
                {ach.status === 'progress' && (
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${ach.progress}%` }]} />
                  </View>
                )}
              </View>
            </View>
          ))}
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
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtnText: { fontWeight: '800', color: '#111827' },
  settingsBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },

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
  statLabel: { color: 'white', opacity: 0.9, fontSize: 12, fontWeight: '600' },

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
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12, color: '#111827' },

  // achievements list
  achList: { gap: 16 },
  achItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  achIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#fffbeb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achIconLocked: {
    backgroundColor: '#f1f5f9',
  },
  achText: { color: '#111827', fontWeight: '600', fontSize: 15 },
  achTextLocked: {
    color: '#9ca3af',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },

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
});