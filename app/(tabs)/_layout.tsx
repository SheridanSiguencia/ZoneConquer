// app/(tabs)/_layout.tsx
// tabs wrapper: defines the bottom tab bar and per-tab headers

import { Ionicons } from '@expo/vector-icons'
import { Link, Tabs } from 'expo-router'
import { Platform, Pressable, Text } from 'react-native'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        // show a top header on each tab
        headerShown: true,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontWeight: '800', fontSize: 22 },
        headerShadowVisible: false,

        // tab bar look and feel
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#64748b',
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 78 : 60,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          borderTopWidth: 0,
          backgroundColor: '#111827',
        },
      }}
    >
      {/* home tab */}
      <Tabs.Screen
        name='index'
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
          // quick action on the right: jump into the ride/map tab
          headerRight: () => (
            <Link href='/(tabs)/map' asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#22c55e',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Start Ride</Text>
                {/* END home tab */}
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* ride / map tab */}
      <Tabs.Screen
        name='map'
        options={{
          title: 'Ride',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'bicycle' : 'bicycle-outline'} size={size} color={color} />
          ),
          // handy link to leaderboard from here
          headerRight: () => (
            <Link href='/(tabs)/leaderboard' asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#111827',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>Leaderboard</Text>
                {/* END map tab */}
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* leaderboard tab */}
      <Tabs.Screen
        name='leaderboard'
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={size} color={color} />
          ),
          // quick hop back to ride
          headerRight: () => (
            <Link href='/(tabs)/map' asChild>
              <Pressable
                style={{
                  marginRight: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: '#111827',
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <Text style={{ color: '#e5e7eb', fontWeight: '800' }}>Ride</Text>
                {/* END leaderboard tab */}
              </Pressable>
            </Link>
          ),
        }}
      />

      {/* profile tab (two.tsx) */}
      <Tabs.Screen
        name='two'
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
