import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

const COLORS = ['#7c5cff', '#b063ff', '#f472b6', '#22d3ee', '#fbbf24', '#34d399']

function Piece({ seed, w, h }: { seed: number; w: number; h: number }) {
  const p = useSharedValue(0)
  // deterministic pseudo-random per piece so renders are stable
  const r = (n: number) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  const vx = (r(1) - 0.5) * w * 1.1, vy = h * (0.45 + r(2) * 0.5), spin = (r(3) - 0.5) * 900, size = 6 + r(4) * 7, color = COLORS[Math.floor(r(5) * COLORS.length)]
  useEffect(() => { p.value = withTiming(1, { duration: 1700 + r(6) * 900, easing: Easing.out(Easing.quad) }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const s = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [{ translateX: vx * p.value }, { translateY: -vy * p.value + 0.9 * h * p.value * p.value }, { rotate: `${spin * p.value}deg` }],
  }))
  return <Animated.View style={[{ position: 'absolute', left: w / 2, top: h * 0.6, width: size, height: size * 0.65, backgroundColor: color, borderRadius: 1.5 }, s]} />
}

/** Confetti burst. Change `burst` (any number > 0) to fire it; remounts per burst. */
export function Confetti({ burst, count = 70 }: { burst: number; count?: number }) {
  const { width, height } = useWindowDimensions()
  if (!burst) return null
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }, (_, i) => <Piece key={`${burst}-${i}`} seed={burst * 1000 + i} w={width} h={height} />)}
    </View>
  )
}
