/**
 * POST /api/parse
 *
 * Parses a natural-language requirement using Gemini.
 * Returns structured requirement + parsedBy field.
 *
 * NEVER invents electrical values. Gemini boundary is strictly NL → structure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { parseRequirement } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { nl: string }

    if (!body.nl || typeof body.nl !== 'string') {
      return NextResponse.json({ error: 'Missing nl field' }, { status: 400 })
    }

    const nl = body.nl.trim()
    if (nl.length < 5) {
      return NextResponse.json({ error: 'Input too short' }, { status: 400 })
    }

    const requirement = await parseRequirement(nl)

    return NextResponse.json({
      ok: true,
      requirement,
    })

  } catch (err) {
    console.error('[api/parse] Error:', err)
    return NextResponse.json(
      { error: 'Parse failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
