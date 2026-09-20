import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Button, Input, Screen, T } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { C, GRADIENT } from '@/lib/theme'

export default function Auth() {
  const [mode, setMode] = useState<'signup' | 'login'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  async function submit() {
    setBusy(true); setError(''); setNotice('')
    const { data, error } = mode === 'signup' ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.status === 429 ? 'Too many emails sent recently. Wait a few minutes, or log in if you already have an account.' : error.message)
    else if (mode === 'signup' && !data.session) setNotice('Check your email to confirm your account, then log in. If you don\'t see it, check your spam inbox.')
    setBusy(false)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Animated.View entering={FadeInDown.duration(600)} style={{ marginTop: 40, gap: 12 }}>
          <LinearGradient colors={GRADIENT} style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}><T v="h2">↻</T></LinearGradient>
          <T v="h1" style={{ fontSize: 36, lineHeight: 40 }}>From “I want to become X” to <T v="h1" style={{ fontSize: 36, lineHeight: 40, color: C.primarySoft }}>“I’m provably ready.”</T></T>
          <T v="muted">Adaptive learning that diagnoses, teaches, simulates the real thing, and keeps the receipts.</T>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={{ backgroundColor: C.card, borderColor: C.border, borderWidth: 1, borderRadius: 26, padding: 18, gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 4 }}>
            {(['login', 'signup'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setError(''); setNotice('') }} style={{ flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: mode === m ? 'rgba(255,255,255,0.12)' : 'transparent' }}>
                <T v="title" style={{ color: mode === m ? C.text : C.muted, fontSize: 14 }}>{m === 'login' ? 'Log in' : 'Sign up'}</T>
              </Pressable>
            ))}
          </View>
          <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
          <View>
            <Input placeholder="Password (6+ chars)" secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChangeText={setPassword} style={{ paddingRight: 50 }} />
            <Pressable onPress={() => setShow((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 50, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.muted} />
            </Pressable>
          </View>
          {!!error && <T v="muted" style={{ color: '#fca5a5' }}>{error}</T>}
          {!!notice && <T v="muted" style={{ color: C.green }}>{notice}</T>}
          {mode === 'login' && (
            <View style={{ borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, padding: 12, gap: 2 }}>
              <T v="title" style={{ fontSize: 14 }}>🎮 Try the demo account</T>
              <T v="small" selectable>Email: demo@learnloop.dev</T>
              <T v="small" selectable>Password: Demo@12345</T>
              <Pressable onPress={() => { setEmail('demo@learnloop.dev'); setPassword('Demo@12345'); setError('') }} hitSlop={8}><T v="small" style={{ color: '#a5b4fc', marginTop: 4 }}>Fill in for me →</T></Pressable>
            </View>
          )}
          <Button label={mode === 'signup' ? 'Create account' : 'Log in'} loading={busy} disabled={!email || password.length < 6} onPress={submit} />
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  )
}
