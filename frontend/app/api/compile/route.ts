/**
 * POST /api/compile
 *
 * Demo Mode is deterministic fixture data and is always labelled demo.
 * Live Mode is strictly:
 * Bright Data Scraper Studio -> normalize -> deterministic compiler -> topology.
 * Any live failure is surfaced honestly; fixtures are never used as a fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { explainTopology } from '@/lib/gemini'
import type { StructuredRequirement } from '@/lib/gemini'
import { fetchCatalogFromCollector, LivePipelineError } from '@/lib/catalog'
import { compileLiveTopology, LiveRequirementError } from '@/lib/live-compiler'
import { createServerClient } from '@/lib/supabase'
import { DEMO_TOPOLOGY, DEMO_METRICS, DEMO_COMPILATION_STATS } from '@/lib/demo-data'

interface SourceConfig {
  collectorId: string
  name: string
  url: string
  sourceType: 'demo_store' | 'real_source'
}

async function ensureSource(
  supabase: ReturnType<typeof createServerClient>,
  config: SourceConfig,
): Promise<{ id: string; name: string; url: string }> {
  let query = supabase
    .from('sources')
    .select('id, name, url, collector_id, source_type')

  query = config.sourceType === 'demo_store'
    ? query.eq('source_type', 'demo_store')
    : query.eq('name', config.name)

  const { data: rows, error: readError } = await query.limit(1)
  if (readError) throw new Error(`Could not read source configuration: ${readError.message}`)

  const existing = rows?.[0]
  if (existing) {
    const { data, error } = await supabase
      .from('sources')
      .update({
        name: config.name,
        url: config.url,
        collector_id: config.collectorId,
        source_type: config.sourceType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('id, name, url')
      .single()

    if (error || !data) throw new Error(`Could not update source configuration: ${error?.message ?? 'unknown error'}`)
    return data
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({
      name: config.name,
      url: config.url,
      collector_id: config.collectorId,
      source_type: config.sourceType,
    })
    .select('id, name, url')
    .single()

  if (error || !data) throw new Error(`Could not create source configuration: ${error?.message ?? 'unknown error'}`)
  return data
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    mode: 'demo' | 'live'
    requirement: StructuredRequirement
    nl?: string
    userId?: string
  }

  const { mode, requirement, nl, userId } = body

  if (!mode || !['demo', 'live'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode — must be demo or live' }, { status: 400 })
  }

  if (!requirement) {
    return NextResponse.json({ error: 'Missing structured requirement' }, { status: 400 })
  }

  if (mode === 'demo') {
    const explanation = await explainTopology(
      JSON.stringify(DEMO_TOPOLOGY),
      nl ?? requirement.rawNl,
    ).catch(() => ({ explanation: 'Demo system compiled from validated fixtures.', generatedBy: 'template' as const }))

    return NextResponse.json({
      ok: true,
      dataSource: 'demo' as const,
      topology: DEMO_TOPOLOGY,
      metrics: DEMO_METRICS,
      stats: DEMO_COMPILATION_STATS,
      explanation: explanation.explanation,
      explanationBy: explanation.generatedBy,
      collectorIds: [],
      scrapeRunIds: [],
      compilationRunId: null,
      assumptions: ['Demo Mode uses explicitly labelled, deterministic fixture data.'],
    })
  }

  const configs: SourceConfig[] = []
  const demoStoreCollectorId = process.env.BRIGHT_DATA_DEMO_STORE_COLLECTOR_ID
  const loomSolarCollectorId = process.env.BRIGHT_DATA_LOOM_SOLAR_COLLECTOR_ID

  if (demoStoreCollectorId) {
    configs.push({
      collectorId: demoStoreCollectorId,
      name: 'GridForge Demo Store',
      url: process.env.DEMO_STORE_URL ?? 'https://gridforge-demo-store.vercel.app',
      sourceType: 'demo_store',
    })
  }

  if (loomSolarCollectorId) {
    configs.push({
      collectorId: loomSolarCollectorId,
      name: 'Loom Solar',
      url: 'https://www.loomsolar.com/collections/solar-panels',
      sourceType: 'real_source',
    })
  }

  if (configs.length === 0) {
    return NextResponse.json({
      ok: false,
      error: 'live_pipeline_not_configured',
      detail: 'No published Bright Data Collector ID is configured for Live Mode.',
      dataSource: 'live',
      fallbackUsed: false,
    }, { status: 503 })
  }

  const supabase = createServerClient()

  const { data: compilationRun, error: runError } = await supabase
    .from('compilation_runs')
    .insert({
      user_id: userId ?? null,
      requirement_nl: nl ?? requirement.rawNl,
      requirement_structured: requirement as unknown as import('@/lib/database.types').Json,
      data_source: 'live',
      status: 'running',
      collector_ids: configs.map(config => config.collectorId),
    })
    .select()
    .single()

  if (runError) console.error('[api/compile] Could not persist compilation start:', runError.message)
  const compilationRunId = compilationRun?.id ?? null

  try {
    const configuredSources = await Promise.all(
      configs.map(async config => ({
        config,
        source: await ensureSource(supabase, config),
      })),
    )

    const catalogs = await Promise.all(
      configuredSources.map(({ config, source }) =>
        fetchCatalogFromCollector(config.collectorId, source.id, [source.url]),
      ),
    )

    const panelCount = catalogs.flatMap(catalog => catalog.verifiedComponents)
      .filter(component => component.componentType === 'solar_panel' && component.availability === 'in_stock').length
    const inverterCount = catalogs.flatMap(catalog => catalog.verifiedComponents)
      .filter(component => component.componentType === 'inverter' && component.availability === 'in_stock').length
    const batteryCount = catalogs.flatMap(catalog => catalog.verifiedComponents)
      .filter(component => component.componentType === 'battery' && component.availability === 'in_stock').length

    if (panelCount === 0 || inverterCount === 0 || batteryCount === 0) {
      const detail = `Live data has ${panelCount} verified in-stock panels, ${inverterCount} inverters, and ${batteryCount} batteries; at least one of each is required.`

      if (compilationRunId) {
        await supabase.from('compilation_runs').update({
          status: 'no_solution',
          error_detail: detail,
          scrape_run_ids: catalogs.map(catalog => catalog.scrapeRunId).filter(id => id !== 'unknown'),
          completed_at: new Date().toISOString(),
        }).eq('id', compilationRunId)
      }

      return NextResponse.json({
        ok: false,
        dataSource: 'live' as const,
        error: 'insufficient_verified_components',
        detail,
        collectorIds: catalogs.map(catalog => catalog.collectorId),
        scrapeRunIds: catalogs.map(catalog => catalog.scrapeRunId),
        fieldCoverage: catalogs.map(catalog => ({
          collectorId: catalog.collectorId,
          source: catalog.sourceName,
          coverage: catalog.fieldCoverage,
        })),
        fallbackUsed: false,
      }, { status: 422 })
    }

    const compiled = compileLiveTopology(catalogs, requirement)

    if (!compiled.topology) {
      const detail = 'Live components were scraped successfully, but no configuration passed every electrical, energy, storage, and budget constraint.'
      if (compilationRunId) {
        await supabase.from('compilation_runs').update({
          status: 'no_solution',
          error_detail: detail,
          candidates_evaluated: compiled.stats.totalCandidates,
          candidates_rejected: compiled.stats.totalCandidates,
          candidates_validated: 0,
          scrape_run_ids: catalogs.map(catalog => catalog.scrapeRunId).filter(id => id !== 'unknown'),
          completed_at: new Date().toISOString(),
        }).eq('id', compilationRunId)
      }

      return NextResponse.json({
        ok: false,
        dataSource: 'live' as const,
        error: 'no_valid_topology',
        detail,
        stats: compiled.stats,
        assumptions: compiled.assumptions,
        rejectionExamples: compiled.rejectedCandidates.slice(0, 10),
        collectorIds: catalogs.map(catalog => catalog.collectorId),
        scrapeRunIds: catalogs.map(catalog => catalog.scrapeRunId),
        fallbackUsed: false,
      }, { status: 422 })
    }

    const explanation = await explainTopology(
      JSON.stringify(compiled.topology),
      nl ?? requirement.rawNl,
    ).catch(() => ({ explanation: 'System compiled from live Bright Data records and deterministic constraints.', generatedBy: 'template' as const }))

    if (compilationRunId) {
      await supabase.from('compilation_runs').update({
        status: 'complete',
        topology_result: compiled.topology as unknown as import('@/lib/database.types').Json,
        metrics: compiled.topology.metrics as unknown as import('@/lib/database.types').Json,
        candidates_evaluated: compiled.stats.totalCandidates,
        candidates_rejected: compiled.stats.totalCandidates - compiled.stats.fullyValidated,
        candidates_validated: compiled.stats.fullyValidated,
        scrape_run_ids: catalogs.map(catalog => catalog.scrapeRunId).filter(id => id !== 'unknown'),
        completed_at: new Date().toISOString(),
      }).eq('id', compilationRunId)
    }

    return NextResponse.json({
      ok: true,
      dataSource: 'live' as const,
      topology: compiled.topology,
      metrics: compiled.topology.metrics,
      stats: compiled.stats,
      assumptions: compiled.assumptions,
      explanation: explanation.explanation,
      explanationBy: explanation.generatedBy,
      collectorIds: catalogs.map(catalog => catalog.collectorId),
      scrapeRunIds: catalogs.map(catalog => catalog.scrapeRunId),
      sources: catalogs.map(catalog => ({
        name: catalog.sourceName,
        url: catalog.sourceUrl,
        collectorId: catalog.collectorId,
        runId: catalog.brightDataRunId,
        scrapedAt: catalog.scrapedAt,
        totalProducts: catalog.totalProducts,
        fieldCoverage: catalog.fieldCoverage,
      })),
      compilationRunId,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    const isPipelineError = error instanceof LivePipelineError
    const isRequirementError = error instanceof LiveRequirementError

    console.error('[api/compile] Live pipeline error:', error)

    if (compilationRunId) {
      await supabase.from('compilation_runs').update({
        status: 'failed',
        error_detail: detail,
        completed_at: new Date().toISOString(),
      }).eq('id', compilationRunId)
    }

    return NextResponse.json({
      ok: false,
      dataSource: 'live' as const,
      error: isRequirementError ? 'incomplete_requirement' : 'live_pipeline_failed',
      stage: isPipelineError ? error.stage : isRequirementError ? 'requirement' : 'unknown',
      collectorId: isPipelineError ? error.collectorId : null,
      detail,
      fallbackUsed: false,
    }, { status: isRequirementError ? 422 : 503 })
  }
}
