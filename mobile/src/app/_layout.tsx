import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AppProvider, useApp } from '@/lib/auth'
import { GoalDataProvider } from '@/lib/goalData'
import { C } from '@/lib/theme'

SplashScreen.preventAutoHideAsync()
const Splash = () => <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primarySoft} /></View>

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading, goalsLoaded, goalId } = useApp()
  const ready = fontsReady && !loading && (!session || goalsLoaded)
  useEffect(() => { if (ready) SplashScreen.hideAsync() }, [ready])
  if (!ready) return <Splash />

  // Stack.Protected redirects to the first accessible screen: no session -> auth; session without goals -> onboarding; else tabs.
  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!session}><Stack.Screen name="auth" options={{ animation: 'fade' }} /></Stack.Protected>
      <Stack.Protected guard={!!session && !!goalId}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="diagnostic" options={{ gestureEnabled: false }} />
        <Stack.Screen name="practice/[skillId]" />
        <Stack.Screen name="review" />
        <Stack.Screen name="flashcards" />
        <Stack.Screen name="session/[type]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="result/[id]" options={{ animation: 'fade_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}><Stack.Screen name="onboarding" options={{ animation: 'slide_from_bottom' }} /></Stack.Protected>
    </Stack>
  )
  return goalId && session ? <GoalDataProvider goalId={goalId} fallback={<Splash />}>{stack}</GoalDataProvider> : stack
}

export default function Root() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold })
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppProvider><Gate fontsReady={loaded} /></AppProvider>
    </SafeAreaProvider>
  )
}
