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

function progressStatuses(progress: unknown): string[] {
  const statuses: string[] = []

  function visit(value: unknown, depth: number) {
    if (depth > 4 || !value || typeof value !== 'object') return

    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1))
      return
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (
        (key === 'status' || key === 'state' || key === 'job_status') &&
        typeof nested === 'string'
      ) {
        statuses.push(nested.trim().toLowerCase().replace(/\s+/g, '_'))
      }
      visit(nested, depth + 1)
    }
  }

  visit(progress, 0)
  return statuses
}

/**
 * Poll the real Bright Data self-healing job.
 * For the controlled GridForge demo-store only, pending AI changes are
 * auto-approved with auto_save=true so the judge demo can remain one flow.
 * Real external sources remain approval-gated.
 */
export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get('sourceId')
  if (!sourceId) return NextResponse.json({ error: 'Missing sourceId' }, { status: 400 })

  const supabase = createServerClient()
  const { data: source } = await supabase
    .from('sources')
    .select('id, name, url, collector_id, source_type')
    .eq('id', sourceId)
    .single()

  if (!source?.collector_id) {
    return NextResponse.json({ error: 'Source has no Collector ID' }, { status: 404 })
  }

  const collectorId = source.collector_id

  try {
    let progressResponse = await brightData(
      `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`,
    )
    let progress = await progressResponse.json().catch(() => ({}))
    let statuses = progressStatuses(progress)
    let autoApproved = false

    const pendingAnswer = statuses.includes('pending_answer')

    if (pendingAnswer && source.source_type === 'demo_store') {
      const resumeResponse = await brightData(
        `/dca/collectors/${encodeURIComponent(collectorId)}/resume_automation_job`,
        {
          method: 'POST',
          body: JSON.stringify({ message: true, auto_save: true }),
        },
      )
      await resumeResponse.json().catch(() => ({}))
      autoApproved = true

      await supabase.from('source_health_events').insert({
        source_id: source.id,
        collector_id: collectorId,
        event_type: 'HEALING_PROGRESS',
        health_state: 'HEALING',
        detail: 'Bright Data repair reached approval gate. Controlled demo-store repair was auto-approved and saved.',
        metadata: { autoApproved: true },
      })

      progressResponse = await brightData(
        `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`,
      )
      progress = await progressResponse.json().catch(() => ({}))
      statuses = progressStatuses(progress)
    }

    const failed = statuses.some(status =>
      ['failed', 'failure', 'error'].includes(status),
    )
    const complete = !failed && statuses.some(status =>
      ['completed', 'complete', 'success', 'succeeded', 'finished', 'done'].includes(status),
    ) && !statuses.includes('pending_answer')

    if (failed) {
      await supabase.from('source_health_events').insert({
        source_id: source.id,
        collector_id: collectorId,
        event_type: 'HEALING_FAILED',
        health_state: 'FAILED',
        detail: 'Bright Data reported that the self-healing job failed.',
        metadata: { progress },
      })
    } else if (complete) {
      await supabase.from('source_health_events').insert({
        source_id: source.id,
        collector_id: collectorId,
        event_type: 'HEALING_COMPLETE',
        health_state: 'VERIFYING',
        detail: 'Bright Data repair completed. The same collector must now be rerun and field coverage re-verified before marking the source recovered.',
        metadata: { autoApproved },
      })
    }

    return NextResponse.json({
      ok: !failed,
      sourceId: source.id,
      collectorId,
      sourceType: source.source_type,
      progress,
      pendingApproval: pendingAnswer && !autoApproved,
      autoApproved,
      healingComplete: complete,
      healingFailed: failed,
      needsVerification: complete,
      verificationRule: 'Rerun the SAME collector and call /api/guardian/assess with the new scrapeRunId. Only restored coverage qualifies as RECOVERED.',
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      sourceId: source.id,
      collectorId,
      error: 'self_heal_progress_failed',
      detail: error instanceof Error ? error.message : String(error),
    }, { status: 502 })
  }
}
