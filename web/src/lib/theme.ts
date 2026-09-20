import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const KEY = 'learnloop:theme'
export function initialTheme(): Theme {
  try { const s = localStorage.getItem(KEY); if (s === 'light' || s === 'dark') return s } catch { /* private mode */ }
  return matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
export const applyTheme = (t: Theme) => { document.documentElement.dataset.theme = t }

export function useTheme() {
  const [theme, set] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'dark')
  useEffect(() => { applyTheme(theme); try { localStorage.setItem(KEY, theme) } catch { /* ignore */ } }, [theme])
  return { theme, toggle: () => set((t) => (t === 'dark' ? 'light' : 'dark')) }
}
