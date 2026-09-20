// Per-user hourly limits via the consume_quota() SQL function, called AS the user (their JWT), so auth.uid() is enforced by Postgres.
// Run it in parallel with the real work so it adds no latency to live voice turns.
export async function withinQuota(authHeader: string, bucket: string, limit: number): Promise<boolean> {
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !key) return true // not configured (e.g. local run): don't block
  try {
    const res = await fetch(`${url}/rest/v1/rpc/consume_quota`, {
      method: 'POST', headers: { apikey: key, Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_bucket: bucket, p_limit: limit }),
    })
    if (!res.ok) return true // fail open: a quota-table hiccup must not take the app down
    return (await res.json()) === true
  } catch { return true }
}
