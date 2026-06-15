import OpenAI from 'openai'
import { parseSignalMessage } from '../utils/signalParser'

const SYSTEM_PROMPT = `Você é um especialista em análise de sinais de apostas esportivas.
Sua tarefa é extrair informações estruturadas de mensagens de apostas em QUALQUER formato:
texto livre, OCR de screenshots, mensagens encaminhadas do Telegram, etc.

CAMPOS A EXTRAIR (null para não encontrado):
- home_team: Time da casa
- away_team: Time visitante
- market: Mercado completo (ex: "Ambas Marcam - Sim", "Over 2.5 Gols", "Resultado Final - 1", "Handicap -1.5")
- odd: Cota decimal (float entre 1.01 e 50.0)
- competition: Liga/campeonato
- bookmaker: Casa de apostas
- match_time: Horário no formato HH:MM
- is_multiple: true se for múltipla/acumulador
- stake_pct: Percentual de stake do tipster (número, sem %)

CONFIDENCE SCORE por campo crítico (0-100):
- teams_confidence: certeza sobre os times (95=inequívoco, 75=provável, 40=incerto, 0=ausente)
- odd_confidence: certeza sobre a odd (95=explícita com label, 75=deduzida, 0=ausente)
- market_confidence: certeza sobre o mercado (95=explícito, 75=inferido do contexto, 0=ausente)

- reasoning: explicação breve do que foi encontrado/não encontrado (max 100 chars)

REGRAS:
- Múltiplas: home_team/away_team = null, market = "Múltipla", odd = total
- Capitaliza nomes de times corretamente
- Para "X% - Pegue Aqui" → stake_pct = X
- Odd deve ser decimal (1.85, não 85)
- Se houver "Ambas Marcam" sem Sim/Não explícito → market = "Ambas Marcam - Sim"

Retorne SOMENTE JSON válido, sem markdown.`

export interface AIParseResult {
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  is_multiple: boolean
  stake_pct: number | null
  confidence_score: number
  teams_confidence: number
  odd_confidence: number
  market_confidence: number
  reasoning: string
  status: 'pending' | 'needs_review'
  missing_fields: string[]
}

function weightedConfidence(t: number, o: number, m: number): number {
  return Math.round(t * 0.4 + o * 0.3 + m * 0.3)
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

export async function parseSignalWithAI(rawText: string): Promise<AIParseResult> {
  // Fallback to regex parser when OpenAI is not configured
  if (!process.env.OPENAI_API_KEY) {
    const parsed = parseSignalMessage(rawText)
    const tc = parsed.home_team && parsed.away_team ? 65 : 0
    const oc = parsed.odd ? 65 : 0
    const mc = parsed.market ? 65 : 0
    const confidence_score = weightedConfidence(tc, oc, mc)
    const missing: string[] = []
    if (!parsed.home_team || !parsed.away_team) missing.push('times')
    if (!parsed.odd) missing.push('odd')
    if (!parsed.market) missing.push('mercado')
    return {
      ...parsed,
      is_multiple: false,
      stake_pct: null,
      confidence_score,
      teams_confidence: tc,
      odd_confidence: oc,
      market_confidence: mc,
      reasoning: 'OpenAI não configurado — parser regex usado como fallback',
      status: confidence_score < 80 ? 'needs_review' : 'pending',
      missing_fields: missing,
    }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 512,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Analise este sinal de aposta:\n\n${rawText}` },
    ],
  })

  const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}')

  const rawOdd = raw.odd !== undefined && raw.odd !== null ? Number(raw.odd) : null
  const odd = rawOdd !== null && !isNaN(rawOdd) && rawOdd >= 1.01 && rawOdd <= 50
    ? Math.round(rawOdd * 100) / 100
    : null

  const tc = clamp(Number(raw.teams_confidence) || 0)
  const oc = clamp(Number(raw.odd_confidence) || 0)
  const mc = clamp(Number(raw.market_confidence) || 0)
  const confidence_score = weightedConfidence(tc, oc, mc)

  const missing: string[] = []
  if (!raw.home_team && !raw.away_team && !raw.is_multiple) missing.push('times')
  if (!odd) missing.push('odd')
  if (!raw.market) missing.push('mercado')

  const stakePct = raw.stake_pct !== undefined && raw.stake_pct !== null
    ? Number(raw.stake_pct)
    : null

  return {
    home_team: raw.home_team ?? null,
    away_team: raw.away_team ?? null,
    market: raw.market ?? null,
    odd,
    competition: raw.competition ?? null,
    bookmaker: raw.bookmaker ?? null,
    match_time: raw.match_time ?? null,
    is_multiple: raw.is_multiple === true,
    stake_pct: stakePct !== null && !isNaN(stakePct) ? stakePct : null,
    confidence_score,
    teams_confidence: tc,
    odd_confidence: oc,
    market_confidence: mc,
    reasoning: String(raw.reasoning ?? '').slice(0, 120),
    status: confidence_score < 80 ? 'needs_review' : 'pending',
    missing_fields: missing,
  }
}

// Compute confidence for image (OCR already done via vision model)
export function computeImageConfidence(ocr: {
  home_team: string | null
  away_team: string | null
  odd: number | null
  market: string | null
  is_multiple: boolean
}): { confidence_score: number; teams_confidence: number; odd_confidence: number; market_confidence: number } {
  const tc = (ocr.home_team && ocr.away_team) ? 92 : ocr.is_multiple ? 88 : 15
  const oc = ocr.odd ? 92 : 10
  const mc = ocr.market ? 90 : 10
  const confidence_score = weightedConfidence(tc, oc, mc)
  return { confidence_score, teams_confidence: tc, odd_confidence: oc, market_confidence: mc }
}
