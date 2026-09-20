export const C = {
  bg: '#07070f', card: 'rgba(255,255,255,0.055)', cardStrong: 'rgba(255,255,255,0.09)', border: 'rgba(255,255,255,0.09)',
  text: '#ececf6', muted: '#9a9ab8', faint: '#6f6f8f',
  primary: '#7c5cff', primarySoft: '#9d86ff', pink: '#f472b6', cyan: '#22d3ee',
  green: '#34d399', amber: '#fbbf24', red: '#f87171',
}
export const F = {
  display: 'SpaceGrotesk_700Bold', displayMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular', bodyMed: 'Inter_500Medium', bodySemi: 'Inter_600SemiBold',
}
export const GRADIENT = ['#7c5cff', '#b063ff', '#f472b6'] as const
/** Red -> green by mastery (matches web heatmap). */
export const masteryColor = (m: number) => `hsl(${Math.round((Math.min(100, Math.max(0, m)) / 100) * 130)}, 65%, 38%)`
