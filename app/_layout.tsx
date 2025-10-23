// app/_layout.tsx
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* Login route (no header) */}
      <Stack.Screen name="login" options={{ headerShown: false }} />
      {/* Tabs group (no header; the tabs header is managed inside (tabs)/_layout) */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Optional modal (keep only if you use app/modal.tsx) */}
      <Stack.Screen name="modal" options={{ presentation: "modal", title: "" }} />
    </Stack>
  );
}
