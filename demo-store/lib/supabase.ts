import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase demo-store environment variables')

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface DemoStoreState {
  id: number
  layout_version: 'v1' | 'v2'
  panel_440w_in_stock: boolean
  panel_550w_in_stock: boolean
  panel_375w_in_stock: boolean
  updated_at: string
}

export async function getDemoStoreState(): Promise<DemoStoreState> {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('demo_store_state')
      .select('*')
      .eq('id', 1)
      .single()

    if (!error && data) return data as DemoStoreState
  } catch (error) {
    console.error('[demo-store] state lookup failed:', error instanceof Error ? error.message : String(error))
  }

  // Honest resilience fallback: it only keeps the controlled demo target online;
  // it is not used by GridForge Live Mode as scraped product data.
  return {
    id: 1,
    layout_version: 'v1',
    panel_440w_in_stock: true,
    panel_550w_in_stock: true,
    panel_375w_in_stock: true,
    updated_at: new Date().toISOString(),
  }
}
