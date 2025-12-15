import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserStore } from '../../store/user';
import Colors from '../../constants/Colors';

export default function ProfileScreen() {
  const {
    user,
    logout,
    stats,
    profile,
    loading,
    error,
    achievements,
    challenges,
    userAchievements,
    userChallenges,
    fetchUserStats,
    fetchUserProfile,
    fetchAchievements,
    fetchChallenges,
    fetchUserProgress,
  } = useUserStore();

  // fetch on if user exists
  useEffect(() => {
    if (user) {
      fetchUserStats();
      fetchUserProfile();
      fetchAchievements();
      fetchChallenges();
      fetchUserProgress();
    }
  }, [user]); 

  const onInvite = useCallback(async () => {
    try {
      await Share.share({
        message:
          'join me on zoneconquer — walk, ride, and claim territory!\nhttps://zoneconquer.app',
      });
    } catch {
      // ignore share errors for now
    }
  }, []);

  const onLogout = () => {
    logout();
    router.replace('/login');
  };

  return (
    <LinearGradient
      colors={[Colors.dark.background, Colors.light.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.headerCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.username?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile?.username || 'User'}</Text>
              <Text style={styles.handle}>@{profile?.username?.toLowerCase() || 'user'}</Text>
              <Text style={styles.memberSince}>
                Member since {profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024'}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Link href="/customize" asChild>
                <Pressable style={styles.editBtn}>
                  <Ionicons name="create-outline" size={16} color={Colors.light.secondary} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              </Link>
              <Link href="/settings" asChild>
                <Pressable style={styles.settingsBtn}>
                  <Ionicons name="settings-outline" size={18} color={Colors.light.secondary} />
                </Pressable>
              </Link>
            </View>
          </View>

          {loading && <ActivityIndicator color={Colors.dark.text} />}
          {error && <Text style={{ color: 'red' }}>{error}</Text>}
          {stats && (
            <View style={styles.statsRow}>
              {/* Weekly Goal Progress - Since there's no XP in UserStats */}
              <View style={[styles.statCard, { backgroundColor: Colors.light.secondary }]}>
                <Ionicons name="trophy-outline" size={18} color="#fde68a" />
                <Text style={styles.statValue}>
                  {stats.weekly_goal > 0 
                    ? `${((stats.weekly_distance / stats.weekly_goal) * 100).toFixed(0)}%` 
                    : '0%'}
                </Text>
                <Text style={styles.statLabel}>Weekly</Text>
              </View>

              {/* Territories Owned */}
              <View style={[styles.statCard, { backgroundColor: Colors.light.primary }]}>
                <Ionicons name="expand-outline" size={18} color="#bbf7d0" />
                <Text style={styles.statValue}>{stats.territories_owned || 0}</Text>
                <Text style={styles.statLabel}>Territory</Text>
              </View>

              {/* Current Streak */}
              <View style={[styles.statCard, { backgroundColor: '#064e3b' }]}>
                <Ionicons name="flame-outline" size={18} color="#fde68a" />
                <Text style={styles.statValue}>{stats.current_streak || 0}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.achList}>
              {achievements.map((ach) => {
                const userAch = userAchievements.find((ua) => ua.achievement_id === ach.achievement_id);
                const status = userAch ? (userAch.unlocked_at ? 'unlocked' : 'progress') : 'locked';
                const progress = userAch && ach.threshold ? (userAch.progress / ach.threshold) * 100 : 0;

                return (
                  <View key={ach.achievement_id} style={styles.achItem}>
                    <View style={[styles.achIcon, status === 'locked' && styles.achIconLocked]}>
                      <Ionicons
                        name={status === 'locked' ? 'lock-closed' : (ach.icon as any)}
                        size={20}
                        color={status === 'unlocked' ? Colors.light.primary : Colors.light.gray[400]}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.achText, status === 'locked' && styles.achTextLocked]}>
                        {ach.name}
                      </Text>
                      {status === 'progress' && ach.threshold && (
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Challenges</Text>
            <View style={styles.achList}>
              {challenges.map((challenge) => {
                const userCh = userChallenges.find((uc) => uc.challenge_id === challenge.challenge_id);
                const progress = userCh && challenge.goal_value ? 
                  (userCh.current_value / challenge.goal_value) * 100 : 0;

                return (
                  <View key={challenge.challenge_id} style={styles.achItem}>
                    <View style={styles.achIcon}>
                      <Ionicons name={challenge.icon as any} size={20} color={Colors.light.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.achText}>{challenge.name}</Text>
                      <Text style={styles.challengeDescription}>{challenge.description}</Text>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.actionBtn, styles.primary]} onPress={onInvite}>
              <Ionicons name="person-add" size={18} color={Colors.dark.text} />
              <Text style={styles.actionTextPrimary}>Invite Friends</Text>
            </Pressable>

            <Link href="/pending-requests" asChild>
              <Pressable style={[styles.actionBtn, styles.outline]}>
                <Ionicons name="mail-outline" size={18} color={Colors.light.secondary} />
                <Text style={styles.actionTextOutline}>Pending Requests</Text>
              </Pressable>
            </Link>

            <Link href="/friends-list" asChild>
              <Pressable style={[styles.actionBtn, styles.outline]}>
                <Ionicons name="people-outline" size={18} color={Colors.light.secondary} />
                <Text style={styles.actionTextOutline}>My Friends</Text>
              </Pressable>
            </Link>

            <Pressable
              style={[styles.actionBtn, styles.outline]}
              onPress={onLogout}
            >
              <Ionicons name="log-out-outline" size={18} color={Colors.light.secondary} />
              <Text style={styles.actionTextOutline}>Log out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 32, gap: 16 },
  headerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.dark.text, fontSize: 22, fontWeight: '900' },
  name: { fontSize: 20, fontWeight: '900', color: Colors.light.secondary, fontFamily: 'SpaceMono' },
  handle: { color: Colors.light.gray[500], fontFamily: 'SpaceMono' },
  memberSince: { color: Colors.light.gray[400], fontSize: 12, fontFamily: 'SpaceMono', marginTop: 4 },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.light.gray[200],
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtnText: { fontWeight: '800', color: Colors.light.secondary, fontFamily: 'SpaceMono' },
  settingsBtn: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: Colors.light.gray[200],
  },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statValue: { color: 'white', fontWeight: '900', fontSize: 16, fontFamily: 'SpaceMono' },
  statLabel: { color: 'white', opacity: 0.9, fontSize: 12, fontWeight: '600', fontFamily: 'SpaceMono' },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 12, color: Colors.light.secondary, fontFamily: 'SpaceMono' },
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
    backgroundColor: Colors.light.gray[100],
  },
  achText: { color: Colors.light.secondary, fontWeight: '600', fontSize: 15, fontFamily: 'SpaceMono' },
  achTextLocked: {
    color: Colors.light.gray[400],
  },
  challengeDescription: {
    color: Colors.light.gray[500],
    fontSize: 12,
    fontFamily: 'SpaceMono',
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.light.gray[200],
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.light.primary,
  },
  actions: { gap: 10 },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primary: { backgroundColor: Colors.light.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Colors.light.secondary },
  actionTextPrimary: { color: Colors.dark.text, fontWeight: '800', fontFamily: 'SpaceMono' },
  actionTextOutline: { color: Colors.light.secondary, fontWeight: '800', fontFamily: 'SpaceMono' },
});