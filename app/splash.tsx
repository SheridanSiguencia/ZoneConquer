// app/splash.tsx
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

export default function SplashScreen() {
  return (
    <LinearGradient
      colors={[Colors.dark.background, Colors.light.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.container}>
          <Ionicons name="map-outline" size={64} color={Colors.light.primary} />
          <Text style={styles.title}>ZoneConquer</Text>
          <ActivityIndicator color={Colors.dark.text} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: Colors.dark.text,
    fontFamily: 'SpaceMono',
    marginTop: 16,
  },
});
