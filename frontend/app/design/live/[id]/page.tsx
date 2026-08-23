"use client";

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { Component, SimulateState, Topology } from '@/types'

const TopologyCanvas = dynamic(() => import('@/components/topology/TopologyCanvas'), {
  ssr: false,
  loading: () => (
    <div className="topology-canvas tall" style={{ display: 'grid', placeItems: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
      Rendering live topology...
    </div>
  ),
})

interface StoredLiveRun {
  mode: 'live'
  q: string
  requirement: {
    dailyEnergyKwh: number | null
    peakLoadKw: number | null
    budgetInr: number | null
    location: string | null
  }
  result: {
    topology: Topology
    explanation?: string
    explanationBy?: string
    collectorIds: string[]
    scrapeRunIds: string[]
    assumptions?: string[]
    stats?: Record<string, number>
    sources?: Array<{
      name: string
      url: string
      collectorId: string
      runId: string
      scrapedAt: string
      totalProducts: number
      fieldCoverage: Record<string, number>
    }>
  }
}

const IDLE_SIMULATION: SimulateState = {
  state: 'idle',
  pvOutputW: 0,
  batteryChargePct: 65,
  loadDrawW: 0,
  batteryFlowW: 0,
  flowEdges: [],
  timeOfDay: 12,
}

function selectedComponent(topology: Topology, nodeId: string | null): Component | null {
  if (nodeId === 'panel-array') return topology.pvArray.panel
  if (nodeId === 'inverter') return topology.inverter
  if (nodeId === 'battery') return topology.battery
  return null
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={{ padding: '1rem 1.1rem', background: 'white' }}>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 650, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 21, color: 'var(--text-primary)', letterSpacing: '-.035em', fontWeight: 700, marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{detail}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, padding: '7px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

export default function LiveDesignPage() {
  const params = useParams<{ id: string }>()
  const [run, setRun] = useState<StoredLiveRun | null>(null)
  const [missing, setMissing] = useState(false)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(`compile-${params.id}`)
    if (!raw) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMissing(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as StoredLiveRun
      if (parsed.mode !== 'live' || !parsed.result?.topology) throw new Error('Invalid live run')
      setRun(parsed)
    } catch {
      setMissing(true)
    }
  }, [params.id])

  const component = useMemo(
    () => run ? selectedComponent(run.result.topology, selectedNode) : null,
    [run, selectedNode],
  )

  if (missing) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--surface-base)', padding: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Live run is no longer in this browser session</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Run Compile live again to create a fresh Bright Data-backed topology.</p>
          <Link className="btn btn-amber" href="/" style={{ textDecoration: 'none' }}>New live compile</Link>
        </div>
      </main>
    )
  }

  if (!run) {
    return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--surface-base)', color: 'var(--text-tertiary)' }}>Loading live design...</main>
  }

  const topology = run.result.topology
  const metrics = topology.metrics
  const budget = run.requirement.budgetInr
  const costLakhs = (metrics.totalCostInr / 100000).toFixed(2)
  const selectedSource = component?.source

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-base)' }}>
      <header style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,.94)', position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)' }}>
        <div className="container-main" style={{ minHeight: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Link href="/" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', fontSize: 12 }}>GridForge</Link>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.q}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 9px', borderRadius: 999, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', color: 'var(--accent-700)', fontSize: 10, fontWeight: 750, letterSpacing: '.06em' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-500)' }} />
              LIVE WITH BRIGHT DATA
            </span>
            <span style={{ padding: '4px 9px', borderRadius: 999, background: 'var(--color-verified-bg)', color: 'var(--color-verified)', fontSize: 10, fontWeight: 700 }}>
              ✓ {topology.validationStatus}
            </span>
          </div>
        </div>
      </header>

      <main className="container-main" style={{ paddingBlock: '2rem 4rem' }}>
        <div style={{ maxWidth: 760, marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: 'var(--accent-700)', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 9 }}>Compiled from the live Web</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.08, letterSpacing: '-.05em', fontWeight: 650, marginBottom: 10 }}>
            Validated topology from current inventory.
          </h1>
          <p style={{ maxWidth: 650, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            Every selected component came through a published Scraper Studio collector. Electrical compatibility is decided by deterministic constraints, not by Gemini.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 1, background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 24 }}>
          <Metric label="Live component cost" value={`₹${costLakhs}L`} detail={budget ? `₹${(budget / 100000).toFixed(2)}L budget` : 'from scraped prices'} />
          <Metric label="Daily generation" value={`${metrics.dailyEnergyKwh.toFixed(1)} kWh`} detail="sizing assumptions shown below" />
          <Metric label="Usable storage" value={`${metrics.storedEnergyKwh.toFixed(1)} kWh`} detail={`${topology.batteryUnitCount} battery units`} />
          <Metric label="PV topology" value={`${topology.pvArray.seriesCount}S × ${topology.pvArray.parallelCount}P`} detail={`${topology.pvArray.totalPanels} available panels`} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 290px', gap: 20, alignItems: 'start', marginBottom: 30 }}>
          <div>
            <TopologyCanvas
              topology={topology}
              simState={IDLE_SIMULATION}
              onNodeClick={nodeId => setSelectedNode(nodeId === selectedNode ? null : nodeId)}
            />
            <p style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>Click a component to inspect its live provenance.</p>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1rem 1.05rem' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>Live proof</div>
              <Field label="Collector" value={run.result.collectorIds.join(', ')} />
              <Field label="Scrape runs" value={run.result.scrapeRunIds.join(', ')} />
              <Field label="Validated checks" value={`${topology.constraints.filter(item => item.status === 'passed').length}/${topology.constraints.length}`} />
              <Field label="Compiler" value="Deterministic" />
            </div>

            <div className="card" style={{ padding: '1rem 1.05rem' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>
                {component ? 'Selected component' : 'Component provenance'}
              </div>
              {component && selectedSource ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 2 }}>{component.manufacturer}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>{component.model}</div>
                  <Field label="Status" value={component.verificationStatus} />
                  <Field label="Stock" value={component.availability} />
                  <Field label="Price" value={component.priceInr === null ? 'Unavailable' : `₹${component.priceInr.toLocaleString('en-IN')}`} />
                  <Field label="Collector" value={selectedSource.collectorId} />
                  <Field label="Run" value={selectedSource.scrapeRunId} />
                  <a href={selectedSource.originalUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: 12, fontSize: 11, color: 'var(--accent-700)', textDecoration: 'none' }}>Open original source ↗</a>
                </>
              ) : (
                <p style={{ fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)' }}>Select the PV array, inverter or battery node. The collector ID, run ID, price and source URL stay attached to the selected component.</p>
              )}
            </div>
          </aside>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px,.8fr)', gap: 20, alignItems: 'start' }}>
          <div className="card" style={{ padding: '1.25rem 1.35rem' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 14 }}>Constraint evidence</div>
            {topology.constraints.map(constraint => (
              <div key={constraint.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 9, padding: '9px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ width: 17, height: 17, borderRadius: '50%', display: 'grid', placeItems: 'center', background: constraint.status === 'passed' ? 'var(--color-verified)' : 'var(--color-error)', color: 'white', fontSize: 9 }}>{constraint.status === 'passed' ? '✓' : '!'}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 2 }}>{constraint.name}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{constraint.reason}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: '1.25rem 1.35rem' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>Why this system</div>
              <p style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{run.result.explanation ?? 'Compiled from live components that passed every deterministic constraint.'}</p>
              <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 8 }}>Explanation: {run.result.explanationBy ?? 'template'} | engineering decision: deterministic compiler</div>
            </div>

            {run.result.assumptions?.length ? (
              <div className="card" style={{ padding: '1.25rem 1.35rem' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-tertiary)', fontWeight: 700, marginBottom: 10 }}>Sizing assumptions</div>
                <ul style={{ paddingLeft: 17, margin: 0, display: 'grid', gap: 6 }}>
                  {run.result.assumptions.map(assumption => <li key={assumption} style={{ fontSize: 10, lineHeight: 1.55, color: 'var(--text-secondary)' }}>{assumption}</li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 10, color: 'var(--text-tertiary)' }}>
          Procurement-aware engineering simulation. Not a certified installation or wiring plan.
        </p>
      </main>
    </div>
  )
}
