// Voice pipeline for native: expo-speech-recognition (STT) + ElevenLabs via the `tts` Edge Function (TTS), with expo-speech as fallback.
// STT is a native module: it is absent in Expo Go, so it is loaded defensively and the UI falls back to typing.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import * as Speech from 'expo-speech'
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let STT: any = null
try { STT = require('expo-speech-recognition').ExpoSpeechRecognitionModule } catch { /* Expo Go: no native module */ }
export const sttSupported = !!STT

export interface Recognizer { start(): void; stop(): void }
export function createRecognizer(lang: string, h: {
  onInterim?: (t: string) => void; onFinal: (t: string) => void; onError: (code: string) => void; onEnd: (gotResult: boolean) => void
}): Recognizer {
  let got = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subs: any[] = []
  const cleanup = () => { subs.splice(0).forEach((s) => s.remove()) }
  return {
    async start() {
      got = false
      const perm = await STT.requestPermissionsAsync()
      if (!perm.granted) return h.onError('not-allowed')
      cleanup()
      subs.push(STT.addListener('result', (e: { results: { transcript: string }[]; isFinal: boolean }) => {
        const t = e.results?.[0]?.transcript ?? ''
        if (e.isFinal) { got = true; h.onFinal(t.trim()) } else if (t) h.onInterim?.(t)
      }))
      subs.push(STT.addListener('error', (e: { error: string }) => h.onError(e.error)))
      subs.push(STT.addListener('end', () => { cleanup(); h.onEnd(got) }))
      STT.start({ lang, interimResults: true, continuous: false })
    },
    stop() { try { STT.abort() } catch { /* not running */ } cleanup() },
  }
}

let player: AudioPlayer | null = null
let playId = 0 // a slow network response must not play after the session moved on
let audioModeSet = false

/** Speaks with the ElevenLabs voice; falls back to the device voice on any failure. */
export function speak(text: string, lang: string, onEnd: () => void, premium = true) {
  stopSpeaking()
  const id = ++playId
  const device = () => { if (id === playId) Speech.speak(text, { language: lang, onDone: onEnd, onError: onEnd, onStopped: () => {} }) }
  if (!premium) return device()
  ;(async () => {
    try {
      if (!audioModeSet) { await setAudioModeAsync({ playsInSilentMode: true }); audioModeSet = true }
      const { data } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`tts ${res.status}`)
      const file = new File(Paths.cache, `tts-${id}.mp3`)
      file.create({ overwrite: true })
      file.write(new Uint8Array(await res.arrayBuffer()))
      if (id !== playId) return
      const p = createAudioPlayer({ uri: file.uri })
      player = p
      p.addListener('playbackStatusUpdate', (s) => {
        if (!s.didJustFinish) return
        p.remove(); if (player === p) player = null
        try { file.delete() } catch { /* cache is best-effort */ }
        if (id === playId) onEnd()
      })
      p.play()
    } catch { device() }
  })()
}

export function stopSpeaking() {
  playId++
  if (player) { try { player.pause(); player.remove() } catch { /* already released */ } player = null }
  Speech.stop()
}
