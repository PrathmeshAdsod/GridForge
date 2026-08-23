import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
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
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('demo_store_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (error || !data) {
    // Fallback to default state if DB is unreachable
    return {
      id: 1,
      layout_version: 'v1',
      panel_440w_in_stock: true,
      panel_550w_in_stock: true,
      panel_375w_in_stock: false,
      updated_at: new Date().toISOString(),
    }
  }

  return data as DemoStoreState
}
