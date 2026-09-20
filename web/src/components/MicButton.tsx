import { useEffect, useRef, useState } from 'react'
import { createRecognizer, sttSupported, type Recognizer } from '../lib/speech'

/** Dictation into a text field via Web Speech API. Hidden where unsupported. */
export default function MicButton({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const [on, setOn] = useState(false)
  const rec = useRef<Recognizer | null>(null)
  useEffect(() => () => rec.current?.stop(), [])
  if (!sttSupported) return null
  function toggle() {
    if (on) { rec.current?.stop(); setOn(false); return }
    rec.current = createRecognizer('en-US', {
      onFinal: onText,
      onError: (c) => onError(c === 'not-allowed' ? 'Microphone permission was denied — allow it in your browser, or type instead.' : `Speech error: ${c}`),
      onEnd: () => setOn(false),
    })
    rec.current.start(); setOn(true)
  }
  return <button type="button" onClick={toggle} className={`rounded-lg border px-3 py-1.5 text-sm ${on ? 'border-red-400 text-red-300 animate-pulse' : 'border-slate-600'}`}>{on ? '● Listening…' : '🎤 Speak'}</button>
}
