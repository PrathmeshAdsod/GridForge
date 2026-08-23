/**
 * Bright Data catalog pipeline — the ONLY path for Live Mode components.
 *
 * Flow: trigger collector → poll until ready → download dataset →
 *       normalize per-source → Zod validate → critical-field check →
 *       write to Supabase → return ComponentCatalog
 *
 * NEVER falls back to demo data on failure. Throws LivePipelineError instead.
 */

import { z } from 'zod'
import { createServerClient } from './supabase'

// ── Error type ────────────────────────────────────────────────────────────────

export class LivePipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: 'trigger' | 'poll' | 'download' | 'normalize' | 'validate',
    public readonly collectorId: string,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'LivePipelineError'
  }
}

// ── Raw Bright Data result ─────────────────────────────────────────────────────

// What Bright Data returns for a demo-store product (data-spec attributes)
const RawDemoStoreProductSchema = z.object({
  product_id: z.string().optional(),
  product_type: z.string(),               // solar_panel | inverter | battery
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  pmax: z.string().nullable().optional(),
  voc: z.string().nullable().optional(),
  vmp: z.string().nullable().optional(),
  isc: z.string().nullable().optional(),
  imp: z.string().nullable().optional(),
  voc_temp_coeff: z.string().nullable().optional(),
  efficiency: z.string().nullable().optional(),
  cell_type: z.string().nullable().optional(),
  ac_output_w: z.string().nullable().optional(),
  battery_voltage_v: z.string().nullable().optional(),
  max_pv_v: z.string().nullable().optional(),
  mppt_range: z.string().nullable().optional(),
  max_pv_a: z.string().nullable().optional(),
  max_pv_w: z.string().nullable().optional(),
  voltage_v: z.string().nullable().optional(),
  capacity_ah: z.string().nullable().optional(),
  energy_kwh: z.string().nullable().optional(),
  dod_pct: z.string().nullable().optional(),
  chemistry: z.string().nullable().optional(),
  cycle_life: z.string().nullable().optional(),
  price: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  url: z.string().optional(),
})

type RawDemoStoreProduct = z.infer<typeof RawDemoStoreProductSchema>

// ── Normalized component ───────────────────────────────────────────────────────

export interface NormalizedComponent {
  externalProductId: string | null
  componentType: 'solar_panel' | 'inverter' | 'battery'
  manufacturer: string | null
  model: string | null
  // Solar panel fields
  pmaxW: number | null
  vocV: number | null
  vmpV: number | null
  iscA: number | null
  impA: number | null
  vocTempCoeffPctPerC: number | null
  efficiencyPct: number | null
  cellType: string | null
  // Inverter fields
  acOutputW: number | null
  batteryVoltageV: number | null
  maxPvVoltageV: number | null
  mpptMinV: number | null
  mpptMaxV: number | null
  maxPvCurrentA: number | null
  maxPvPowerW: number | null
  // Battery fields
  nominalVoltageV: number | null
  capacityAh: number | null
  capacityKwh: number | null
  dodPct: number | null
  chemistry: string | null
  cycleLife: number | null
  // Common
  priceInr: number | null
  availability: 'in_stock' | 'out_of_stock' | 'limited' | null
  originalUrl: string | null
  verificationStatus: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED'
}

// ── Number parser ──────────────────────────────────────────────────────────────

function parseNum(raw: string | null | undefined): number | null {
  if (!raw) return null
  // Extract first number from string like "49.8 V", "440 W", "11,500"
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = parseFloat(match[0])
  return isNaN(n) ? null : n
}

function parseMpptRange(raw: string | null | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null }
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)/)
  if (!match) return { min: null, max: null }
  return { min: parseFloat(match[1]), max: parseFloat(match[2]) }
}

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[₹,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseAvailability(raw: string | null | undefined): NormalizedComponent['availability'] {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes('out') || lower.includes('unavailable')) return 'out_of_stock'
  if (lower.includes('limited')) return 'limited'
  if (lower.includes('in') || lower.includes('available')) return 'in_stock'
  return null
}

// ── Critical field checkers ────────────────────────────────────────────────────

const CRITICAL_PANEL_FIELDS: (keyof NormalizedComponent)[] = ['pmaxW', 'vocV', 'vmpV', 'iscA', 'impA']
const CRITICAL_INVERTER_FIELDS: (keyof NormalizedComponent)[] = ['acOutputW', 'batteryVoltageV', 'maxPvVoltageV', 'mpptMinV', 'mpptMaxV']
const CRITICAL_BATTERY_FIELDS: (keyof NormalizedComponent)[] = ['nominalVoltageV', 'capacityAh', 'capacityKwh']

function computeVerificationStatus(c: NormalizedComponent): 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' {
  const criticalFields =
    c.componentType === 'solar_panel' ? CRITICAL_PANEL_FIELDS :
    c.componentType === 'inverter' ? CRITICAL_INVERTER_FIELDS :
    CRITICAL_BATTERY_FIELDS

  const filled = criticalFields.filter(f => c[f] !== null).length
  const total = criticalFields.length

  if (filled === total) return 'VERIFIED'
  if (filled > 0) return 'PARTIAL'
  return 'UNVERIFIED'
}

// ── Normalizer: demo store format ──────────────────────────────────────────────

export function normalizeDemoStoreProduct(raw: Record<string, unknown>): NormalizedComponent | null {
  const parsed = RawDemoStoreProductSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn('[normalizer] Demo store product failed schema parse:', parsed.error.message)
    return null
  }

  const p = parsed.data
  const type = p.product_type as 'solar_panel' | 'inverter' | 'battery'
  if (!['solar_panel', 'inverter', 'battery'].includes(type)) return null

  const mpptRange = parseMpptRange(p.mppt_range)

  const c: NormalizedComponent = {
    externalProductId: p.product_id ?? null,
    componentType: type,
    manufacturer: p.manufacturer ?? null,
    model: p.model ?? null,
    pmaxW: parseNum(p.pmax),
    vocV: parseNum(p.voc),
    vmpV: parseNum(p.vmp),
    iscA: parseNum(p.isc),
    impA: parseNum(p.imp),
    vocTempCoeffPctPerC: parseNum(p.voc_temp_coeff),
    efficiencyPct: parseNum(p.efficiency),
    cellType: p.cell_type ?? null,
    acOutputW: parseNum(p.ac_output_w),
    batteryVoltageV: parseNum(p.battery_voltage_v),
    maxPvVoltageV: parseNum(p.max_pv_v),
    mpptMinV: mpptRange.min,
    mpptMaxV: mpptRange.max,
    maxPvCurrentA: parseNum(p.max_pv_a),
    maxPvPowerW: parseNum(p.max_pv_w),
    nominalVoltageV: parseNum(p.voltage_v),
    capacityAh: parseNum(p.capacity_ah),
    capacityKwh: parseNum(p.energy_kwh),
    dodPct: parseNum(p.dod_pct),
    chemistry: p.chemistry ?? null,
    cycleLife: parseNum(p.cycle_life),
    priceInr: parsePrice(p.price),
    availability: parseAvailability(p.availability),
    originalUrl: p.url ?? null,
    verificationStatus: 'UNVERIFIED',
  }

  c.verificationStatus = computeVerificationStatus(c)
  return c
}

// ── Field coverage metrics ─────────────────────────────────────────────────────

export function computeFieldCoverage(components: NormalizedComponent[]): Record<string, number> {
  const panels = components.filter(c => c.componentType === 'solar_panel')
  const inverters = components.filter(c => c.componentType === 'inverter')
  const batteries = components.filter(c => c.componentType === 'battery')

  const coverage = (comps: NormalizedComponent[], field: keyof NormalizedComponent) =>
    comps.length === 0 ? 1 : comps.filter(c => c[field] !== null).length / comps.length

  return {
    pmax: coverage(panels, 'pmaxW'),
    voc: coverage(panels, 'vocV'),
    vmp: coverage(panels, 'vmpV'),
    isc: coverage(panels, 'iscA'),
    price: coverage(components, 'priceInr'),
    availability: coverage(components, 'availability'),
  }
}

// ── Bright Data API ────────────────────────────────────────────────────────────

const BD_API_BASE = 'https://api.brightdata.com'
const MAX_POLL_ATTEMPTS = 30  // 30 × 10s = 5 min max
const POLL_INTERVAL_MS = 10_000

async function bdRequest(path: string, options?: RequestInit) {
  const token = process.env.BRIGHT_DATA_API_TOKEN
  if (!token) throw new Error('Missing BRIGHT_DATA_API_TOKEN')

  const resp = await fetch(`${BD_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Bright Data API ${resp.status}: ${body}`)
  }

  return resp
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Main catalog fetch function ────────────────────────────────────────────────

export interface CatalogResult {
  collectorId: string
  brightDataRunId: string
  scrapedAt: string
  totalProducts: number
  verifiedComponents: NormalizedComponent[]
  partialComponents: NormalizedComponent[]
  unverifiedComponents: NormalizedComponent[]
  fieldCoverage: Record<string, number>
  schemaFailureRate: number
  scrapeRunId: string  // Supabase UUID of the scrape_run record
}

export async function fetchCatalogFromCollector(
  collectorId: string,
  sourceId: string,
  inputUrls: string[] | null = null,
): Promise<CatalogResult> {
  const supabase = createServerClient()
  const scrapedAt = new Date().toISOString()

  // ── Record scrape run start ─────────────────────────────────────────────────
  const { data: scrapeRun, error: runInsertError } = await supabase
    .from('scrape_runs')
    .insert({
      source_id: sourceId,
      collector_id: collectorId,
      status: 'triggered',
    })
    .select()
    .single()

  if (runInsertError || !scrapeRun) {
    console.error('[catalog] Failed to insert scrape_run:', runInsertError)
    // Continue even if Supabase is down — don't block the pipeline
  }

  const scrapeRunId = scrapeRun?.id ?? 'unknown'

  // ── Step 1: Trigger collector ───────────────────────────────────────────────
  let brightDataRunId: string

  try {
    const triggerBody = inputUrls
      ? JSON.stringify(inputUrls.map(url => ({ url })))
      : '[]'  // Let collector use its built-in URL list

    const triggerResp = await bdRequest(
      `/dca/trigger?collector=${collectorId}&queue_next=1`,
      { method: 'POST', body: triggerBody }
    )

    const triggerData = await triggerResp.json()
    brightDataRunId = triggerData.collection_id ?? triggerData.snapshot_id ?? triggerData.id

    if (!brightDataRunId) {
      throw new LivePipelineError(
        `Trigger response missing collection_id: ${JSON.stringify(triggerData)}`,
        'trigger',
        collectorId
      )
    }

    // Update scrape run with BD run ID
    if (scrapeRun?.id) {
      await supabase.from('scrape_runs').update({
        bright_data_run_id: brightDataRunId,
        status: 'running',
      }).eq('id', scrapeRun.id)
    }

  } catch (err) {
    if (err instanceof LivePipelineError) throw err
    throw new LivePipelineError(
      `Failed to trigger collector: ${err instanceof Error ? err.message : String(err)}`,
      'trigger',
      collectorId,
      err
    )
  }

  // ── Step 2: Poll for completion ─────────────────────────────────────────────
  let attempt = 0
  while (attempt < MAX_POLL_ATTEMPTS) {
    await sleep(POLL_INTERVAL_MS)
    attempt++

    try {
      const statusResp = await bdRequest(`/dca/dataset?id=${brightDataRunId}&status=1`)
      const statusData = await statusResp.json()

      const isReady = statusData.status === 'ready' || statusData.rows > 0 || statusData.ready === true

      if (isReady) break

      if (statusData.status === 'failed' || statusData.status === 'error') {
        throw new LivePipelineError(
          `Bright Data collection failed: ${statusData.error ?? statusData.status}`,
          'poll',
          collectorId
        )
      }

    } catch (err) {
      if (err instanceof LivePipelineError) throw err
      // Transient error during poll — continue
      console.warn(`[catalog] Poll attempt ${attempt} failed:`, err instanceof Error ? err.message : String(err))
    }
  }

  if (attempt >= MAX_POLL_ATTEMPTS) {
    throw new LivePipelineError(
      `Timed out waiting for Bright Data collection after ${MAX_POLL_ATTEMPTS} attempts`,
      'poll',
      collectorId
    )
  }

  // ── Step 3: Download dataset ────────────────────────────────────────────────
  let rawProducts: Record<string, unknown>[]

  try {
    const dataResp = await bdRequest(`/dca/dataset?id=${brightDataRunId}`)
    rawProducts = await dataResp.json()

    if (!Array.isArray(rawProducts)) {
      throw new LivePipelineError(
        `Unexpected dataset format: expected array, got ${typeof rawProducts}`,
        'download',
        collectorId
      )
    }

  } catch (err) {
    if (err instanceof LivePipelineError) throw err
    throw new LivePipelineError(
      `Failed to download dataset: ${err instanceof Error ? err.message : String(err)}`,
      'download',
      collectorId
    )
  }

  // ── Step 4: Normalize ───────────────────────────────────────────────────────
  const normalized: NormalizedComponent[] = []
  let parseFailures = 0

  for (const raw of rawProducts) {
    const component = normalizeDemoStoreProduct(raw)
    if (component) {
      normalized.push(component)
    } else {
      parseFailures++
    }
  }

  const schemaFailureRate = rawProducts.length > 0
    ? parseFailures / rawProducts.length
    : 0

  const fieldCoverage = computeFieldCoverage(normalized)

  // ── Step 5: Persist components to Supabase ──────────────────────────────────
  if (normalized.length > 0) {
    const rows = normalized.map(c => ({
      source_id: sourceId,
      scrape_run_id: scrapeRun?.id,
      external_product_id: c.externalProductId,
      component_type: c.componentType,
      manufacturer: c.manufacturer,
      model: c.model,
      pmax_w: c.pmaxW,
      voc_v: c.vocV,
      vmp_v: c.vmpV,
      isc_a: c.iscA,
      imp_a: c.impA,
      voc_temp_coeff_pct_per_c: c.vocTempCoeffPctPerC,
      efficiency_pct: c.efficiencyPct,
      cell_type: c.cellType,
      ac_output_w: c.acOutputW,
      battery_voltage_v: c.batteryVoltageV,
      max_pv_voltage_v: c.maxPvVoltageV,
      mppt_min_v: c.mpptMinV,
      mppt_max_v: c.mpptMaxV,
      max_pv_current_a: c.maxPvCurrentA,
      max_pv_power_w: c.maxPvPowerW,
      nominal_voltage_v: c.nominalVoltageV,
      capacity_ah: c.capacityAh,
      capacity_kwh: c.capacityKwh,
      dod_pct: c.dodPct,
      chemistry: c.chemistry,
      cycle_life: c.cycleLife,
      price_inr: c.priceInr,
      availability: c.availability,
      original_url: c.originalUrl,
      verification_status: c.verificationStatus,
      is_active: true,
    }))

    await supabase.from('components').insert(rows)
  }

  // ── Step 6: Update scrape run record ────────────────────────────────────────
  if (scrapeRun?.id) {
    await supabase.from('scrape_runs').update({
      status: 'complete',
      products_total: rawProducts.length,
      products_verified: normalized.filter(c => c.verificationStatus === 'VERIFIED').length,
      field_coverage: fieldCoverage,
      schema_failure_rate: schemaFailureRate,
      completed_at: new Date().toISOString(),
    }).eq('id', scrapeRun.id)
  }

  return {
    collectorId,
    brightDataRunId,
    scrapedAt,
    totalProducts: rawProducts.length,
    verifiedComponents: normalized.filter(c => c.verificationStatus === 'VERIFIED'),
    partialComponents: normalized.filter(c => c.verificationStatus === 'PARTIAL'),
    unverifiedComponents: normalized.filter(c => c.verificationStatus === 'UNVERIFIED'),
    fieldCoverage,
    schemaFailureRate,
    scrapeRunId,
  }
}
