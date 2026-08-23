import { z } from 'zod'
import { createServerClient } from './supabase'

/**
 * Bright Data catalog pipeline — the ONLY data path used by Live Mode.
 *
 * published Scraper Studio collector
 *   -> POST /dca/trigger
 *   -> poll GET /dca/dataset until it returns an array
 *   -> flatten/normalize
 *   -> verify critical electrical fields
 *   -> persist provenance in Supabase
 *
 * There is deliberately no demo-data fallback in this module.
 */

export class LivePipelineError extends Error {
  constructor(
    message: string,
    public readonly stage: 'trigger' | 'poll' | 'download' | 'normalize' | 'validate',
    public readonly collectorId: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'LivePipelineError'
  }
}

const ComponentTypeSchema = z.enum(['solar_panel', 'inverter', 'battery'])

const RawProductSchema = z.object({
  product_id: z.string().nullable().optional(),
  product_type: ComponentTypeSchema,
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
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
  url: z.string().nullable().optional(),
}).passthrough()

type RawProduct = z.infer<typeof RawProductSchema>

export interface NormalizedComponent {
  externalProductId: string | null
  componentType: 'solar_panel' | 'inverter' | 'battery'
  manufacturer: string | null
  model: string | null
  pmaxW: number | null
  vocV: number | null
  vmpV: number | null
  iscA: number | null
  impA: number | null
  vocTempCoeffPctPerC: number | null
  efficiencyPct: number | null
  cellType: string | null
  acOutputW: number | null
  batteryVoltageV: number | null
  maxPvVoltageV: number | null
  mpptMinV: number | null
  mpptMaxV: number | null
  maxPvCurrentA: number | null
  maxPvPowerW: number | null
  nominalVoltageV: number | null
  capacityAh: number | null
  capacityKwh: number | null
  dodPct: number | null
  chemistry: string | null
  cycleLife: number | null
  priceInr: number | null
  availability: 'in_stock' | 'out_of_stock' | 'limited' | null
  originalUrl: string | null
  verificationStatus: 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED'
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number') return String(value)
  return null
}

function first(raw: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key]
  }
  return null
}

/** Accept both our production snake_case parser and the older camelCase draft. */
function canonicalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
  const input = raw.input && typeof raw.input === 'object'
    ? raw.input as Record<string, unknown>
    : null

  return {
    product_id: asString(first(raw, 'product_id', 'productId')),
    product_type: asString(first(raw, 'product_type', 'productType')),
    manufacturer: asString(first(raw, 'manufacturer', 'brand')),
    model: asString(first(raw, 'model', 'name')),
    pmax: asString(first(raw, 'pmax', 'pmaxW')),
    voc: asString(first(raw, 'voc', 'vocV')),
    vmp: asString(first(raw, 'vmp', 'vmpV')),
    isc: asString(first(raw, 'isc', 'iscA')),
    imp: asString(first(raw, 'imp', 'impA')),
    voc_temp_coeff: asString(first(raw, 'voc_temp_coeff', 'vocTempCoeff')),
    efficiency: asString(first(raw, 'efficiency', 'efficiencyPct')),
    cell_type: asString(first(raw, 'cell_type', 'cellType')),
    ac_output_w: asString(first(raw, 'ac_output_w', 'acOutputW')),
    battery_voltage_v: asString(first(raw, 'battery_voltage_v', 'batteryVoltageV')),
    max_pv_v: asString(first(raw, 'max_pv_v', 'maxPvV', 'maxPvVoltageV')),
    mppt_range: asString(first(raw, 'mppt_range', 'mpptRange')),
    max_pv_a: asString(first(raw, 'max_pv_a', 'maxPvA', 'maxPvCurrentA')),
    max_pv_w: asString(first(raw, 'max_pv_w', 'maxPvW', 'maxPvPowerW')),
    voltage_v: asString(first(raw, 'voltage_v', 'voltageV', 'nominalVoltageV')),
    capacity_ah: asString(first(raw, 'capacity_ah', 'capacityAh')),
    energy_kwh: asString(first(raw, 'energy_kwh', 'energyKwh', 'capacityKwh')),
    dod_pct: asString(first(raw, 'dod_pct', 'dodPct')),
    chemistry: asString(first(raw, 'chemistry')),
    cycle_life: asString(first(raw, 'cycle_life', 'cycleLife')),
    price: asString(first(raw, 'price', 'priceInr')),
    availability: asString(first(raw, 'availability')),
    url: asString(first(raw, 'url', 'product_url', 'originalUrl')) ?? asString(input?.url),
  }
}

/**
 * Old drafts returned { products: [...] }. Production parser collects one flat
 * row per product. Supporting both prevents a harmless output-shape change from
 * turning into a false outage.
 */
export function flattenBrightDataRows(rows: unknown[]): Record<string, unknown>[] {
  const flattened: Record<string, unknown>[] = []

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    if (Array.isArray(record.products)) {
      for (const product of record.products) {
        if (product && typeof product === 'object') {
          flattened.push(product as Record<string, unknown>)
        }
      }
    } else {
      flattened.push(record)
    }
  }

  return flattened
}

function parseNum(raw: string | null | undefined): number | null {
  if (!raw) return null
  const match = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const value = Number.parseFloat(match[0])
  return Number.isFinite(value) ? value : null
}

function parseMpptRange(raw: string | null | undefined): { min: number | null; max: number | null } {
  if (!raw) return { min: null, max: null }
  const values = [...raw.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number.parseFloat(match[0]))
  if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) {
    return { min: null, max: null }
  }
  return { min: Math.min(values[0], values[1]), max: Math.max(values[0], values[1]) }
}

function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null
  const value = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : null
}

function parseAvailability(raw: string | null | undefined): NormalizedComponent['availability'] {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower.includes('out of stock') || lower.includes('unavailable')) return 'out_of_stock'
  if (lower.includes('limited')) return 'limited'
  if (lower.includes('in stock') || lower.includes('available')) return 'in_stock'
  return null
}

const CRITICAL_PANEL_FIELDS: (keyof NormalizedComponent)[] = [
  'pmaxW', 'vocV', 'vmpV', 'iscA', 'impA', 'vocTempCoeffPctPerC',
]
const CRITICAL_INVERTER_FIELDS: (keyof NormalizedComponent)[] = [
  'acOutputW', 'batteryVoltageV', 'maxPvVoltageV', 'mpptMinV', 'mpptMaxV',
  'maxPvCurrentA', 'maxPvPowerW',
]
const CRITICAL_BATTERY_FIELDS: (keyof NormalizedComponent)[] = [
  'nominalVoltageV', 'capacityAh', 'capacityKwh', 'dodPct',
]

function computeVerificationStatus(component: NormalizedComponent): NormalizedComponent['verificationStatus'] {
  const fields = component.componentType === 'solar_panel'
    ? CRITICAL_PANEL_FIELDS
    : component.componentType === 'inverter'
      ? CRITICAL_INVERTER_FIELDS
      : CRITICAL_BATTERY_FIELDS

  const filled = fields.filter(field => component[field] !== null).length
  if (filled === fields.length) return 'VERIFIED'
  if (filled > 0) return 'PARTIAL'
  return 'UNVERIFIED'
}

export function normalizeDemoStoreProduct(raw: Record<string, unknown>): NormalizedComponent | null {
  const parsed = RawProductSchema.safeParse(canonicalizeRaw(raw))
  if (!parsed.success) return null

  const product: RawProduct = parsed.data
  const mppt = parseMpptRange(product.mppt_range)

  const component: NormalizedComponent = {
    externalProductId: product.product_id ?? null,
    componentType: product.product_type,
    manufacturer: product.manufacturer ?? null,
    model: product.model ?? null,
    pmaxW: parseNum(product.pmax),
    vocV: parseNum(product.voc),
    vmpV: parseNum(product.vmp),
    iscA: parseNum(product.isc),
    impA: parseNum(product.imp),
    vocTempCoeffPctPerC: parseNum(product.voc_temp_coeff),
    efficiencyPct: parseNum(product.efficiency),
    cellType: product.cell_type ?? null,
    acOutputW: parseNum(product.ac_output_w),
    batteryVoltageV: parseNum(product.battery_voltage_v),
    maxPvVoltageV: parseNum(product.max_pv_v),
    mpptMinV: mppt.min,
    mpptMaxV: mppt.max,
    maxPvCurrentA: parseNum(product.max_pv_a),
    maxPvPowerW: parseNum(product.max_pv_w),
    nominalVoltageV: parseNum(product.voltage_v),
    capacityAh: parseNum(product.capacity_ah),
    capacityKwh: parseNum(product.energy_kwh),
    dodPct: parseNum(product.dod_pct),
    chemistry: product.chemistry ?? null,
    cycleLife: parseNum(product.cycle_life),
    priceInr: parsePrice(product.price),
    availability: parseAvailability(product.availability),
    originalUrl: product.url ?? null,
    verificationStatus: 'UNVERIFIED',
  }

  component.verificationStatus = computeVerificationStatus(component)
  return component
}

export function computeFieldCoverage(components: NormalizedComponent[]): Record<string, number> {
  const panels = components.filter(component => component.componentType === 'solar_panel')
  const coverage = (items: NormalizedComponent[], field: keyof NormalizedComponent) =>
    items.length === 0 ? 0 : items.filter(item => item[field] !== null).length / items.length

  return {
    pmax: coverage(panels, 'pmaxW'),
    voc: coverage(panels, 'vocV'),
    vmp: coverage(panels, 'vmpV'),
    isc: coverage(panels, 'iscA'),
    imp: coverage(panels, 'impA'),
    price: coverage(components, 'priceInr'),
    availability: coverage(components, 'availability'),
  }
}

const BD_API_BASE = 'https://api.brightdata.com'
const MAX_POLL_ATTEMPTS = 60
const POLL_INTERVAL_MS = 5_000

async function bdRequest(path: string, options?: RequestInit): Promise<Response> {
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
    const body = await response.text()
    throw new Error(`Bright Data API ${response.status}: ${body}`)
  }

  return response
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface CatalogResult {
  sourceId: string
  sourceName: string
  sourceUrl: string
  collectorId: string
  brightDataRunId: string
  scrapedAt: string
  totalProducts: number
  verifiedComponents: NormalizedComponent[]
  partialComponents: NormalizedComponent[]
  unverifiedComponents: NormalizedComponent[]
  fieldCoverage: Record<string, number>
  schemaFailureRate: number
  scrapeRunId: string
}

export async function fetchCatalogFromCollector(
  collectorId: string,
  sourceId: string,
  inputUrls: string[] | null = null,
): Promise<CatalogResult> {
  const supabase = createServerClient()
  const scrapedAt = new Date().toISOString()

  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id, name, url')
    .eq('id', sourceId)
    .single()

  if (sourceError || !source) {
    throw new LivePipelineError('Configured Bright Data source is missing from Supabase', 'validate', collectorId, sourceError)
  }

  const { data: scrapeRun, error: runInsertError } = await supabase
    .from('scrape_runs')
    .insert({ source_id: sourceId, collector_id: collectorId, status: 'triggered' })
    .select()
    .single()

  if (runInsertError) console.error('[catalog] Could not persist scrape start:', runInsertError.message)
  const scrapeRunId = scrapeRun?.id ?? 'unknown'

  let brightDataRunId: string

  try {
    const urls = inputUrls?.length ? inputUrls : [source.url]
    const triggerResponse = await bdRequest(
      `/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`,
      { method: 'POST', body: JSON.stringify(urls.map(url => ({ url }))) },
    )
    const triggerData = await triggerResponse.json() as Record<string, unknown>
    brightDataRunId = asString(triggerData.collection_id) ?? asString(triggerData.snapshot_id) ?? asString(triggerData.id) ?? ''

    if (!brightDataRunId) {
      throw new LivePipelineError(`Trigger response did not contain collection_id`, 'trigger', collectorId)
    }

    if (scrapeRun?.id) {
      await supabase.from('scrape_runs').update({ bright_data_run_id: brightDataRunId, status: 'running' }).eq('id', scrapeRun.id)
    }
  } catch (error) {
    if (error instanceof LivePipelineError) throw error
    throw new LivePipelineError(`Failed to trigger collector: ${error instanceof Error ? error.message : String(error)}`, 'trigger', collectorId, error)
  }

  let rawDataset: unknown[] | null = null

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    try {
      const response = await bdRequest(`/dca/dataset?id=${encodeURIComponent(brightDataRunId)}`)
      const payload = await response.json().catch(() => null)

      if (Array.isArray(payload)) {
        rawDataset = payload
        break
      }
    } catch (error) {
      if (attempt === MAX_POLL_ATTEMPTS - 1) {
        throw new LivePipelineError(`Failed to retrieve Bright Data dataset: ${error instanceof Error ? error.message : String(error)}`, 'poll', collectorId, error)
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }

  if (!rawDataset) {
    throw new LivePipelineError('Timed out waiting for Bright Data dataset', 'poll', collectorId)
  }

  const flatRows = flattenBrightDataRows(rawDataset)
  const normalized: NormalizedComponent[] = []
  let parseFailures = 0

  for (const row of flatRows) {
    const component = normalizeDemoStoreProduct(row)
    if (component) normalized.push(component)
    else parseFailures++
  }

  const schemaFailureRate = flatRows.length > 0 ? parseFailures / flatRows.length : 1
  const fieldCoverage = computeFieldCoverage(normalized)

  if (normalized.length > 0) {
    await supabase.from('components').insert(normalized.map(component => ({
      source_id: sourceId,
      scrape_run_id: scrapeRun?.id,
      external_product_id: component.externalProductId,
      component_type: component.componentType,
      manufacturer: component.manufacturer,
      model: component.model,
      pmax_w: component.pmaxW,
      voc_v: component.vocV,
      vmp_v: component.vmpV,
      isc_a: component.iscA,
      imp_a: component.impA,
      voc_temp_coeff_pct_per_c: component.vocTempCoeffPctPerC,
      efficiency_pct: component.efficiencyPct,
      cell_type: component.cellType,
      ac_output_w: component.acOutputW,
      battery_voltage_v: component.batteryVoltageV,
      max_pv_voltage_v: component.maxPvVoltageV,
      mppt_min_v: component.mpptMinV,
      mppt_max_v: component.mpptMaxV,
      max_pv_current_a: component.maxPvCurrentA,
      max_pv_power_w: component.maxPvPowerW,
      nominal_voltage_v: component.nominalVoltageV,
      capacity_ah: component.capacityAh,
      capacity_kwh: component.capacityKwh,
      dod_pct: component.dodPct,
      chemistry: component.chemistry,
      cycle_life: component.cycleLife,
      price_inr: component.priceInr,
      availability: component.availability,
      original_url: component.originalUrl ?? source.url,
      verification_status: component.verificationStatus,
      is_active: true,
    })))
  }

  if (scrapeRun?.id) {
    await supabase.from('scrape_runs').update({
      status: 'complete',
      products_total: flatRows.length,
      products_verified: normalized.filter(component => component.verificationStatus === 'VERIFIED').length,
      field_coverage: fieldCoverage,
      schema_failure_rate: schemaFailureRate,
      completed_at: new Date().toISOString(),
    }).eq('id', scrapeRun.id)
  }

  return {
    sourceId,
    sourceName: source.name,
    sourceUrl: source.url,
    collectorId,
    brightDataRunId,
    scrapedAt,
    totalProducts: flatRows.length,
    verifiedComponents: normalized.filter(component => component.verificationStatus === 'VERIFIED'),
    partialComponents: normalized.filter(component => component.verificationStatus === 'PARTIAL'),
    unverifiedComponents: normalized.filter(component => component.verificationStatus === 'UNVERIFIED'),
    fieldCoverage,
    schemaFailureRate,
    scrapeRunId,
  }
}
