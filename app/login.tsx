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
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import TermsModal from '../components/TermsModal';
// import { authAPI } from '../services/api';
import { useUserStore } from '../store/user';


import Colors from '../constants/Colors';

const TERMS_PREFIX = 'termsAccepted_v2';

const termsKeyFor = (id: string) =>
  `${TERMS_PREFIX}_${id.toLowerCase()}`;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const { login, loading, error } = useUserStore();


  const onSignIn = async () => {
    try {
      // Call the Zustand store login (which now handles API internally)
      const result = await login({ email, password: pass });
  
      if (result.success && result.user) {
        await maybeShowTermsFor(email);
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Login failed: ${error.message}`);
      } else {
        alert('Login failed: unexpected error');
      }
    }
  };

  const goToApp = () => router.replace('/(tabs)');

  const [showTerms, setShowTerms] = useState(false);
  const [termsMode, setTermsMode] = useState<'gate' | 'review' | null>(null);
  const [termsKey, setTermsKey] = useState<string | null>(null);

  const maybeShowTermsFor = async (id: string) => {
    const key = termsKeyFor(id);
    setTermsKey(key);

    try {
      const seen = await SecureStore.getItemAsync(key);
      if (seen === 'true') {
        return goToApp();
      }
    } catch (e) {
      console.warn('[Terms] SecureStore error', e);
    }

    setTermsMode('gate');
    setShowTerms(true);
  };

  const onAcceptTerms = async () => {
    if (termsMode === 'gate') {
      if (termsKey) {
        try {
          await SecureStore.setItemAsync(termsKey, 'true');
        } catch (e) {
          console.warn('[Terms] setItemAsync error', e);
        }
      }
      setShowTerms(false);
      goToApp();
    } else {
      setShowTerms(false);
    }
  };

  const onCloseTerms = () => {
    setShowTerms(false);
  };

  return (
    <LinearGradient
      colors={[Colors.dark.background, Colors.light.background]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <View style={styles.container}>
            <View style={styles.hero}>
              <Ionicons name="map-outline" size={48} color={Colors.light.primary} />
              <Text style={styles.title}>ZoneConquer</Text>
              <Text style={styles.subtitle}>Claim your territory.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign in</Text>

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.light.gray[500]} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor={Colors.light.gray[400]}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.light.gray[500]} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  secureTextEntry
                  value={pass}
                  onChangeText={setPass}
                  placeholderTextColor={Colors.light.gray[400]}
                  returnKeyType="go"
                  onSubmitEditing={onSignIn}
                />
              </View>

              <Pressable
                style={[styles.btn, (!email || !pass || loading) && styles.btnDisabled]}
                onPress={onSignIn}
                disabled={!email || !pass || loading}
              >
                {loading ? <ActivityIndicator color={Colors.dark.text} /> : <Text style={styles.btnText}>Sign In</Text>}
              </Pressable>

              <Pressable
                style={[styles.btn, { marginTop: 10, backgroundColor: Colors.light.secondary }]}
                onPress={() => router.push('/signup')}
              >
                <Ionicons name="person-add-outline" size={18} color={Colors.dark.text} style={{ marginRight: 8 }} />
                <Text style={styles.btnText}>Create account</Text>
              </Pressable>

              <Pressable onPress={() => router.push('/forgot-password')} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.link}>Forgot Password?</Text>
              </Pressable>
            </View>

            <TermsModal
              visible={showTerms}
              onAccept={onAcceptTerms}
              onClose={onCloseTerms}
            />

            <Pressable
              onPress={() => {
                setTermsMode('review');
                setShowTerms(true);
              }}
              style={{ marginTop: 24 }}
            >
              <Text style={styles.footer}>
                Review <Text style={styles.link}>Terms</Text> &{' '}
                <Text style={styles.link}>Privacy</Text>
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '900', color: Colors.dark.text, fontFamily: 'SpaceMono' },
  subtitle: { color: Colors.dark.text, marginTop: 8, textAlign: 'center', fontFamily: 'SpaceMono' },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', marginBottom: 16, color: Colors.light.secondary, fontFamily: 'SpaceMono' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.gray[100],
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 16,
  },
  input: { flex: 1, color: Colors.light.secondary, fontFamily: 'SpaceMono' },
  btn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: Colors.dark.text, fontWeight: '800', fontFamily: 'SpaceMono' },
  link: { color: Colors.light.primary, fontWeight: '700', fontFamily: 'SpaceMono' },
  footer: { textAlign: 'center', color: Colors.dark.text, marginTop: 12, fontSize: 12, fontFamily: 'SpaceMono' },
});
