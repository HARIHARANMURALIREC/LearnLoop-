import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router/js-tabs'
import { Platform, StyleSheet } from 'react-native'
import { C, F } from '@/lib/theme'

const icon = (name: keyof typeof Ionicons.glyphMap, focused: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused: f, size }: { color: import("react-native").ColorValue; focused: boolean; size: number }) => <Ionicons name={f ? focused : name} size={size} color={color} />

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false, tabBarActiveTintColor: C.primarySoft, tabBarInactiveTintColor: C.faint,
      tabBarLabelStyle: { fontFamily: F.bodyMed, fontSize: 11 },
      tabBarStyle: { position: 'absolute', backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(10,9,22,0.96)', borderTopColor: C.border, elevation: 0 },
      tabBarBackground: () => (Platform.OS === 'ios' ? <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} /> : null),
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: icon('flash-outline', 'flash') }} />
      <Tabs.Screen name="simulate" options={{ title: 'Simulate', tabBarIcon: icon('mic-outline', 'mic') }} />
      <Tabs.Screen name="more" options={{ title: 'You', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  )
}
