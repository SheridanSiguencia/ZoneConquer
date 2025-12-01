// app/_layout.tsx
// root stack: login, signup, and your tabbed app

import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import CustomSplashScreen from './splash';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: SpaceMono_400Regular,
  });

  if (!fontsLoaded) {
    return <CustomSplashScreen />;
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="splash" />
        {/* auth screens */}
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />

        {/* main app (tabs group keeps its own headers) */}
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}