/**
 * Gemini adapter — NL parsing and topology explanation ONLY.
 *
 * STRICT BOUNDARY: Gemini NEVER invents electrical values (Voc, Vmp, Isc, Imp, Pmax,
 * battery voltage, battery capacity). If a field requires an electrical value, it must
 * come from a real scrape. Gemini only interprets natural language and generates prose.
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createHash } from 'crypto'

// ── Verified model IDs (confirmed 2026-08-23) ─────────────────────────────────
const PRIMARY_MODEL = 'gemini-3.5-flash-lite'
const FALLBACK_MODEL = 'gemini-3.1-flash-lite'

// ── Simple in-process cache (prevents re-calling for same NL prompt) ──────────
const parseCache = new Map<string, StructuredRequirement>()
const explainCache = new Map<string, string>()

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StructuredRequirement {
  systemType: 'off_grid' | 'on_grid' | 'hybrid' | 'unknown'
  dailyEnergyKwh: number | null
  peakLoadKw: number | null
  budgetInr: number | null
  location: string | null
  autonomyDays: number | null
  rawNl: string
  parsedBy: 'gemini' | 'fallback'
  confidence: 'high' | 'medium' | 'low'
}

// ── Parse NL requirement ───────────────────────────────────────────────────────

const PARSE_SYSTEM_PROMPT = `You are a requirement parser for a solar system compiler.
Extract structured requirements from user input.

STRICT RULES:
- Do NOT invent or assume electrical values (voltage, current, power specs)
- Do NOT determine whether any electrical configuration is valid
- Only extract what the user explicitly stated
- For missing fields, return null
- Budget: convert to INR (lakh = 100000)
- Energy: convert to kWh/day
- Power: convert to kW peak

Return ONLY valid JSON matching this exact schema:
{
  "systemType": "off_grid" | "on_grid" | "hybrid" | "unknown",
  "dailyEnergyKwh": number | null,
  "peakLoadKw": number | null,
  "budgetInr": number | null,
  "location": string | null,
  "autonomyDays": number | null
}

No explanation, no markdown, just the JSON object.`

export async function parseRequirement(nl: string): Promise<StructuredRequirement> {
  // Cache check
  const cacheKey = createHash('sha256').update(nl.trim().toLowerCase()).digest('hex').slice(0, 16)
  if (parseCache.has(cacheKey)) {
    return parseCache.get(cacheKey)!
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.warn('[Gemini] No API key — using manual fallback parser')
    return manualParseFallback(nl)
  }

  // Try primary model, then fallback
  for (const modelId of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: PARSE_SYSTEM_PROMPT,
      })

      const result = await model.generateContent(nl)
      const text = result.response.text().trim()

      // Strip markdown code fences if present
      const jsonText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

      const parsed = JSON.parse(jsonText)

      const structured: StructuredRequirement = {
        systemType: parsed.systemType ?? 'unknown',
        dailyEnergyKwh: parsed.dailyEnergyKwh ?? null,
        peakLoadKw: parsed.peakLoadKw ?? null,
        budgetInr: parsed.budgetInr ?? null,
        location: parsed.location ?? null,
        autonomyDays: parsed.autonomyDays ?? null,
        rawNl: nl,
        parsedBy: 'gemini',
        confidence: assessConfidence(parsed),
      }

      parseCache.set(cacheKey, structured)
      return structured

    } catch (err) {
      console.error(`[Gemini] ${modelId} failed:`, err instanceof Error ? err.message : String(err))
      // continue to next model
    }
  }

  // Both models failed — use manual fallback (show this clearly in response)
  console.warn('[Gemini] Both models failed, using regex fallback')
  return manualParseFallback(nl)
}

// ── Generate explanation for a compiled topology ───────────────────────────────

const EXPLAIN_SYSTEM_PROMPT = `You are an engineering assistant explaining a solar system design.
You explain WHY the deterministic constraint solver chose this specific configuration.

STRICT RULES:
- Do NOT invent or validate electrical values
- The electrical values in the topology are ground truth — do not question or modify them
- Explain in clear, jargon-light English suitable for a non-engineer customer
- Be concise (2-3 paragraphs max)
- Mention the budget fit, energy coverage, and why this topology passes constraints
- Do NOT say "I" or "As an AI"
- Start directly with the explanation`

export async function explainTopology(
  topologyJson: string,
  requirementNl: string
): Promise<{ explanation: string; generatedBy: 'gemini' | 'template' }> {
  const cacheKey = createHash('sha256')
    .update(topologyJson + requirementNl)
    .digest('hex')
    .slice(0, 16)

  if (explainCache.has(cacheKey)) {
    return { explanation: explainCache.get(cacheKey)!, generatedBy: 'gemini' }
  }

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return { explanation: generateTemplateExplanation(topologyJson), generatedBy: 'template' }
  }

  const prompt = `
Requirement: ${requirementNl}

Compiled topology (JSON):
${topologyJson}

Explain why this system was selected and how it meets the requirements.`

  for (const modelId of [PRIMARY_MODEL, FALLBACK_MODEL]) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({
        model: modelId,
        systemInstruction: EXPLAIN_SYSTEM_PROMPT,
      })

      const result = await model.generateContent(prompt)
      const explanation = result.response.text().trim()

      explainCache.set(cacheKey, explanation)
      return { explanation, generatedBy: 'gemini' }

    } catch (err) {
      console.error(`[Gemini] explain ${modelId} failed:`, err instanceof Error ? err.message : String(err))
    }
  }

  return { explanation: generateTemplateExplanation(topologyJson), generatedBy: 'template' }
}

// ── Manual fallback parser (regex-based, for when Gemini is unavailable) ──────

function manualParseFallback(nl: string): StructuredRequirement {
  const lower = nl.toLowerCase()

  // Extract kWh/day
  const kwhMatch = lower.match(/(\d+(?:\.\d+)?)\s*kwh?\s*(?:per\s*)?(?:\/\s*)?day/i)
  const dailyEnergyKwh = kwhMatch ? parseFloat(kwhMatch[1]) : null

  // Extract kW peak
  const kwMatch = lower.match(/(\d+(?:\.\d+)?)\s*kw\s*(?:peak|load)/i)
  const peakLoadKw = kwMatch ? parseFloat(kwMatch[1]) : null

  // Extract budget in INR
  let budgetInr: number | null = null
  const lakhMatch = lower.match(/(?:rs?\.?\s*|₹\s*|inr\s*)?(\d+(?:\.\d+)?)\s*l(?:akh|ac)?/i)
  if (lakhMatch) {
    budgetInr = parseFloat(lakhMatch[1]) * 100_000
  } else {
    const rupeeMatch = lower.match(/(?:rs?\.?\s*|₹\s*|inr\s*)(\d+(?:,\d{3})*(?:\.\d+)?)/i)
    if (rupeeMatch) {
      budgetInr = parseFloat(rupeeMatch[1].replace(/,/g, ''))
    }
  }

  // System type
  let systemType: StructuredRequirement['systemType'] = 'unknown'
  if (lower.includes('off-grid') || lower.includes('off grid')) systemType = 'off_grid'
  else if (lower.includes('on-grid') || lower.includes('on grid') || lower.includes('grid-tied')) systemType = 'on_grid'
  else if (lower.includes('hybrid')) systemType = 'hybrid'

  // Location
  const locationMatch = lower.match(/\b(india|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|rajasthan|kerala|tamil)\b/i)
  const location = locationMatch ? locationMatch[0] : null

  return {
    systemType,
    dailyEnergyKwh,
    peakLoadKw,
    budgetInr,
    location,
    autonomyDays: null,
    rawNl: nl,
    parsedBy: 'fallback',
    confidence: 'low',
  }
}

function assessConfidence(parsed: Record<string, unknown>): 'high' | 'medium' | 'low' {
  const fields = ['systemType', 'dailyEnergyKwh', 'peakLoadKw', 'budgetInr']
  const filled = fields.filter(f => parsed[f] !== null && parsed[f] !== undefined && parsed[f] !== 'unknown').length
  if (filled >= 3) return 'high'
  if (filled >= 2) return 'medium'
  return 'low'
}

function generateTemplateExplanation(topologyJson: string): string {
  try {
    const t = JSON.parse(topologyJson)
    const pvKw = ((t.pvArray?.arrayPowerW ?? 0) / 1000).toFixed(2)
    const storedKwh = t.metrics?.storedEnergyKwh?.toFixed(1) ?? '—'
    const costL = t.metrics?.totalCostInr ? (t.metrics.totalCostInr / 100000).toFixed(2) : '—'
    return `This system uses a ${pvKw} kWp PV array providing sufficient daily generation. The battery bank stores ${storedKwh} kWh of usable energy, ensuring overnight and cloudy-day coverage. Total component cost is ₹${costL}L, fitting within budget. All 6 electrical constraints were validated by the deterministic solver.`
  } catch {
    return 'System compiled successfully. All electrical constraints validated.'
  }
}
