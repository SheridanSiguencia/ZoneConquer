// app/login.tsx
// sign in ui with a big centered create account button under sign in

import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { authAPI } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)

  // after “login”, go straight to the app
  const goToApp = () => router.replace('/(tabs)')

  // fake sign-in: show a spinner briefly, then navigate
  const onSignIn = async () => {
    setLoading(true)
    try {
      // Actually checks with your backend
      const result = await authAPI.login({ email, password: pass })
      
      // ✅ Check if the response indicates success
      if (result.success) {
        goToApp()
      } else {
        // 🚨 Handle backend error (invalid credentials, etc.)
        alert(`Login failed: ${result.error}`)
      }
    } catch (error) {
      // 🚨 Handle network errors or API failures
      alert(`Login failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.container}>
        {/* brand */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="map-outline" size={36} color="#22c55e" />
          </View>
          <Text style={styles.title}>ZoneConquer</Text>
          <Text style={styles.subtitle}>walk. ride. claim your territory.</Text>
        </View>

        {/* card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>sign in</Text>

          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#94a3b8"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="password"
              secureTextEntry
              value={pass}
              onChangeText={setPass}
              placeholderTextColor="#94a3b8"
              returnKeyType="go"
              onSubmitEditing={onSignIn}
            />
          </View>

          {/* primary sign in */}
          <Pressable
            style={[styles.btn, (!email || !pass || loading) && styles.btnDisabled]}
            onPress={onSignIn}
            disabled={!email || !pass || loading}
          >
            {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>sign in</Text>}
          </Pressable>

          {/* create account — same style as sign in */}
          <Pressable
          style={[styles.btn, { marginTop: 10 }]}
          onPress={() => router.push('/signup')}
          >
          <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnText}>create account</Text>
          </Pressable>

          {/* guest path for demos */}
          <Pressable onPress={goToApp} style={{ marginTop: 10 }}>
            <Text style={styles.link}>continue as guest</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>
          by continuing you agree to our <Text style={styles.link}>terms</Text> &{' '}
          <Text style={styles.link}>privacy</Text>.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 18 },
  logoCircle: {
    height: 64, width: 64, borderRadius: 9999,
    backgroundColor: '#e6ffef',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title: { fontSize: 28, fontWeight: '900', color: '#111827' },
  subtitle: { color: '#475569', marginTop: 4, textAlign: 'center' },

  card: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, color: '#111827' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  input: { flex: 1, color: '#111827' },

  btn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    marginTop: 4,
    flexDirection: 'row',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '800' },

  // big centered create account button
  btnBig: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  // NEW: solid, high-contrast button so text is visible
  btnBigGreen: {
    backgroundColor: '#16a34a',
    borderWidth: 2,
    borderColor: '#065f46',
  },
  btnBigText: { color: 'white', fontWeight: '900', fontSize: 16 },

  link: { color: '#2563eb', fontWeight: '700' },
  footer: { textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 12 },
})
