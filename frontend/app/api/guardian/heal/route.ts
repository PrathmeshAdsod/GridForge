import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const BD_API_BASE = 'https://api.brightdata.com'

async function brightData(path: string, options?: RequestInit) {
  const token = process.env.BRIGHT_DATA_API_TOKEN
  if (!token) throw new Error('Missing BRIGHT_DATA_API_TOKEN')

  const response = await fetch(`${BD_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Bright Data API ${response.status}: ${await response.text()}`)
  }

  return response
}

/**
 * Start the REAL Scraper Studio AI self-healing flow.
 * This does not merely rerun a broken collector: it calls refactor_template on
 * the same c_* collector. /api/guardian/heal/status polls/approves the job.
 */
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    sourceId: string
    reason?: string
    triggeredBy?: string
  }

  if (!body.sourceId) {
    return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { data: source } = await supabase
    .from('sources')
    .select('*')
    .eq('id', body.sourceId)
    .single()

  if (!source?.collector_id) {
    return NextResponse.json({ error: 'Source has no published Bright Data Collector ID' }, { status: 404 })
  }

  const collectorId = source.collector_id
  const reason = body.reason ?? 'Critical electrical fields disappeared after a website DOM/layout change.'

  const prompt = [
    'Repair this GridForge Scraper Studio collector after the storefront changed from Layout V1 to Layout V2.',
    'Preserve every existing flat output field name and emit exactly one record for every [data-product-id] card, including out-of-stock cards.',
    'Use V1 data-spec selectors when present; otherwise read each V2 .spec-row label with its .spec-value.',
    'In V2, map the inverter label Max PV Power to max_pv_w and preserve every other existing panel, inverter and battery field.',
    'Use only values present on the page. Never infer or invent an electrical value.',
    `Observed failure: ${reason}`,
  ].join(' ')

  await supabase.from('source_health_events').insert({
    source_id: source.id,
    collector_id: collectorId,
    event_type: 'HEALING_INITIATED',
    health_state: 'HEALING',
    detail: `Bright Data AI self-healing started for ${collectorId}.`,
    metadata: { reason, triggeredBy: body.triggeredBy ?? 'guardian_api' },
  })

  try {
    const response = await brightData(
      `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template`,
      {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          custom_input: [{ url: source.url }],
        }),
      },
    )
    const progress = await response.json().catch(() => ({}))

    return NextResponse.json({
      ok: true,
      sourceId: source.id,
      collectorId,
      healingInitiated: true,
      progress,
      statusUrl: `/api/guardian/heal/status?sourceId=${encodeURIComponent(source.id)}`,
      message: `Real Bright Data self-healing is running on the same collector ${collectorId}.`,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    await supabase.from('source_health_events').insert({
      source_id: source.id,
      collector_id: collectorId,
      event_type: 'HEALING_FAILED',
      health_state: 'FAILED',
      detail,
      metadata: { stage: 'refactor_template' },
    })

    return NextResponse.json({
      ok: false,
      sourceId: source.id,
      collectorId,
      error: 'self_heal_trigger_failed',
      detail,
    }, { status: 502 })
  }
}
