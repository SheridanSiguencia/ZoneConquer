// app/forgot-password.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { authAPI } from '../services/api';
import Colors from '../constants/Colors';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRequestReset = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      // Call your backend API to request a password reset
      // This is a placeholder, replace with actual API call
      const result = await authAPI.requestPasswordReset(email);

      if (result.success) {
        setMessage('Password reset link sent to your email!');
      } else {
        setError(result.error || 'Failed to send password reset link.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
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
              <Ionicons name="lock-closed-outline" size={48} color={Colors.light.primary} />
              <Text style={styles.title}>Forgot Password?</Text>
              <Text style={styles.subtitle}>
                Enter your email to receive a password reset link.
              </Text>
            </View>

            <View style={styles.card}>
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
                  returnKeyType="go"
                  onSubmitEditing={onRequestReset}
                />
              </View>

              <Pressable
                style={[styles.btn, (!email || loading) && styles.btnDisabled]}
                onPress={onRequestReset}
                disabled={!email || loading}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.dark.text} />
                ) : (
                  <Text style={styles.btnText}>Send Reset Link</Text>
                )}
              </Pressable>

              {message && <Text style={styles.message}>{message}</Text>}
              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.link}>Back to Login</Text>
              </Pressable>
            </View>
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
  message: {
    color: Colors.light.primary,
    fontFamily: 'SpaceMono',
    marginTop: 16,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    fontFamily: 'SpaceMono',
    marginTop: 16,
    textAlign: 'center',
  },
});
