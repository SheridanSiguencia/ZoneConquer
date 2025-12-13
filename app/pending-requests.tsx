import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/Colors';
import { friendsAPI, FriendRequest } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function PendingRequestsScreen() {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await friendsAPI.getPendingRequests();
      if (result.success) {
        setPendingRequests(result.pending_requests);
      } else {
        setError(result.error || 'Failed to fetch pending requests.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests();
    }, [fetchPendingRequests])
  );

  const handleAcceptRequest = async (friendshipId: string) => {
    setLoading(true);
    try {
      const result = await friendsAPI.acceptRequest(friendshipId);
      if (result.success) {
        Alert.alert('Success', result.message || 'Friend request accepted.');
        fetchPendingRequests(); // Refresh the list
      } else {
        Alert.alert('Error', result.error || 'Failed to accept friend request.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    setLoading(true);
    try {
      const result = await friendsAPI.rejectRequest(friendshipId);
      if (result.success) {
        Alert.alert('Success', result.message || 'Friend request rejected.');
        fetchPendingRequests(); // Refresh the list
      } else {
        Alert.alert('Error', result.error || 'Failed to reject friend request.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.secondary} />
          </Pressable>
          <Text style={styles.title}>Pending Requests</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.light.secondary} />
          </Pressable>
          <Text style={styles.title}>Pending Requests</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={fetchPendingRequests} style={styles.retryButton}>
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
          <Ionicons name="arrow-back" size={24} color={Colors.light.secondary} />
        </Pressable>
        <Text style={styles.title}>Pending Requests</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {pendingRequests.length === 0 ? (
          <Text style={styles.noRequestsText}>No pending friend requests.</Text>
        ) : (
          pendingRequests.map((request) => (
            <View key={request.friendship_id} style={styles.requestCard}>
              <Text style={styles.requestUsername}>{request.username}</Text>
              <View style={styles.requestActions}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptButton]}
                  onPress={() => handleAcceptRequest(request.friendship_id)}
                >
                  <Ionicons name="checkmark" size={18} color={Colors.dark.text} />
                  <Text style={styles.actionTextPrimary}>Accept</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.rejectButton]}
                  onPress={() => handleRejectRequest(request.friendship_id)}
                >
                  <Ionicons name="close" size={18} color={Colors.light.secondary} />
                  <Text style={styles.actionTextOutline}>Reject</Text>
                </Pressable>
              </View>
            </View>
          ))
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
  noRequestsText: {
    color: Colors.light.gray[400],
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  requestCard: {
    backgroundColor: Colors.dark.gray[900],
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.gray[800],
  },
  requestUsername: {
    color: Colors.light.text,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptButton: {
    backgroundColor: Colors.light.primary,
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.light.secondary,
  },
  actionTextPrimary: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  actionTextOutline: {
    color: Colors.light.secondary,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
});