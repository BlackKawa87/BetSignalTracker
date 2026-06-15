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

const SYSTEM_PROMPT = `You are an expert at reading sports betting slip screenshots.

Analyze the image carefully and extract ALL bets visible. Return JSON: { "picks": [...] }

For EACH pick extract:
{
  "market_category": one of ["Result","Both Teams To Score","Over Under","Handicap","Double Chance","Team Total Goals","Corners","Race to Corners","Cards","Player Shots","Player Shots On Target","Bet Builder","Time Window","Other"],
  "market_name": full market name as shown (e.g. "Escanteios Totais - Over 9.5", "Ambas Marcam - Sim"),
  "match": "Home Team vs Away Team" (use "vs" separator, capitalize properly),
  "competition": league/competition name (e.g. "Premier League", "La Liga", "Champions League"),
  "team": relevant team for team-specific markets (null if not applicable),
  "player": player name for player markets, null otherwise,
  "line": the numeric threshold as string (e.g. "9.5", "-1.5", "2.5"), null if N/A,
  "period": "Full Time" | "1st Half" | "2nd Half" | "1st 10 min" | "1st 15 min" | "Last 10 min" | null,
  "selection": exact selection (e.g. "Over", "Under", "Yes", "No", "Home", "Away", "Draw", "1", "X", "2"),
  "odd": decimal odds as number (e.g. 1.85), null if not found,
  "is_bet_builder": true if this is a Bet Builder / Same Game Multi / Acumulador da mesma partida,
  "legs": for Bet Builders, array of {market: string, selection: string, line: string|null} for each leg; empty array otherwise,
  "confidence_score": 0-100 your extraction confidence,
  "raw_description": exact text from the slip for this bet (preserve original wording)
}

RULES:
- Extract ALL bets visible (a slip may have multiple picks)
- For Bet Builder: is_bet_builder=true, list every leg in legs[], set market_category="Bet Builder"
- odd must be decimal >= 1.01 (e.g. 1.85 not 85 or 85%)
- If a field is not visible, return null
- market_category MUST be one of the allowed values exactly as spelled
- For "Escanteios": use Corners; for "Corrida de Escanteios": Race to Corners
- For "Chutes a gol": Player Shots On Target; for "Chutes": Player Shots
- For "Cartões": Cards
- period: detect from labels like HT, FT, 1H, 2H, "Intervalo", "Primeiro Tempo"
- competition: use proper names, not abbreviations

Return ONLY valid JSON. No markdown. No explanations.`

function clampOdd(v: unknown): number | null {
  const n = Number(v)
  if (isNaN(n) || n < 1.01 || n > 500) return null
  return Math.round(n * 100) / 100
}

function clampConf(v: unknown): number {
  const n = Number(v)
  return Math.max(0, Math.min(100, Math.round(isNaN(n) ? 0 : n)))
}

function normalizePick(p: Record<string, unknown>): ImagePick {
  const validCategory = MARKET_CATEGORIES.includes(p.market_category as MarketCategory)
    ? (p.market_category as MarketCategory)
    : null

  const legs: BetLeg[] = Array.isArray(p.legs)
    ? (p.legs as Record<string, unknown>[]).map((l) => ({
        market: String(l.market ?? ''),
        selection: String(l.selection ?? ''),
        line: l.line != null ? String(l.line) : null,
      }))
    : []

  return {
    market_category: validCategory,
    market_name: typeof p.market_name === 'string' ? p.market_name : null,
    match: typeof p.match === 'string' ? p.match : null,
    competition: typeof p.competition === 'string' ? p.competition : null,
    team: typeof p.team === 'string' ? p.team : null,
    player: typeof p.player === 'string' ? p.player : null,
    line: p.line != null ? String(p.line) : null,
    period: typeof p.period === 'string' ? p.period : null,
    selection: typeof p.selection === 'string' ? p.selection : null,
    odd: clampOdd(p.odd),
    is_bet_builder: p.is_bet_builder === true,
    legs,
    confidence_score: clampConf(p.confidence_score),
    raw_description: typeof p.raw_description === 'string' ? p.raw_description : null,
  }
}

export async function parseImageWithAI(
  imageBase64: string,
  mimeType: string,
): Promise<ImageParseResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      picks: [],
      raw_ai_json: '{}',
      parse_error: 'OPENAI_API_KEY not configured',
    }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2048,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
          { type: 'text', text: SYSTEM_PROMPT },
        ],
      },
    ],
  })

  const rawContent = response.choices[0]?.message?.content ?? '{}'
  const cleaned = rawContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: { picks?: unknown[] } = {}
  try {
    parsed = JSON.parse(cleaned) as { picks?: unknown[] }
  } catch {
    return {
      picks: [],
      raw_ai_json: rawContent,
      parse_error: 'Failed to parse AI response as JSON',
    }
  }

  const picks: ImagePick[] = Array.isArray(parsed.picks)
    ? (parsed.picks as Record<string, unknown>[]).map(normalizePick)
    : []

  return {
    picks,
    raw_ai_json: JSON.stringify(parsed, null, 2),
  }
}

// Convert an ImagePick to flat DB-compatible signal fields
export function pickToSignalFields(pick: ImagePick): {
  home_team: string | null
  away_team: string | null
  market: string | null
  market_category: string | null
  selection: string | null
  period: string | null
  line: string | null
  team: string | null
  player: string | null
  is_bet_builder: boolean
  legs: BetLeg[]
  odd: number | null
  competition: string | null
  confidence_score: number
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

  const market = pick.market_name ?? pick.market_category

  return {
    home_team,
    away_team,
    market,
    market_category: pick.market_category,
    selection: pick.selection,
    period: pick.period,
    line: pick.line,
    team: pick.team,
    player: pick.player,
    is_bet_builder: pick.is_bet_builder,
    legs: pick.legs,
    odd: pick.odd,
    competition: pick.competition,
    confidence_score: pick.confidence_score,
  }
}
