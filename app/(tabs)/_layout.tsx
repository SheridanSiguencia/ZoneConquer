// app/(tabs)/_layout.tsx
// tabs wrapper: defines the bottom tab bar and per-tab headers

import { Ionicons } from '@expo/vector-icons';
import { Link, Tabs } from 'expo-router';
import { Platform, Pressable, Text } from 'react-native';
import { useColorScheme } from 'react-native';
import Colors from '../../constants/Colors';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitleStyle: {
          fontFamily: 'SpaceMono',
          fontSize: 22,
        },
        headerShadowVisible: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[500],
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontFamily: 'SpaceMono',
          fontSize: 12,
        },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 78 : 60,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          borderTopWidth: 0,
          backgroundColor: colors.secondary,
        },
      }}
    >
      {/* home tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
          headerRight: () => (
            <Link href="/(tabs)/map" asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.primary,
                }}
              >
                <Text style={{ color: 'white', fontFamily: 'SpaceMono' }}>Start Ride</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* ride / map tab */}
      <Tabs.Screen
        name="map"
        options={{
          title: 'Ride',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} size={size} color={color} />
          ),
          headerRight: () => (
            <Link href="/(tabs)/leaderboard" asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <Text style={{ color: colors.gray[200], fontFamily: 'SpaceMono' }}>Leaderboard</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* leaderboard tab */}
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
          ),
          headerRight: () => (
            <Link href="/(tabs)/map" asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: colors.secondary,
                  borderWidth: 1,
                  borderColor: colors.gray[200],
                }}
              >
                <Text style={{ color: colors.gray[200], fontFamily: 'SpaceMono' }}>Ride</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* history tab */}
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />

      {/* profile tab (two.tsx) */}
      <Tabs.Screen
        name="two"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
