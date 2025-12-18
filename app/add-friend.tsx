import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/Colors';
import { friendsAPI } from '../services/api';

export default function AddFriendScreen() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    if (!username) {
      Alert.alert('Error', 'Please enter a username.');
      return;
    }

    setLoading(true);
    try {
      const result = await friendsAPI.sendRequest(username);
      if (result.success) {
        Alert.alert('Success', result.message || `Friend request sent to ${username}.`);
        setUsername('');
      } else {
        Alert.alert('Error', result.error || 'Failed to send friend request.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.light.secondary} />
        </Pressable>
        <Text style={styles.title}>Add Friend</Text>
      </View>

      <View style={styles.container}>
        <Text style={styles.label}>Friend's Username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Enter username"
          placeholderTextColor={Colors.light.gray[400]}
          autoCapitalize="none"
        />

        <Pressable
          style={[styles.actionBtn, styles.primary, loading && styles.actionBtnDisabled]}
          onPress={handleSendRequest}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.dark.text} />
          ) : (
            <Text style={styles.actionTextPrimary}>Send Friend Request</Text>
          )}
        </Pressable>
      </View>
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
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  label: {
    fontWeight: '600',
    color: Colors.light.gray[300],
    fontFamily: 'SpaceMono',
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.dark.gray[800],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.dark.text,
    fontFamily: 'SpaceMono',
  },
  actionBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  primary: {
    backgroundColor: Colors.light.primary,
  },
  actionTextPrimary: {
    color: Colors.dark.text,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
  },
});
