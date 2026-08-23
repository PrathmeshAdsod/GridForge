import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

const DEGRADATION_FIELD_COVERAGE_THRESHOLD = 0.60
const SCHEMA_FAILURE_RATE_THRESHOLD = 0.30
const RECOVERY_FIELD_COVERAGE_THRESHOLD = 0.90
const RECOVERY_SCHEMA_FAILURE_THRESHOLD = 0.10
const CRITICAL_FIELDS = ['pmax', 'voc', 'vmp', 'isc'] as const

function averageCriticalCoverage(coverage: Record<string, number>): number {
  return CRITICAL_FIELDS.reduce((sum, field) => sum + Number(coverage[field] ?? 0), 0) / CRITICAL_FIELDS.length
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    sourceId: string
    scrapeRunId?: string
    triggeredBy?: string
  }

  if (!body.sourceId) return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })

  const supabase = createServerClient()
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('*')
    .eq('id', body.sourceId)
    .single()

  if (sourceError || !source) return NextResponse.json({ error: 'Source not found' }, { status: 404 })

  let latestRun: any = null
  if (body.scrapeRunId) {
    const { data } = await supabase
      .from('scrape_runs')
      .select('*')
      .eq('source_id', body.sourceId)
      .eq('id', body.scrapeRunId)
      .maybeSingle()
    latestRun = data
  } else {
    const { data } = await supabase
      .from('scrape_runs')
      .select('*')
      .eq('source_id', body.sourceId)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    latestRun = data
  }

  if (!latestRun) return NextResponse.json({ error: 'No scrape runs found for source' }, { status: 404 })

  const [{ data: previousRows }, { data: latestHealthRows }] = await Promise.all([
    supabase
      .from('scrape_runs')
      .select('*')
      .eq('source_id', body.sourceId)
      .eq('status', 'complete')
      .neq('id', latestRun.id)
      .lt('started_at', latestRun.started_at)
      .order('started_at', { ascending: false })
      .limit(1),
    supabase
      .from('source_health_events')
      .select('*')
      .eq('source_id', body.sourceId)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const previousRun = previousRows?.[0] ?? null
  const previousHealthEvent = latestHealthRows?.[0] ?? null
  const currentCoverage = (latestRun.field_coverage ?? {}) as Record<string, number>
  const previousCoverage = (previousRun?.field_coverage ?? {}) as Record<string, number>
  const avgCoverage = averageCriticalCoverage(currentCoverage)
  const previousAvgCoverage = previousRun ? averageCriticalCoverage(previousCoverage) : null
  const schemaFailureRate = Number(latestRun.schema_failure_rate ?? 0)

  let availabilityChanges: Array<{
    productId: string
    componentType: string | null
    from: string | null
    to: string | null
  }> = []

  if (previousRun) {
    const [{ data: currentComponents }, { data: previousComponents }] = await Promise.all([
      supabase
        .from('components')
        .select('external_product_id, component_type, availability')
        .eq('scrape_run_id', latestRun.id),
      supabase
        .from('components')
        .select('external_product_id, component_type, availability')
        .eq('scrape_run_id', previousRun.id),
    ])

    const previousById = new Map(
      (previousComponents ?? [])
        .filter(component => component.external_product_id)
        .map(component => [component.external_product_id!, component]),
    )

    availabilityChanges = (currentComponents ?? [])
      .filter(component => component.external_product_id && previousById.has(component.external_product_id))
      .map(component => {
        const previous = previousById.get(component.external_product_id!)!
        return {
          productId: component.external_product_id!,
          componentType: component.component_type ?? null,
          from: previous.availability ?? null,
          to: component.availability ?? null,
        }
      })
      .filter(change => change.from !== change.to)
  }

  const stockouts = availabilityChanges.filter(change =>
    change.from === 'in_stock' && change.to === 'out_of_stock',
  )

  const schemaDegraded =
    avgCoverage < DEGRADATION_FIELD_COVERAGE_THRESHOLD ||
    schemaFailureRate > SCHEMA_FAILURE_RATE_THRESHOLD

  const awaitingHealVerification = Boolean(
    previousHealthEvent &&
    (
      previousHealthEvent.health_state === 'VERIFYING' ||
      previousHealthEvent.event_type === 'HEALING_COMPLETE'
    )
  )

  let healthState: 'HEALTHY' | 'DEGRADED' | 'RECOVERED' | 'REAL_WORLD_CHANGE'
  let eventType: string
  let detail: string

  if (latestRun.status === 'failed') {
    healthState = 'DEGRADED'
    eventType = awaitingHealVerification ? 'VERIFICATION_FAILED' : 'SCRAPE_FAILED'
    detail = `Collection failed: ${latestRun.error_detail ?? 'unknown Bright Data error'}`
  } else if (schemaDegraded) {
    healthState = 'DEGRADED'
    eventType = awaitingHealVerification ? 'VERIFICATION_FAILED' : 'DEGRADATION_DETECTED'
    detail = awaitingHealVerification
      ? `Post-heal verification failed. Critical electrical-field coverage is ${(avgCoverage * 100).toFixed(0)}% and schema failure rate is ${(schemaFailureRate * 100).toFixed(0)}%; the source remains degraded.`
      : `Critical electrical-field coverage is ${(avgCoverage * 100).toFixed(0)}% and schema failure rate is ${(schemaFailureRate * 100).toFixed(0)}%. This is source/DOM drift, not a market event.`
  } else if (awaitingHealVerification) {
    const recoveryStrongEnough =
      avgCoverage >= RECOVERY_FIELD_COVERAGE_THRESHOLD &&
      schemaFailureRate <= RECOVERY_SCHEMA_FAILURE_THRESHOLD

    if (recoveryStrongEnough) {
      healthState = 'RECOVERED'
      eventType = 'VERIFICATION_PASSED'
      detail = `Post-healing scrape on the same collector restored critical coverage to ${(avgCoverage * 100).toFixed(0)}% with ${(schemaFailureRate * 100).toFixed(0)}% schema failures. Recovery is verified from returned data.`
    } else {
      healthState = 'DEGRADED'
      eventType = 'VERIFICATION_FAILED'
      detail = `Bright Data repair completed, but recovery evidence is insufficient: ${(avgCoverage * 100).toFixed(0)}% critical coverage. GridForge requires at least ${(RECOVERY_FIELD_COVERAGE_THRESHOLD * 100).toFixed(0)}% before claiming RECOVERED.`
    }
  } else if (
    previousRun &&
    previousAvgCoverage !== null &&
    Math.abs(avgCoverage - previousAvgCoverage) < 0.10 &&
    availabilityChanges.length > 0
  ) {
    healthState = 'REAL_WORLD_CHANGE'
    eventType = 'REAL_SUPPLY_CHANGE_DETECTED'
    detail = `Scraper schema remains healthy, but ${availabilityChanges.length} product availability value(s) changed${stockouts.length ? `, including ${stockouts.length} stockout(s)` : ''}. GridForge treats this as a real supply event and recompiles instead of healing the scraper.`
  } else {
    healthState = 'HEALTHY'
    eventType = 'SCRAPE_COMPLETE'
    detail = `Collection healthy: ${latestRun.products_verified ?? 0}/${latestRun.products_total ?? 0} products fully verified; critical coverage ${(avgCoverage * 100).toFixed(0)}%.`
  }

  const { data: healthEvent, error: eventError } = await supabase
    .from('source_health_events')
    .insert({
      source_id: body.sourceId,
      collector_id: source.collector_id ?? 'unknown',
      event_type: eventType,
      health_state: healthState,
      detail,
      metadata: {
        avgCriticalCoverage: avgCoverage,
        previousAvgCriticalCoverage: previousAvgCoverage,
        schemaFailureRate,
        availabilityChanges,
        stockouts,
        fieldCoverage: currentCoverage,
        previousScrapeRunId: previousRun?.id ?? null,
        triggeredBy: body.triggeredBy ?? 'guardian_api',
      },
      scrape_run_id: latestRun.id,
    })
    .select()
    .single()

  if (eventError) {
    return NextResponse.json({
      error: `Assessment succeeded but event persistence failed: ${eventError.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    sourceId: body.sourceId,
    collectorId: source.collector_id,
    scrapeRunId: latestRun.id,
    healthState,
    eventType,
    detail,
    availabilityChanges,
    stockouts,
    metrics: {
      avgCriticalCoverage: avgCoverage,
      previousAvgCriticalCoverage: previousAvgCoverage,
      schemaFailureRate,
      productsTotal: latestRun.products_total ?? 0,
      productsVerified: latestRun.products_verified ?? 0,
      fieldCoverage: currentCoverage,
    },
    shouldSelfHeal: healthState === 'DEGRADED',
    shouldRecompile: healthState === 'REAL_WORLD_CHANGE',
    healthEventId: healthEvent?.id ?? null,
  })
}
