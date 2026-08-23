import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const ADMIN_TOKEN = process.env.DEMO_ADMIN_TOKEN

type AdminAction = 'layout_v1' | 'layout_v2' | 'in_stock' | 'out_of_stock' | 'reset'

export async function POST(request: NextRequest) {
  if (!ADMIN_TOKEN) return NextResponse.json({ error: 'Demo admin is not configured' }, { status: 503 })

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action } = await request.json() as { action: AdminAction }
  const now = new Date().toISOString()
  let update: Record<string, unknown>

  switch (action) {
    case 'layout_v1':
      update = { layout_version: 'v1', updated_at: now }
      break
    case 'layout_v2':
      update = { layout_version: 'v2', updated_at: now }
      break
    case 'in_stock':
      update = {
        panel_440w_in_stock: true,
        panel_550w_in_stock: true,
        panel_375w_in_stock: true,
        updated_at: now,
      }
      break
    case 'out_of_stock':
      // The primary 440W item sells out. The cheaper 375W alternative remains
      // available, forcing a genuine 2S×2P -> 3S×2P recompilation for the
      // recommended live-demo requirement.
      update = { panel_440w_in_stock: false, updated_at: now }
      break
    case 'reset':
      update = {
        layout_version: 'v1',
        panel_440w_in_stock: true,
        panel_550w_in_stock: true,
        panel_375w_in_stock: true,
        updated_at: now,
      }
      break
    default:
      return NextResponse.json({ error: `Unknown action: ${String(action)}` }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('demo_store_state')
    .update(update)
    .eq('id', 1)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, action, state: data })
}

export async function GET() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('demo_store_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ state: data })
}
