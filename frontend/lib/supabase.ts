import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// ── Server client (service role — for API routes only, never expose to client) ─
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) throw new Error('Missing Supabase server env vars')

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── Browser client (anon key — safe to use in client components) ──────────────
let browserClient: ReturnType<typeof createClient<Database>> | null = null

export function createBrowserClient() {
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing Supabase public env vars')

  browserClient = createClient<Database>(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })

  return browserClient
}
