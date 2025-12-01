import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
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

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = name && email && pass && confirm && pass === confirm;

  const onCreate = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const result = await authAPI.register({ username: name, email, password: pass });

      if (result.success) {
        alert('Registration successful! Please log in.');
        router.push('/login');
      } else {
        alert(`Registration failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Registration failed: ${error.message}`);
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
              <Ionicons name="person-add-outline" size={48} color={Colors.light.primary} />
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Join ZoneConquer today.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={Colors.light.gray[500]} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  value={name}
                  onChangeText={setName}
                  placeholderTextColor={Colors.light.gray[400]}
                  returnKeyType="next"
                />
              </View>

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
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="shield-checkmark-outline" size={18} color={Colors.light.gray[500]} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  secureTextEntry
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholderTextColor={Colors.light.gray[400]}
                  returnKeyType="go"
                  onSubmitEditing={onCreate}
                />
              </View>

              <Pressable
                style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
                onPress={onCreate}
                disabled={!canSubmit || loading}
              >
                {loading ? <ActivityIndicator color={Colors.dark.text} /> : <Text style={styles.btnText}>Create Account</Text>}
              </Pressable>

              <Link href="/login" asChild>
                <Pressable style={{ marginTop: 16, alignItems: 'center' }}>
                  <Text style={styles.link}>Already have an account? Sign in</Text>
                </Pressable>
              </Link>
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
});