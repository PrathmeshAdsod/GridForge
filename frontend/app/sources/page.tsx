"use client";

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

interface SourcePayload {
  id: string
  name: string
  url: string
  collector_id: string | null
  source_type: string
  state: string
  latestRun: null | {
    id: string
    bright_data_run_id: string | null
    status: string
    products_total: number | null
    products_verified: number | null
    field_coverage: Record<string, number> | null
    schema_failure_rate: number | null
    started_at: string
    completed_at: string | null
  }
  recentEvents: Array<{
    id: string
    event_type: string
    health_state: string
    detail: string | null
    created_at: string
  }>
}

function stateColor(state: string) {
  if (['HEALTHY', 'RECOVERED'].includes(state)) return 'var(--color-verified)'
  if (['DEGRADED', 'FAILED'].includes(state)) return 'var(--color-error)'
  if (['HEALING', 'VERIFYING'].includes(state)) return 'var(--accent-600)'
  if (state === 'REAL_WORLD_CHANGE') return 'var(--accent-700)'
  return 'var(--text-tertiary)'
}

function Coverage({ coverage }: { coverage: Record<string, number> | null }) {
  const fields = ['pmax', 'voc', 'vmp', 'isc', 'imp', 'price', 'availability']
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {fields.map(field => {
        const pct = Math.round((coverage?.[field] ?? 0) * 100)
        return (
          <div key={field} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 38px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{field}</span>
            <div style={{ height: 4, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? 'var(--color-verified)' : pct >= 60 ? 'var(--accent-500)' : 'var(--color-error)' }} />
            </div>
            <span style={{ fontSize: 10, textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{pct}%</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourcePayload[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sources', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load source telemetry')
      setSources(payload.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown source error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function assess(source: SourcePayload) {
    if (!source.latestRun) return
    setAction(current => ({ ...current, [source.id]: 'Assessing latest scrape run...' }))
    try {
      const response = await fetch('/api/guardian/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, scrapeRunId: source.latestRun.id, triggeredBy: 'sources_ui' }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? payload.detail ?? 'Assessment failed')
      setAction(current => ({ ...current, [source.id]: `${payload.healthState}: ${payload.detail}` }))
      await load()
    } catch (err) {
      setAction(current => ({ ...current, [source.id]: err instanceof Error ? err.message : 'Assessment failed' }))
    }
  }

  async function heal(source: SourcePayload) {
    setAction(current => ({ ...current, [source.id]: `Starting Bright Data self-healing on ${source.collector_id}...` }))
    try {
      const start = await fetch('/api/guardian/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, reason: 'Critical field coverage dropped after controlled demo-store redesign.', triggeredBy: 'sources_ui' }),
      })
      const startPayload = await start.json()
      if (!start.ok) throw new Error(startPayload.detail ?? startPayload.error ?? 'Could not start self-healing')

      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        const status = await fetch(`/api/guardian/heal/status?sourceId=${encodeURIComponent(source.id)}`, { cache: 'no-store' })
        const payload = await status.json()

        if (!status.ok || payload.healingFailed) {
          throw new Error(payload.detail ?? 'Bright Data self-healing failed')
        }

        if (payload.autoApproved) {
          setAction(current => ({ ...current, [source.id]: 'Bright Data repair approved and saved. Waiting for completion...' }))
        } else {
          setAction(current => ({ ...current, [source.id]: `Healing ${source.collector_id}... ${attempt * 5 + 5}s` }))
        }

        if (payload.healingComplete) {
          setAction(current => ({ ...current, [source.id]: `Repair complete on the same collector ${source.collector_id}. Run Compile live again, then assess the latest run to verify recovery.` }))
          await load()
          return
        }
      }

      throw new Error('Healing is still running after 5 minutes. Refresh later. GridForge will not emit a recovered state until verification succeeds.')
    } catch (err) {
      setAction(current => ({ ...current, [source.id]: err instanceof Error ? err.message : 'Healing failed' }))
      await load()
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-base)' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container-main" style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none' }}>GridForge</Link>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Source Guardian</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </header>

      <main className="container-content" style={{ paddingBlock: '3rem 5rem' }}>
        <div style={{ maxWidth: 650, marginBottom: 34 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent-700)', fontWeight: 750, marginBottom: 9 }}>Live collector telemetry</div>
          <h1 style={{ fontSize: 34, letterSpacing: '-.045em', lineHeight: 1.08, fontWeight: 650, marginBottom: 10 }}>Source integrity</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Collection runs, field coverage and recovery events from the active Bright Data source. When critical fields disappear after a layout change, Source Guardian can invoke Bright Data self-healing on the same collector ID.
          </p>
        </div>

        {error && <div className="card" style={{ padding: 18, color: 'var(--color-error)', fontSize: 12 }}>{error}</div>}
        {!error && loading && <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading source telemetry...</p>}

        {!loading && !error && sources.length === 0 && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>No live source runs yet</div>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Publish the Scraper Studio collector and run Compile live once. The telemetry will appear here.</p>
          </div>
        )}

        <div style={{ display: 'grid', gap: 16 }}>
          {sources.map(source => (
            <article className="card" key={source.id} style={{ padding: '1.3rem 1.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: stateColor(source.state) }} />
                    <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em' }}>{source.name}</h2>
                  </div>
                  <a href={source.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--text-tertiary)', textDecoration: 'none', wordBreak: 'break-all' }}>{source.url}</a>
                </div>
                <span style={{ fontSize: 10, fontWeight: 750, color: stateColor(source.state), letterSpacing: '.05em' }}>{source.state}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,.85fr) minmax(0,1.15fr)', gap: 28 }}>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>Provenance</div>
                  {[
                    ['Collector ID', source.collector_id ?? 'Not configured'],
                    ['Snapshot', source.latestRun?.bright_data_run_id ?? 'No run yet'],
                    ['Products', source.latestRun ? `${source.latestRun.products_verified ?? 0}/${source.latestRun.products_total ?? 0} verified` : 'Not available'],
                    ['Last run', source.latestRun ? new Date(source.latestRun.started_at).toLocaleString('en-IN') : 'Not available'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border-subtle)', padding: '7px 0' }}>
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{label}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 600, fontFamily: label.includes('ID') || label === 'Snapshot' ? 'monospace' : 'inherit', textAlign: 'right', wordBreak: 'break-all' }}>{String(value)}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>Critical field coverage</div>
                  <Coverage coverage={source.latestRun?.field_coverage ?? null} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 17 }}>
                {source.latestRun && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void assess(source)}>Assess latest run</button>
                )}
                {source.state === 'DEGRADED' && source.collector_id && (
                  <button className="btn btn-primary btn-sm" onClick={() => void heal(source)}>Heal same collector</button>
                )}
                {action[source.id] && <span style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{action[source.id]}</span>}
              </div>

              {source.recentEvents.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 18, paddingTop: 14 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 9 }}>Recent events</div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {source.recentEvents.slice(0, 6).map(event => (
                      <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '130px 1fr auto', gap: 12, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 9, fontWeight: 750, color: stateColor(event.health_state), letterSpacing: '.03em' }}>{event.event_type}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{event.detail}</span>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(event.created_at).toLocaleTimeString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: '13px 15px', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)', fontSize: 10, lineHeight: 1.6, color: 'var(--text-tertiary)' }}>
          The controlled store is operator-only. For the recovery demo, switch the deployed store to Layout V2, run Compile live, assess the latest collection here, then start self-healing. GridForge only marks the source RECOVERED after a fresh collection restores critical coverage.
        </div>
      </main>
    </div>
  )
}
