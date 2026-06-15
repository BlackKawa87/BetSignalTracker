import OpenAI from 'openai'

export const MARKET_CATEGORIES = [
  'Result',
  'Both Teams To Score',
  'Over Under',
  'Handicap',
  'Double Chance',
  'Team Total Goals',
  'Corners',
  'Race to Corners',
  'Cards',
  'Player Shots',
  'Player Shots On Target',
  'Bet Builder',
  'Time Window',
  'Other',
] as const

export type MarketCategory = typeof MARKET_CATEGORIES[number]

export interface BetLeg {
  market: string
  selection: string
  line: string | null
}

export interface ImagePick {
  market_category: MarketCategory | null
  market_name: string | null
  match: string | null
  competition: string | null
  team: string | null
  player: string | null
  line: string | null
  period: string | null
  selection: string | null
  odd: number | null
  stake_percentage: number | null
  is_bet_builder: boolean
  legs: BetLeg[]
  confidence_score: number
  raw_description: string | null
}

export interface ImageParseResult {
  picks: ImagePick[]
  raw_ai_json: string
  parse_error?: string
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are an expert at reading sports betting slip screenshots.

Analyze the image carefully and extract ALL bets visible. Return JSON: { "picks": [...] }

For EACH pick extract:
{
  "market_category": one of ["Result","Both Teams To Score","Over Under","Handicap","Double Chance","Team Total Goals","Corners","Race to Corners","Cards","Player Shots","Player Shots On Target","Bet Builder","Time Window","Other"],
  "market_name": full market name as shown (e.g. "1º Tempo - Escanteios Asiáticos - Mais de 2.0"),
  "match": "Home Team vs Away Team" (capitalize properly),
  "competition": league/competition name,
  "team": relevant team for team-specific markets, null if not applicable,
  "player": player name for player markets, null otherwise,
  "line": the numeric threshold as string (e.g. "9.5", "-1.5", "2.0"), null if N/A,
  "period": "Full Time" | "1st Half" | "2nd Half" | "1st 10 min" | "1st 15 min" | null,
  "selection": exact selection (e.g. "Over", "Under", "Mais de", "Sim", "Yes", "No", "Home", "Away", "Draw"),
  "odd": decimal odds as number (e.g. 1.85), null if not found,
  "stake_percentage": tipster recommended stake as a number (e.g. 1.5 for "1.5%"), null if not found,
  "is_bet_builder": true if Bet Builder / Same Game Multi / Acumulador da mesma partida,
  "legs": for Bet Builders, array of {market: string, selection: string, line: string|null}; empty array otherwise,
  "confidence_score": 0-100 your extraction confidence,
  "raw_description": exact text from the slip (preserve original wording)
}

RULES:
- Extract ALL bets visible
- For Bet Builder: is_bet_builder=true, list every leg in legs[], market_category="Bet Builder"
- odd must be decimal >= 1.01
- stake_percentage: look for "1.5%", "0.5% ✅", "2% stake", "Stake: 1%"
- market_category MUST be one of the allowed values exactly as spelled
- "Escanteios" → Corners; "Corrida de Escanteios" → Race to Corners
- "Escanteios Asiáticos" → Corners (Asian corners variant)
- "Chutes a gol" → Player Shots On Target; "Chutes" → Player Shots; "Cartões" → Cards
- period: detect from HT, FT, 1H, 2H, "1º Tempo", "2º Tempo", "Intervalo"
- match: always "Home vs Away" format

Return ONLY valid JSON. No markdown. No explanations.`

function buildPrompt(captionText?: string): string {
  if (!captionText?.trim()) return BASE_SYSTEM_PROMPT

  return `${BASE_SYSTEM_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT — CAPTION sent by the tipster alongside this image:
"${captionText.trim()}"

This caption has HIGH priority for:
- stake_percentage: look for "1.5%", "0.5% ✅", "2%", "Stake 1%"
- odd: if caption contains "Odd 1.67" or similar, use it (may override image)
- Any extra instructions or confirmations from the tipster

Merge image data + caption into a single coherent result per bet.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
}

// ── Validation ────────────────────────────────────────────────────────────────

function clampOdd(v: unknown): number | null {
  const n = Number(v)
  if (isNaN(n) || n < 1.01 || n > 500) return null
  return Math.round(n * 100) / 100
}

function clampConf(v: unknown): number {
  const n = Number(v)
  return Math.max(0, Math.min(100, Math.round(isNaN(n) ? 0 : n)))
}

function clampStakePct(v: unknown): number | null {
  const n = Number(v)
  if (isNaN(n) || n <= 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

function normalizePick(p: Record<string, unknown>): ImagePick {
  const validCategory = MARKET_CATEGORIES.includes(p.market_category as MarketCategory)
    ? (p.market_category as MarketCategory)
    : null

  const legs: BetLeg[] = Array.isArray(p.legs)
    ? (p.legs as Record<string, unknown>[]).map((l) => ({
        market:    String(l.market    ?? ''),
        selection: String(l.selection ?? ''),
        line:      l.line != null ? String(l.line) : null,
      }))
    : []

  return {
    market_category:  validCategory,
    market_name:      typeof p.market_name  === 'string' ? p.market_name  : null,
    match:            typeof p.match        === 'string' ? p.match        : null,
    competition:      typeof p.competition  === 'string' ? p.competition  : null,
    team:             typeof p.team         === 'string' ? p.team         : null,
    player:           typeof p.player       === 'string' ? p.player       : null,
    line:             p.line   != null ? String(p.line)  : null,
    period:           typeof p.period       === 'string' ? p.period       : null,
    selection:        typeof p.selection    === 'string' ? p.selection    : null,
    odd:              clampOdd(p.odd),
    stake_percentage: clampStakePct(p.stake_percentage),
    is_bet_builder:   p.is_bet_builder === true,
    legs,
    confidence_score: clampConf(p.confidence_score),
    raw_description:  typeof p.raw_description === 'string' ? p.raw_description : null,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseImageWithAI(
  imageBase64: string,
  mimeType: string,
  captionText?: string,
): Promise<ImageParseResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { picks: [], raw_ai_json: '{}', parse_error: 'OPENAI_API_KEY not configured' }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const prompt = buildPrompt(captionText)

  const response = await client.chat.completions.create({
    model:       'gpt-4o',
    max_tokens:  2048,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  })

  const rawContent = response.choices[0]?.message?.content ?? '{}'
  const cleaned    = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: { picks?: unknown[] } = {}
  try {
    parsed = JSON.parse(cleaned) as { picks?: unknown[] }
  } catch {
    return { picks: [], raw_ai_json: rawContent, parse_error: 'Failed to parse AI response as JSON' }
  }

  const picks: ImagePick[] = Array.isArray(parsed.picks)
    ? (parsed.picks as Record<string, unknown>[]).map(normalizePick)
    : []

  return { picks, raw_ai_json: JSON.stringify(parsed, null, 2) }
}

// ── Convert pick → flat DB signal fields ─────────────────────────────────────

export function pickToSignalFields(pick: ImagePick): {
  home_team:                    string | null
  away_team:                    string | null
  market:                       string | null
  market_category:              string | null
  selection:                    string | null
  period:                       string | null
  line:                         string | null
  team:                         string | null
  player:                       string | null
  is_bet_builder:               boolean
  legs:                         BetLeg[]
  odd:                          number | null
  competition:                  string | null
  confidence_score:             number
  stake_percentage_from_signal: number | null
} {
  let home_team: string | null = null
  let away_team: string | null = null

  if (pick.match) {
    const parts = pick.match.split(/\s+vs\s+/i)
    if (parts.length === 2) {
      home_team = parts[0].trim()
      away_team = parts[1].trim()
    }
  }

  return {
    home_team,
    away_team,
    market:                       pick.market_name ?? pick.market_category,
    market_category:              pick.market_category,
    selection:                    pick.selection,
    period:                       pick.period,
    line:                         pick.line,
    team:                         pick.team,
    player:                       pick.player,
    is_bet_builder:               pick.is_bet_builder,
    legs:                         pick.legs,
    odd:                          pick.odd,
    competition:                  pick.competition,
    confidence_score:             pick.confidence_score,
    stake_percentage_from_signal: pick.stake_percentage,
  }
}
