import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '../constants/Colors';
import { Friend, friendsAPI } from '../services/api';

const METERS_TO_MILES = 0.000621371;

export default function FriendsListScreen() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // getFriends returns Friend[]
      const list = await friendsAPI.getFriends();
      setFriends(list);
    } catch (err: any) {
      setError(
        err?.message || 'An unexpected error occurred while fetching friends.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFriends();
    }, [fetchFriends]),
  );

  const handleRemoveFriend = (friendId: string, username: string) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${username} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await friendsAPI.removeFriend(friendId);
              Alert.alert(
                'Success',
                result.message || `${username} removed.`,
              );
              fetchFriends();
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.message ||
                  `An unexpected error occurred while removing ${username}.`,
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.light.secondary}
            />
          </Pressable>
          <Text style={styles.title}>My Friends</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons
              name="arrow-back"
              size={24}
              color={Colors.light.secondary}
            />
          </Pressable>
          <Text style={styles.title}>My Friends</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchFriends} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons
            name="arrow-back"
            size={24}
            color={Colors.light.secondary}
          />
        </Pressable>
        <Text style={styles.title}>My Friends</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {friends.length === 0 ? (
          <Text style={styles.noFriendsText}>
            You have no friends yet. Send a request!
          </Text>
        ) : (
          friends.map((friend) => {
            // weekly_distance comes from DB; may be null/undefined or string
            const weeklyMeters =
              friend.weekly_distance != null
                ? Number(friend.weekly_distance)
                : 0;
            const weeklyMiles = weeklyMeters * METERS_TO_MILES;

            const zones =
              friend.territories_owned != null
                ? Number(friend.territories_owned)
                : 0;

            return (
              <View key={friend.user_id} style={styles.friendCard}>
                <View style={styles.friendInfo}>
                  <View className="avatar" style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {friend.username[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.friendUsername}>{friend.username}</Text>
                    <Text style={styles.friendStats}>
                      {weeklyMiles.toFixed(1)} mi this week • {zones} zones
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.removeButton}
                  onPress={() =>
                    handleRemoveFriend(friend.user_id, friend.username)
                  }
                >
                  <Ionicons
                    name="person-remove"
                    size={20}
                    color={Colors.light.secondary}
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.gray[800],
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.light.text,
    fontFamily: 'SpaceMono',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.light.gray[400],
    marginTop: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.dark.text,
    fontWeight: 'bold',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 12,
  },
  noFriendsText: {
    color: Colors.light.gray[400],
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  friendCard: {
    backgroundColor: Colors.dark.gray[900],
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.gray[800],
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    height: 40,
    width: 40,
    borderRadius: 9999,
    backgroundColor: Colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'SpaceMono',
  },
  friendUsername: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  friendStats: {
    color: Colors.light.gray[400],
    fontSize: 12,
    fontFamily: 'SpaceMono',
  },
  removeButton: {
    padding: 8,
  },
});
