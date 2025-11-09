// app/login.tsx
// simple login screen with fake auth
// sign in or continue as guest → goes to the tabs

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import TermsModal from '../components/TermsModal';
import { authAPI } from '../services/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)

  // after “login”, go straight to the app
  const goToApp = () => router.replace('/(tabs)')

  const TERMS_KEY = 'termsAccepted:v2';
  const [showTerms, setShowTerms] = useState(false);
  const [termsMode, setTermsMode] = useState<'gate' | 'review' | null>(null);


  const maybeShowTerms = async () => {
    try {
      const seen = await SecureStore.getItemAsync(TERMS_KEY);
      console.log('[Terms] getItemAsync ->', seen); // debug
      if (seen === 'true') {
        return goToApp();
      }
    } catch (e) {
      console.warn('[Terms] SecureStore error', e);
      // If SecureStore errors, still show the modal so users can proceed
    }
    setTermsMode('gate');
    setShowTerms(true);
  };

  const onAcceptTerms = async () => {
    if (termsMode === 'gate') {
      try {
        await SecureStore.setItemAsync(TERMS_KEY, 'true');
        console.log('[Terms] setItemAsync -> true');
      } catch (e) {
        console.warn('[Terms] setItemAsync error', e);
        // even if saving fails, let them proceed
      }
      setShowTerms(false);
      goToApp();                 // only navigate in GATE mode
    } else {
      // review mode: just close; no flag, no navigation
      setShowTerms(false);
    }
  };
    const onCloseTerms = () => {
    // always just close; stay on sign-in page
    setShowTerms(false);
  };

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
          <Text style={styles.cardTitle}>Sign in</Text>

          {/* email input */}
          <View style={styles.inputWrap}>
            <Ionicons name='mail-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='Email'
              autoCapitalize='none'
              keyboardType='email-address'
              value={email}
              onChangeText={setEmail}
              placeholderTextColor='#94a3b8'
              returnKeyType='next'
            />
          </View>

          {/* password input */}
          <View style={styles.inputWrap}>
            <Ionicons name='lock-closed-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='Password'
              secureTextEntry
              value={pass}
              onChangeText={setPass}
              placeholderTextColor='#94a3b8'
              returnKeyType='go'
              onSubmitEditing={onSignIn}
            />
          </View>

          {/* primary action */}
          <Pressable
            style={[styles.btn, (!email || !pass || loading) && styles.btnDisabled]}
            onPress={onSignIn}
            disabled={!email || !pass || loading}
          >
            {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>Sign In</Text>}
          </Pressable>
          {/* create account — same style as sign in */}
<Pressable
  style={[styles.btn, { marginTop: 10 }]}
  onPress={() => router.push('/signup')}
>
  <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
  <Text style={styles.btnText}>Create account</Text>
</Pressable>

          {/* quick way in for the demo */}
          <Pressable onPress={maybeShowTerms} style={{ marginTop: 8 }}>

            <Text style={styles.link}>Continue as guest</Text>
          </Pressable>
        </View>
        <TermsModal
  visible={showTerms}
  onAccept={onAcceptTerms}
  onClose={onCloseTerms}
/>


        {/* tiny legal line */}
       <Pressable onPress={() => { setTermsMode('review'); setShowTerms(true); }}>
  <Text style={styles.footer}>
    Review <Text style={styles.link}>Terms</Text> & <Text style={styles.link}>Privacy</Text>
  </Text>
</Pressable>

      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 20, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 18 },
  logoCircle: {
    height: 64,
    width: 64,
    borderRadius: 9999,
    backgroundColor: '#e6ffef',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
    backgroundColor: '#f1f5f9',
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
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '800' },

  link: { color: '#2563eb', fontWeight: '700' },
  footer: { textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 12 },
})

