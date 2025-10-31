// app/signup.tsx
// create account ui (placeholder). submits then routes to tabs

import { Ionicons } from '@expo/vector-icons'
import { Link, router } from 'expo-router'
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

export default function SignUpScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const canSubmit = name && email && pass && confirm && pass === confirm

  const onCreate = () => {
    if (!canSubmit) return
    setLoading(true)
    // demo create flow
    setTimeout(() => {
      setLoading(false)
      router.replace('/(tabs)')
    }, 600)
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
            <Ionicons name='map-outline' size={36} color='#22c55e' />
          </View>
          <Text style={styles.title}>create account</Text>
          <Text style={styles.subtitle}>welcome to zoneconquer</Text>
        </View>

        {/* card */}
        <View style={styles.card}>
          <View style={styles.inputWrap}>
            <Ionicons name='person-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='full name'
              value={name}
              onChangeText={setName}
              placeholderTextColor='#94a3b8'
              returnKeyType='next'
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name='mail-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='email'
              autoCapitalize='none'
              keyboardType='email-address'
              value={email}
              onChangeText={setEmail}
              placeholderTextColor='#94a3b8'
              returnKeyType='next'
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name='lock-closed-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='password'
              secureTextEntry
              value={pass}
              onChangeText={setPass}
              placeholderTextColor='#94a3b8'
              returnKeyType='next'
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name='shield-checkmark-outline' size={18} color='#64748b' style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder='confirm password'
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              placeholderTextColor='#94a3b8'
              returnKeyType='go'
              onSubmitEditing={onCreate}
            />
          </View>

          <Pressable
            style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
            onPress={onCreate}
            disabled={!canSubmit || loading}
          >
            {loading ? <ActivityIndicator /> : <Text style={styles.btnText}>create account</Text>}
          </Pressable>

          <Link href='/login' asChild>
            <Pressable style={{ marginTop: 10 }}>
              <Text style={styles.link}>already have an account? sign in</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={styles.footer}>
          by creating an account you agree to our <Text style={styles.link}>terms</Text> &{' '}
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
    height: 48,
    marginTop: 6,
    flexDirection: 'row',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: 'white', fontWeight: '800' },

  link: { color: '#2563eb', fontWeight: '700' },
  footer: { textAlign: 'center', color: '#64748b', marginTop: 12, fontSize: 12 },
})
