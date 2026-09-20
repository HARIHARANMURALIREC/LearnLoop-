// POST /functions/v1/tts { text } -> audio/mpeg. Keeps the ElevenLabs key server-side.
// Returns 503 when unconfigured so the client can fall back to the browser voice.
import { withinQuota } from '../_shared/quota.ts'

const TTS_CALLS_PER_HOUR = Number(Deno.env.get('TTS_CALLS_PER_HOUR') ?? 300)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const err = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // Only signed-in users (the public anon key is also a valid JWT, so check the role).
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
    const role = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role
    if (role !== 'authenticated') return err('Sign in to use voice', 401)

    const key = Deno.env.get('ELEVENLABS_API_KEY')
    const voice = Deno.env.get('ELEVENLABS_VOICE_ID')
    if (!key || !voice) return err('ElevenLabs is not configured', 503)

    const { text } = await req.json()
    if (typeof text !== 'string' || !text.trim() || text.length > 600) return err('Invalid text', 400)

    if (!(await withinQuota(req.headers.get('Authorization')!, 'tts', TTS_CALLS_PER_HOUR))) return err('Hourly voice limit reached', 429)

    // flash model = lowest latency, multilingual (the conversation simulator speaks other languages)
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    })
    if (!res.ok) return err(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`, 502)
    return new Response(res.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e), 500)
  }
})
