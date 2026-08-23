import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ScrapeRun = Database['public']['Tables']['scrape_runs']['Row']

function derivedState(run: ScrapeRun | null | undefined): string {
  if (!run) return 'NOT_RUN'
  if (run.status === 'failed') return 'DEGRADED'
  const coverage = (run.field_coverage ?? {}) as Record<string, number>
  const fields = ['pmax', 'voc', 'vmp', 'isc']
  const avg = fields.reduce((sum, field) => sum + (coverage[field] ?? 0), 0) / fields.length
  if (avg < 0.60 || Number(run.schema_failure_rate ?? 0) > 0.30) return 'DEGRADED'
  return 'HEALTHY'
}

export async function GET() {
  const supabase = createServerClient()
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, name, url, collector_id, source_type, updated_at')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const output = await Promise.all((sources ?? []).map(async source => {
    const [{ data: runs }, { data: events }] = await Promise.all([
      supabase
        .from('scrape_runs')
        .select('*')
        .eq('source_id', source.id)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('source_health_events')
        .select('*')
        .eq('source_id', source.id)
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    const latestRun = runs?.[0] ?? null
    const latestEvent = events?.[0] ?? null
    const eventIsNewer = latestEvent && latestRun
      ? new Date(latestEvent.created_at).getTime() >= new Date(latestRun.started_at).getTime()
      : Boolean(latestEvent)

    return {
      ...source,
      state: eventIsNewer && latestEvent ? latestEvent.health_state : derivedState(latestRun),
      latestRun,
      recentRuns: runs ?? [],
      recentEvents: events ?? [],
    }
  }))

  return NextResponse.json({ ok: true, sources: output })
}
