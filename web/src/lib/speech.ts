// Browser voice pipeline: Web Speech API (STT) + SpeechSynthesis (TTS). The DOM lib lacks recognition types.
import { supabase } from './supabase'
/* eslint-disable @typescript-eslint/no-explicit-any */
const Rec: any = (globalThis as any).SpeechRecognition ?? (globalThis as any).webkitSpeechRecognition
export const sttSupported = !!Rec
export const ttsSupported = 'speechSynthesis' in globalThis

export interface Recognizer { start(): void; stop(): void }
export function createRecognizer(lang: string, h: {
  onInterim?: (t: string) => void
  onFinal: (t: string) => void
  onError: (code: string) => void
  onEnd: (gotResult: boolean) => void
}): Recognizer {
  const r = new Rec()
  r.lang = lang
  r.interimResults = true
  r.continuous = false
  let got = false
  r.onresult = (e: any) => {
    let interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i]
      if (res.isFinal) { got = true; h.onFinal(res[0].transcript.trim()) } else interim += res[0].transcript
    }
    if (interim) h.onInterim?.(interim)
  }
  r.onerror = (e: any) => h.onError(e.error)
  r.onend = () => h.onEnd(got)
  return { start: () => { got = false; try { r.start() } catch { /* already started */ } }, stop: () => { try { r.abort() } catch { /* noop */ } } }
}

let audio: HTMLAudioElement | null = null
let playId = 0 // guards against a slow ElevenLabs response playing after the session was stopped

function browserSpeak(text: string, lang: string, onEnd: () => void) {
  if (!ttsSupported) return onEnd()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const voice = speechSynthesis.getVoices().find((v) => v.lang === lang) ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)))
  if (voice) u.voice = voice
  u.onend = onEnd
  u.onerror = onEnd
  speechSynthesis.speak(u)
}

/** Speaks with the ElevenLabs voice (via the `tts` Edge Function); falls back to the browser voice on any failure. */
export function speak(text: string, lang: string, onEnd: () => void, premium = true) {
  stopSpeaking()
  if (!premium) return browserSpeak(text, lang, onEnd)
  const id = ++playId
  ;(async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error(`tts ${res.status}`)
      const url = URL.createObjectURL(await res.blob())
      if (id !== playId) return URL.revokeObjectURL(url) // stopped or superseded while loading
      const a = new Audio(url)
      audio = a
      const done = () => { URL.revokeObjectURL(url); if (audio === a) audio = null; if (id === playId) onEnd() }
      a.onended = done
      a.onerror = done
      await a.play()
    } catch {
      if (id === playId) browserSpeak(text, lang, onEnd)
    }
  })()
}

export function stopSpeaking() {
  playId++
  if (audio) { audio.onended = null; audio.onerror = null; audio.pause(); audio = null }
  if (ttsSupported) speechSynthesis.cancel()
}
