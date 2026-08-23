import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const ADMIN_TOKEN = process.env.DEMO_ADMIN_TOKEN

type AdminAction = 'layout_v1' | 'layout_v2' | 'in_stock' | 'out_of_stock' | 'reset'

export async function POST(request: NextRequest) {
  // Auth check
  const auth = request.headers.get('authorization')
  if (!auth || auth !== `Bearer ${ADMIN_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { action: AdminAction }
  const { action } = body

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  let update: Record<string, unknown> = {}

  switch (action) {
    case 'layout_v1':
      update = { layout_version: 'v1', updated_at: new Date().toISOString() }
      break
    case 'layout_v2':
      update = { layout_version: 'v2', updated_at: new Date().toISOString() }
      break
    case 'in_stock':
      update = {
        panel_440w_in_stock: true,
        panel_550w_in_stock: true,
        updated_at: new Date().toISOString()
      }
      break
    case 'out_of_stock':
      // Only panel_440w goes out of stock (primary product for demo)
      update = {
        panel_440w_in_stock: false,
        updated_at: new Date().toISOString()
      }
      break
    case 'reset':
      update = {
        layout_version: 'v1',
        panel_440w_in_stock: true,
        panel_550w_in_stock: true,
        panel_375w_in_stock: false,
        updated_at: new Date().toISOString()
      }
      break
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('demo_store_state')
    .update(update)
    .eq('id', 1)
    .select()
    .single()

  if (error) {
    console.error('[admin] Supabase update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    action,
    state: data,
    message: `Demo store updated: ${action}`
  })
}

export async function GET(request: NextRequest) {
  // Return current state (read-only, no auth required)
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('demo_store_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ state: data })
}
