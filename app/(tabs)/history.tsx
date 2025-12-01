import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polygon } from 'react-native-maps';
import { useState, useEffect } from 'react';
import { territoryAPI, Territory } from '../../services/api';
import Colors from '../../constants/Colors';

export default function HistoryScreen() {
  const [history, setHistory] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const tripHistory = await territoryAPI.getHistory();
        setHistory(tripHistory);
      } catch (err) {
        setError('Failed to fetch trip history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const renderTrip = ({ item }: { item: Territory }) => (
    <View style={styles.tripCard}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: item.coordinates[0][0].latitude,
          longitude: item.coordinates[0][0].longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Polygon
          coordinates={item.coordinates[0]}
          strokeColor={Colors.light.primary}
          fillColor="rgba(34, 197, 94, 0.2)"
        />
      </MapView>
      <View style={styles.tripDetails}>
        <Text style={styles.tripDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
        <Text style={styles.tripArea}>
          {(item.area_sq_meters * 0.000247105).toFixed(2)} acres
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <FlatList
        data={history}
        renderItem={renderTrip}
        keyExtractor={(item) => item.territory_id}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <View style={styles.header}>
            <Ionicons name="time-outline" size={48} color={Colors.light.primary} />
            <Text style={styles.title}>Trip History</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.subtitle}>No trips found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontFamily: 'SpaceMono',
  },
  listContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'SpaceMono',
    marginTop: 16,
  },
  subtitle: {
    color: Colors.dark.text,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'SpaceMono',
  },
  tripCard: {
    backgroundColor: Colors.light.secondary,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  map: {
    height: 200,
  },
  tripDetails: {
    padding: 16,
  },
  tripDate: {
    color: Colors.dark.text,
    fontFamily: 'SpaceMono',
    fontSize: 16,
  },
  tripArea: {
    color: Colors.light.primary,
    fontFamily: 'SpaceMono',
    fontSize: 14,
    marginTop: 4,
  },
});
