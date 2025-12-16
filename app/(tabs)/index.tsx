import { Ionicons } from '@expo/vector-icons';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Friend, friendsAPI } from '../../services/api';
import { useUserStore } from '../../store/user';

export default function HomeScreen() {
  const { stats, loading, error, fetchUserStats } = useUserStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

  const fetchFriends = useCallback(async () => {
    setLoadingFriends(true);
    try {
      // friendsAPI.getFriends is typed as Promise<Friend[]>
      const result = await friendsAPI.getFriends();
      setFriends(result);
    } catch (err: any) {
      console.error(
        'Failed to fetch friends:',
        err?.message || JSON.stringify(err),
      );
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      console.log('🏠 Home screen focused, refreshing stats and friends');
      fetchUserStats();
      fetchFriends();
    }, [fetchUserStats, fetchFriends]),
  );

  const onInvite = useCallback(async () => {
    try {
      await Share.share({
        message:
          'join me on zoneconquer — walk, ride, and claim territory!\nhttps://zoneconquer.app',
      });
    } catch {
      // ignore
    }
  }, []);

  const weeklyPct = useMemo(() => {
    if (!stats || !stats.weekly_goal || stats.weekly_goal === 0) return 0;
    const weeklyDistance = stats.weekly_distance || 0;
    return Math.min(
      100,
      Math.round((weeklyDistance / stats.weekly_goal) * 100),
    );
  }, [stats]);

  if (loading && !stats) {
    return (
      <View
        style={[
          styles.screen,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={{ color: '#e5e7eb', marginTop: 12 }}>
          Loading your stats...
        </Text>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View
        style={[
          styles.screen,
          { justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <Ionicons name="warning-outline" size={48} color="#ef4444" />
        <Text
          style={{
            color: '#ef4444',
            marginBottom: 12,
            textAlign: 'center',
          }}
        >
          {error || 'Failed to load stats'}
        </Text>
        <Pressable onPress={fetchUserStats} style={styles.invite}>
          <Ionicons name="reload" size={16} color="#111827" />
          <Text style={styles.inviteText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* decorative orbs */}
      <View
        style={[
          styles.orb,
          { top: -60, left: -40, backgroundColor: '#063' },
        ]}
      />
      <View
        style={[
          styles.orb,
          { top: 220, right: -80, backgroundColor: '#123' },
        ]}
      />
      <View
        style={[
          styles.orb,
          { bottom: -90, left: -70, backgroundColor: '#1b3' },
        ]}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading || loadingFriends}
            onRefresh={() => {
              fetchUserStats();
              fetchFriends();
            }}
            tintColor="#e5e7eb"
          />
        }
      >
        {/* header row */}
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.logoDot}>
              <Ionicons name="map-outline" size={16} color="#22c55e" />
            </View>
            <Text style={styles.brand}>zoneconquer</Text>
            <View style={styles.pill}>
              <Text style={styles.pillText}>beta</Text>
            </View>
          </View>

          <Pressable onPress={onInvite} style={styles.invite}>
            <Ionicons name="person-add" size={16} color="#111827" />
            <Text style={styles.inviteText}>invite</Text>
          </Pressable>
        </View>

        {/* hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroTitle}>ready to ride?</Text>
            <Text style={styles.heroSub}>
              walk, bike, loop, claim your zone
            </Text>
          </View>

          <Link href="/(tabs)/map" asChild>
            <Pressable
              style={styles.primaryCta}
              android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            >
              <View style={styles.ctaIconWrap}>
                <Ionicons name="bicycle" size={18} color="#111827" />
              </View>
              <Text style={styles.primaryCtaText}>start ride</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#ffffff"
                style={{ marginLeft: 6 }}
              />
            </Pressable>
          </Link>

          {/* quick facts */}
          <View style={styles.quickRow}>
            <View style={[styles.quickItem, { borderColor: '#134e4a' }]}>
              <Ionicons name="footsteps" size={14} color="#93e6b8" />
              <Text style={styles.quickValue}>
                {Number(stats.today_distance || 0).toFixed(1)} mi
              </Text>
              <Text style={styles.quickLabel}>today</Text>
            </View>
            <View style={[styles.quickItem, { borderColor: '#1f2937' }]}>
              <Ionicons name="earth" size={14} color="#86efac" />
              <Text style={styles.quickValue}>
                {stats.territories_owned || 0}
              </Text>
              <Text style={styles.quickLabel}>zones</Text>
            </View>
            <View style={[styles.quickItem, { borderColor: '#1e293b' }]}>
              <Ionicons name="flame" size={14} color="#fde68a" />
              <Text style={styles.quickValue}>
                {stats.current_streak || 0}
              </Text>
              <Text style={styles.quickLabel}>streak</Text>
            </View>
          </View>
        </View>

        {/* weekly progress */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>weekly miles</Text>
            <Text style={styles.sectionMeta}>
              {Number(stats.weekly_distance || 0).toFixed(1)} /{' '}
              {Number(stats.weekly_goal || 15).toFixed(0)} mi
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${weeklyPct}%` }]}
            />
          </View>
          <Text style={styles.progressHint}>
            {weeklyPct}% of goal • keep going to hit{' '}
            {(stats.weekly_goal || 15).toFixed(0)} mi
          </Text>
        </View>

        {/* friends preview */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>friends</Text>
            <Link href="/(tabs)/leaderboard" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.link}>view leaderboard</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.friendsRow}>
            {loadingFriends ? (
              <ActivityIndicator size="small" color="#e5e7eb" />
            ) : friends.length > 0 ? (
              friends.slice(0, 4).map((friend, i) => (
                <View
                  key={friend.user_id}
                  style={[
                    styles.avatar,
                    {
                      marginLeft: i === 0 ? 0 : -10,
                      backgroundColor: '#0b2',
                    },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {friend.username[0]?.toUpperCase()}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noFriendsText}>No friends yet.</Text>
            )}

            <Link href="/add-friend" asChild>
              <Pressable style={styles.friendPill}>
                <Ionicons name="person-add" size={14} color="#111827" />
                <Text style={styles.friendPillText}>add</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* quick actions */}
        <Text style={styles.sectionKicker}>quick actions</Text>
        <View style={styles.grid}>
          <Link href="/(tabs)/map" asChild>
            <Pressable
              style={[styles.tile, styles.tileGreen]}
              android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
            >
              <Ionicons name="play" size={20} color="#ffffff" />
              <Text style={styles.tileTextLight}>start ride</Text>
            </Pressable>
          </Link>

          <Link href="/(tabs)/profile" asChild>
            <Pressable
              style={[styles.tile, styles.tilePurple]}
              android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            >
              <Ionicons name="person-outline" size={20} color="#ffffff" />
              <Text style={styles.tileTextLight}>view profile</Text>
            </Pressable>
          </Link>

          <Link href="/(tabs)/leaderboard" asChild>
            <Pressable
              style={[styles.tile, styles.tileSlate]}
              android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
            >
              <Ionicons name="trophy" size={20} color="#eab308" />
              <Text style={styles.tileTextLight}>leaderboard</Text>
            </Pressable>
          </Link>

          <Pressable
            style={[styles.tile, styles.tileAmber]}
            onPress={onInvite}
            android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
          >
            <Ionicons
              name="share-social"
              size={20}
              color="#111827"
            />
            <Text style={styles.tileTextDark}>share app</Text>
          </Pressable>
        </View>

        {/* privacy note */}
        <View style={styles.note}>
          <Ionicons
            name="lock-closed-outline"
            size={14}
            color="#cbd5e1"
          />
          <Text style={styles.noteText}>
            we only track location while a ride is active
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a1020' },
  container: { padding: 16, paddingBottom: 28 },

  orb: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 9999,
    opacity: 0.15,
    transform: [{ rotate: '25deg' }],
    filter: 'blur(18px)' as any,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: {
    height: 26,
    width: 26,
    borderRadius: 13,
    backgroundColor: '#052e24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#134e4a',
  },
  brand: {
    color: '#e5e7eb',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  pill: {
    backgroundColor: '#0b3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    color: '#052e24',
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'lowercase',
  },

  invite: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inviteText: {
    color: '#111827',
    fontWeight: '900',
    textTransform: 'lowercase',
  },

  heroCard: {
    backgroundColor: 'rgba(17,24,39,0.8)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    marginBottom: 14,
  },
  heroTop: { marginBottom: 10 },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
    textTransform: 'lowercase',
  },
  heroSub: { color: '#93c5fd', opacity: 0.9 },

  primaryCta: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    height: 48,
    shadowColor: '#22c55e',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaIconWrap: {
    height: 28,
    width: 28,
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  primaryCtaText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    textTransform: 'lowercase',
  },

  quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  quickItem: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
  },
  quickValue: { color: '#ffffff', fontWeight: '900' },
  quickLabel: {
    color: '#94a3b8',
    fontSize: 12,
    textTransform: 'lowercase',
  },

  sectionCard: {
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.12)',
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#e5e7eb',
    fontWeight: '900',
    textTransform: 'lowercase',
  },
  sectionMeta: { color: '#a5b4fc', fontWeight: '700' },
  link: {
    color: '#93c5fd',
    fontWeight: '800',
    textTransform: 'lowercase',
  },

  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#22c55e' },
  progressHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
  },

  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  avatar: {
    height: 36,
    width: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#052e24',
  },
  avatarText: { color: '#052e24', fontWeight: '900' },
  noFriendsText: {
    color: '#9ca3af',
    fontSize: 13,
    marginRight: 8,
  },
  friendPill: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  friendPillText: {
    color: '#111827',
    fontWeight: '800',
    textTransform: 'lowercase',
  },

  sectionKicker: {
    color: '#9ca3af',
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 8,
    textTransform: 'lowercase',
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '48%',
    height: 100,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  tileGreen: { backgroundColor: '#16a34a', borderColor: '#065f46' },
  tilePurple: { backgroundColor: '#7c3aed', borderColor: '#5b21b6' },
  tileSlate: { backgroundColor: '#111827', borderColor: '#334155' },
  tileAmber: { backgroundColor: '#f59e0b', borderColor: '#b45309' },

  tileTextLight: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  tileTextDark: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'lowercase',
  },

  note: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  noteText: { color: '#e5e7eb', fontSize: 12, flex: 1 },
});
