import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg'
import { useMaybeGoalData } from '@/lib/goalData'
import { C, F, GRADIENT } from '@/lib/theme'

/** Full-screen dark aurora background with safe-area padding; scrolls by default. */
export function Screen({ children, scroll = true, bottomInset = 24 }: { children: ReactNode; scroll?: boolean; bottomInset?: number }) {
  const insets = useSafeAreaInsets()
  const offline = useMaybeGoalData()?.offline
  const pad = { paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + bottomInset }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={['#1b1440', '#0a0916', '#07070f']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={{ position: 'absolute', right: -90, top: 120, width: 260, height: 260, borderRadius: 130, backgroundColor: '#f472b6', opacity: 0.035 }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: -100, bottom: 80, width: 280, height: 280, borderRadius: 140, backgroundColor: '#22d3ee', opacity: 0.03 }} />
      {scroll ? <ScrollView contentContainerStyle={[pad, { gap: 14 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{offline && <OfflineBanner />}{children}</ScrollView>
        : <View style={[{ flex: 1 }, pad]}>{offline && <OfflineBanner />}{children}</View>}
    </View>
  )
}

const VARIANTS = {
  h1: { fontFamily: F.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: C.text },
  h2: { fontFamily: F.display, fontSize: 22, lineHeight: 27, letterSpacing: -0.3, color: C.text },
  title: { fontFamily: F.bodySemi, fontSize: 16, color: C.text },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.text },
  muted: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.muted },
  small: { fontFamily: F.body, fontSize: 12, color: C.faint },
  label: { fontFamily: F.bodySemi, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: C.muted },
} as const
export function T({ v = 'body', style, children, ...rest }: { v?: keyof typeof VARIANTS; style?: StyleProp<TextStyle>; children?: ReactNode } & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  return <Text {...rest} style={[VARIANTS[v] as TextStyle, style]}>{children}</Text>
}

/** Staggered entrance. Wrap list items with an increasing `i`. */
export function Rise({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Animated.View entering={FadeInDown.delay(i * 70).duration(500).springify().damping(16)} style={style}>{children}</Animated.View>
}

export function Card({ title, children, style, tint }: { title?: string; children: ReactNode; style?: StyleProp<ViewStyle>; tint?: string }) {
  return (
    <View style={[{ backgroundColor: tint ?? C.card, borderColor: tint ? tint : C.border, borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 }, style]}>
      {title && <T v="label">{title}</T>}
      {children}
    </View>
  )
}

export function Button({ label, onPress, disabled, loading, variant = 'primary', style }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'ghost'; style?: StyleProp<ViewStyle>
}) {
  const s = useSharedValue(1)
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }))
  const off = disabled || loading
  return (
    <Animated.View style={[anim, { opacity: off ? 0.5 : 1 }, style]}>
      <Pressable disabled={off} onPressIn={() => { s.value = withSpring(0.96, { damping: 15 }) }} onPressOut={() => { s.value = withSpring(1, { damping: 12 }) }}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress() }}>
        {variant === 'primary' ? (
          <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={btn.base}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={btn.text}>{label}</Text>}
          </LinearGradient>
        ) : (
          <View style={[btn.base, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}><Text style={btn.text}>{label}</Text></View>
        )}
      </Pressable>
    </Animated.View>
  )
}
const btn = StyleSheet.create({
  base: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  text: { fontFamily: F.bodySemi, fontSize: 16, color: '#fff' },
})

export const Chip = ({ label, color = C.muted }: { label: string; color?: string }) => (
  <View style={{ alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: color + '26', borderWidth: 1, borderColor: color + '44' }}>
    <Text style={{ fontFamily: F.bodyMed, fontSize: 12, color, textTransform: 'capitalize' }}>{label}</Text>
  </View>
)

export function Spinner({ label }: { label?: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8 }}><ActivityIndicator color={C.primarySoft} />{label && <T v="muted">{label}</T>}</View>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Animated.View entering={FadeInDown} style={{ backgroundColor: '#f8717120', borderColor: '#f8717155', borderWidth: 1, borderRadius: 14, padding: 12, gap: 6 }}>
      <T v="muted" style={{ color: '#fca5a5' }}>{message}</T>
      {onRetry && <Pressable onPress={onRetry}><T v="title" style={{ color: '#fca5a5' }}>Retry</T></Pressable>}
    </Animated.View>
  )
}

export const Empty = ({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) => (
  <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
    <T v="h2" style={{ textAlign: 'center' }}>{title}</T>
    {hint && <T v="muted" style={{ textAlign: 'center' }}>{hint}</T>}
    {children}
  </Card>
)

export function CountUp({ value, duration = 900, style }: { value: number; duration?: number; style?: StyleProp<TextStyle> }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = Date.now()
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / duration)
      setN(value * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <Text style={style}>{Math.round(n)}</Text>
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
export function Gauge({ value, max = 100, size = 130, children }: { value: number; max?: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 10, c = 2 * Math.PI * r
  const p = useSharedValue(0)
  useEffect(() => { p.value = withTiming(Math.min(1, value / max), { duration: 1400, easing: Easing.out(Easing.cubic) }) }, [value, max, p])
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }))
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs><SvgGradient id="g" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7c5cff" /><Stop offset="1" stopColor="#f472b6" /></SvgGradient></Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={9} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke="url(#g)" strokeWidth={9} strokeLinecap="round" fill="none" strokeDasharray={c} animatedProps={props} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  )
}

export function Bar({ value, max = 100 }: { value: number; max?: number }) {
  const w = useSharedValue(0)
  useEffect(() => { w.value = withTiming(Math.min(1, value / max), { duration: 900, easing: Easing.out(Easing.cubic) }) }, [value, max, w])
  const s = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }))
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: 4, overflow: 'hidden' }, s]}>
        <LinearGradient colors={['#7c5cff', '#f472b6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  )
}

import { TextInput, type TextInputProps } from 'react-native'
export function Input(props: TextInputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <TextInput placeholderTextColor={C.faint} {...props} onFocus={(e) => { setFocus(true); props.onFocus?.(e) }} onBlur={(e) => { setFocus(false); props.onBlur?.(e) }}
      style={[{ fontFamily: F.body, fontSize: 16, color: C.text, minHeight: 50, borderRadius: 14, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1, borderColor: focus ? C.primarySoft : C.border }, props.style]} />
  )
}

/** Round glass back button. Falls back to home when there is nothing to go back to (e.g. deep link). */
export function BackButton({ onPress, label = 'Back' }: { onPress?: () => void; label?: string }) {
  const router = useRouter()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10}
      onPress={() => { Haptics.selectionAsync(); if (onPress) onPress(); else if (router.canGoBack()) router.back(); else router.replace('/') }}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.cardStrong : C.card, borderWidth: 1, borderColor: C.border, transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Ionicons name="chevron-back" size={22} color={C.text} />
    </Pressable>
  )
}

const OfflineBanner = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, borderColor: '#fbbf2455', backgroundColor: '#fbbf2418', paddingHorizontal: 12, paddingVertical: 8 }}>
    <T>📴</T><T v="small" style={{ color: C.amber, flex: 1 }}>Offline — showing your last saved progress. New answers will sync when you reconnect.</T>
  </View>
)
