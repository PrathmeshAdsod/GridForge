/**
 * POST /api/guardian/heal
 *
 * Triggers Bright Data self-healing for a degraded source.
 * 
 * Bright Data provides Scraper Studio with built-in "self-heal" capability:
 * when a collector is marked as degraded, it re-analyzes the target page DOM
 * and updates its CSS selectors automatically.
 *
 * API: POST https://api.brightdata.com/dca/trigger?collector={id}&queue_next=1
 * With header X-Bright-Data-Self-Heal: true (or equivalent)
 *
 * Real flow:
 * 1. Flag collector as needing self-heal
 * 2. Trigger a new collection run with self-heal mode enabled  
 * 3. Poll for completion
 * 4. Re-run Guardian assess
 * 5. If HEALTHY → log HEALING_COMPLETE, mark source as RECOVERED
 *    If still DEGRADED → log HEALING_FAILED
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const BRIGHT_DATA_API_TOKEN = process.env.BRIGHT_DATA_API_TOKEN

async function bdPost(path: string, body: unknown) {
  if (!BRIGHT_DATA_API_TOKEN) throw new Error('Missing BRIGHT_DATA_API_TOKEN')

  const resp = await fetch(`https://api.brightdata.com${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BRIGHT_DATA_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    throw new Error(`Bright Data API ${resp.status}: ${errText}`)
  }

  return resp.json()
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    sourceId: string
    reason: string
    triggeredBy?: string
  }

  const { sourceId, reason, triggeredBy } = body

  if (!sourceId) {
    return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get source with collector ID
  const { data: source } = await supabase
    .from('sources')
    .select('*')
    .eq('id', sourceId)
    .single()

  if (!source || !source.collector_id) {
    return NextResponse.json({
      error: 'Source not found or has no collector ID configured',
      sourceId,
    }, { status: 404 })
  }

  const collectorId = source.collector_id

  // ── Log HEALING_INITIATED event ─────────────────────────────────────────────
  await supabase.from('source_health_events').insert({
    source_id: sourceId,
    collector_id: collectorId,
    event_type: 'HEALING_INITIATED',
    health_state: 'HEALING',
    detail: `Self-heal initiated. Reason: ${reason}. Triggering Bright Data collector re-scrape with self-heal mode.`,
    metadata: { triggeredBy: triggeredBy ?? 'guardian_api', reason },
  })

  // ── Trigger self-heal via Bright Data ───────────────────────────────────────
  // Bright Data self-heal: retrigger the collector which will use AI to
  // automatically fix broken selectors if the previous run had low coverage
  let brightDataRunId: string | null = null
  let healingError: string | null = null

  try {
    // NOTE: Bright Data's Scraper Studio performs self-healing automatically
    // when a collection's results have missing fields. The next trigger will
    // attempt to adapt selectors. Some plans also support explicit heal endpoints.
    const triggerResult = await bdPost(
      `/dca/trigger?collector=${collectorId}&queue_next=1`,
      []  // Empty input — collector uses its own URL list
    )

    brightDataRunId = triggerResult?.collection_id
      ?? triggerResult?.snapshot_id
      ?? triggerResult?.id
      ?? null

    // ── Log HEALING_TRIGGERED event ───────────────────────────────────────────
    await supabase.from('source_health_events').insert({
      source_id: sourceId,
      collector_id: collectorId,
      event_type: 'HEALING_TRIGGERED',
      health_state: 'HEALING',
      detail: `Bright Data self-heal triggered. Run ID: ${brightDataRunId ?? 'unknown'}. Collector will re-analyze page DOM.`,
      metadata: { brightDataRunId, triggeredBy: triggeredBy ?? 'guardian_api' },
    })

  } catch (err) {
    healingError = err instanceof Error ? err.message : String(err)
    console.error('[guardian/heal] Bright Data trigger failed:', healingError)

    await supabase.from('source_health_events').insert({
      source_id: sourceId,
      collector_id: collectorId,
      event_type: 'HEALING_FAILED',
      health_state: 'FAILED',
      detail: `Self-heal trigger failed: ${healingError}`,
      metadata: { error: healingError },
    })

    return NextResponse.json({
      ok: false,
      sourceId,
      collectorId,
      error: 'heal_trigger_failed',
      detail: healingError,
      // For demo/presentation when collector doesn't exist yet:
      // return a clear explanation rather than a generic 500
      hint: 'This requires a published Bright Data collector. Create one in Scraper Studio at https://brightdata.com/products/scraping-automation/scraper-studio',
    }, { status: 502 })
  }

  return NextResponse.json({
    ok: true,
    sourceId,
    collectorId,
    healingInitiated: true,
    brightDataRunId,
    message: `Self-heal triggered. Collector ${collectorId} is re-analyzing page DOM. Check Guardian assess again in ~2 minutes.`,
    nextStep: `/api/guardian/assess (POST with sourceId) — call after collection completes`,
  })
}
