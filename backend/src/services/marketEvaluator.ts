/**
 * Market evaluator — determines Green / Red / Void / Pending
 * based on market string (from signal) + final score.
 *
 * Supports: BTTS, Over/Under, 1X2/Moneyline, Handicap,
 *           Escanteios, Cartões (when stats provided).
 */

export type EvalResult = 'green' | 'red' | 'void' | 'pending'

export interface Score {
  home: number
  away: number
}

export interface EvalStats {
  homeCorners?: number | null
  awayCorners?: number | null
  homeYellowCards?: number | null
  awayYellowCards?: number | null
  homeRedCards?: number | null
  awayRedCards?: number | null
}

export interface EvalContext {
  market:  string
  score:   Score
  stats?:  EvalStats
}

// ── Normalize ─────────────────────────────────────────────────

function n(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 .+\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLine(m: string): number | null {
  const match = m.match(/(\d+(?:[.,]\d+)?)/)
  return match ? parseFloat(match[1].replace(',', '.')) : null
}

// ── BTTS / Ambas Marcam ───────────────────────────────────────

function evalBTTS(market: string, score: Score): EvalResult | null {
  const m = n(market)
  const isBTTS =
    m.includes('ambas') ||
    m.includes('btts') ||
    m.includes('both teams to score') ||
    m.includes('ambos os times')
  if (!isBTTS) return null

  const isNo  = m.includes(' nao') || m.includes('- nao') || m.includes('no -') || m.includes('btts no')
  const both  = score.home > 0 && score.away > 0
  return isNo ? (!both ? 'green' : 'red') : (both ? 'green' : 'red')
}

// ── Over / Under gols ─────────────────────────────────────────

function evalOverUnder(market: string, score: Score): EvalResult | null {
  const m = n(market)
  const isOver  = m.includes('over') || m.includes('mais de') || m.includes('acima de')
  const isUnder = m.includes('under') || m.includes('menos de') || m.includes('abaixo de')
  if (!isOver && !isUnder) return null

  // Market usually contains "gols" or just a number — match the line
  const line = extractLine(m)
  if (line === null) return null

  const total = score.home + score.away
  if (total === line) return 'void'
  if (isOver)  return total > line ? 'green' : 'red'
  return total < line ? 'green' : 'red'
}

// ── Gols marcados (equipe específica) ────────────────────────

function evalTeamGoals(market: string, score: Score): EvalResult | null {
  const m = n(market)
  const isCasa = m.includes('casa') || m.includes('home') || m.includes('mandante')
  const isFora = m.includes('fora') || m.includes('away') || m.includes('visitante')
  if ((!isCasa && !isFora) || (!m.includes('gol') && !m.includes('marcar'))) return null

  const isOver  = m.includes('over') || m.includes('mais de') || m.includes('acima de')
  const isUnder = m.includes('under') || m.includes('menos de') || m.includes('abaixo de')
  const line    = extractLine(m) ?? 0.5

  const goals = isCasa ? score.home : score.away
  if (goals === line) return 'void'
  if (isOver)  return goals > line ? 'green' : 'red'
  if (isUnder) return goals < line ? 'green' : 'red'
  return null
}

// ── Moneyline / Resultado Final (1X2) ─────────────────────────

function evalMoneyline(market: string, score: Score): EvalResult | null {
  const m = n(market)
  const is1x2 =
    m.includes('resultado') ||
    m.includes('moneyline') ||
    m.includes('1x2') ||
    m.includes('vencedor da partida') ||
    m.includes('vitoria')
  if (!is1x2) return null

  const homeWin = score.home > score.away
  const awayWin = score.away > score.home
  const draw    = score.home === score.away

  if (m.match(/\b1\b/) || m.includes('casa') || m.includes('home') || m.includes('mandante')) {
    return homeWin ? 'green' : 'red'
  }
  if (m.match(/\b2\b/) || m.includes('fora') || m.includes('away') || m.includes('visitante')) {
    return awayWin ? 'green' : 'red'
  }
  if (m.includes('empate') || m.includes('draw') || m.match(/\bx\b/)) {
    return draw ? 'green' : 'red'
  }
  return null
}

// ── Dupla hipótese (1X, 12, X2) ──────────────────────────────

function evalDoubleChance(market: string, score: Score): EvalResult | null {
  const m = n(market)
  if (!m.includes('dupla') && !m.includes('double chance')) return null

  const homeWin = score.home > score.away
  const awayWin = score.away > score.home
  const draw    = score.home === score.away

  if (m.includes('1x') || m.includes('casa ou empate')) return (homeWin || draw) ? 'green' : 'red'
  if (m.includes('12') || m.includes('casa ou fora'))   return (homeWin || awayWin) ? 'green' : 'red'
  if (m.includes('x2') || m.includes('empate ou fora')) return (draw || awayWin) ? 'green' : 'red'
  return null
}

// ── Handicap Asiático (simplificado) ──────────────────────────

function evalHandicap(market: string, score: Score): EvalResult | null {
  const m = n(market)
  if (!m.includes('handicap') && !m.includes(' hc ') && !m.includes('desvantagem')) return null

  const isHome = m.includes('casa') || m.includes('home') || m.match(/\b1\b/)
  const isAway = m.includes('fora') || m.includes('away') || m.match(/\b2\b/)
  if (!isHome && !isAway) return null

  const hMatch = m.match(/([+-]?\d+(?:[.,]\d)?)/)
  const hc     = hMatch ? parseFloat(hMatch[1].replace(',', '.')) : 0

  const diff = isHome ? (score.home - score.away) + hc : (score.away - score.home) + hc

  if (diff > 0)  return 'green'
  if (diff < 0)  return 'red'
  return 'void'
}

// ── Escanteios ────────────────────────────────────────────────

function evalCorners(market: string, stats?: EvalStats): EvalResult | null {
  const m = n(market)
  if (!m.includes('escanteio') && !m.includes('corner')) return null

  const hc = stats?.homeCorners
  const ac = stats?.awayCorners
  if (hc == null || ac == null) return 'pending' // stats not available

  const isOver  = m.includes('over') || m.includes('mais de')
  const isUnder = m.includes('under') || m.includes('menos de')
  const line    = extractLine(m)
  if (line === null || (!isOver && !isUnder)) return null

  const total = hc + ac
  if (total === line) return 'void'
  if (isOver)  return total > line ? 'green' : 'red'
  return total < line ? 'green' : 'red'
}

// ── Cartões ───────────────────────────────────────────────────

function evalCards(market: string, stats?: EvalStats): EvalResult | null {
  const m = n(market)
  const isCard =
    m.includes('cartao') || m.includes('card') ||
    m.includes('amarelo') || m.includes('yellow') ||
    m.includes('vermelho') || m.includes('red card')
  if (!isCard) return null

  const hy = stats?.homeYellowCards ?? 0
  const ay = stats?.awayYellowCards ?? 0
  const hr = stats?.homeRedCards ?? 0
  const ar = stats?.awayRedCards ?? 0

  // Simple check: do we have any data?
  if (!stats) return 'pending'

  const isYellow = m.includes('amarelo') || m.includes('yellow')
  const isRed    = m.includes('vermelho') || (!isYellow && m.includes('red'))
  const total    = isYellow ? hy + ay : isRed ? hr + ar : hy + ay + (hr + ar) * 2

  const isOver  = m.includes('over') || m.includes('mais de') || m.includes('acima de')
  const isUnder = m.includes('under') || m.includes('menos de')
  const line    = extractLine(m)
  if (line === null || (!isOver && !isUnder)) return null

  if (total === line) return 'void'
  if (isOver)  return total > line ? 'green' : 'red'
  return total < line ? 'green' : 'red'
}

// ── Dispatcher ────────────────────────────────────────────────

export function evaluateMarket(ctx: EvalContext): EvalResult {
  if (!ctx.market) return 'pending'

  return (
    evalBTTS(ctx.market, ctx.score) ??
    evalOverUnder(ctx.market, ctx.score) ??
    evalTeamGoals(ctx.market, ctx.score) ??
    evalMoneyline(ctx.market, ctx.score) ??
    evalDoubleChance(ctx.market, ctx.score) ??
    evalHandicap(ctx.market, ctx.score) ??
    evalCorners(ctx.market, ctx.stats) ??
    evalCards(ctx.market, ctx.stats) ??
    'pending'
  )
}

/** Human-readable description of what the market evaluator decided */
export function explainResult(
  market: string,
  score: Score,
  result: EvalResult,
): string {
  return `${market} | ${score.home}-${score.away} → ${result.toUpperCase()}`
}
