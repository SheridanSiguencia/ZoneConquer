// app/settings.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

export default function SettingsScreen() {
  const [shareLocation, setShareLocation] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.section}>
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

        <View style={[styles.rowItem, styles.lastRowItem]}>
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

      <Text style={styles.smallPrint}>
        Settings are for demonstration and are not saved.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, backgroundColor: '#f8fafc', flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    backgroundColor: 'white',
    borderRadius: 9999,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  rowItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastRowItem: {
    borderBottomWidth: 0,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { color: '#111827', fontWeight: '600' },
  smallPrint: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 8 },
});
