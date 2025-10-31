// app/_layout.tsx
// root stack: login, signup, and your tabbed app

import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* auth screens */}
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />

      {/* main app (tabs group keeps its own headers) */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}
