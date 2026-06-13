export interface ParsedSignal {
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  raw_text: string
  status: 'pending' | 'needs_review'
  missing_fields: string[]
}

// ── Market ──────────────────────────────────────────────────────────────────

function extractMarket(text: string): string | null {
  if (/ambas?\s+marcam?\s*[:\-]?\s*sim/i.test(text)) return 'Ambas Marcam - Sim'
  if (/btts\s*(sim|yes)/i.test(text)) return 'Ambas Marcam - Sim'
  if (/ambas?\s+marcam?\s*[:\-]?\s*n[aã]o/i.test(text)) return 'Ambas Marcam - Não'
  if (/btts\s*(no|n[aã]o)/i.test(text)) return 'Ambas Marcam - Não'

  const overM = text.match(/(?:over|acima\s+de)\s*([\d.,]+)/i)
  if (overM) return `Over ${overM[1].replace(',', '.')}`

  const underM = text.match(/(?:under|abaixo\s+de)\s*([\d.,]+)/i)
  if (underM) return `Under ${underM[1].replace(',', '.')}`

  const hcpM = text.match(/handicap\s*([+-]?[\d.,]+)/i)
  if (hcpM) return `Handicap ${hcpM[1]}`
  if (/handicap/i.test(text)) return 'Handicap'

  if (/dupla\s+chance/i.test(text)) return 'Dupla Chance'
  if (/resultado\s+final|1x2/i.test(text)) return 'Resultado Final'
  if (/gols?.*casa|home.*score/i.test(text)) return 'Gols Casa'
  if (/gols?.*fora|away.*score/i.test(text)) return 'Gols Fora'
  if (/escanteios?/i.test(text)) return 'Escanteios'
  if (/cartões?|cards?/i.test(text)) return 'Cartões'
  if (/draw|empate/i.test(text)) return 'Empate'

  // Detect "Sim" or "Não" isolated as market indicator
  if (/\bsim\b/i.test(text)) return 'Ambas Marcam - Sim'

  return null
}

// ── Teams ────────────────────────────────────────────────────────────────────

function extractTeams(text: string): { home: string | null; away: string | null } {
  // Labeled: "Jogo: A x B" or "Partida: A x B"
  const labeledMatch = text.match(
    /(?:jogo|partida|time)[:\s]+([A-Za-zÀ-ÿ\s.&'-]+?)\s+[xX×]\s+([A-Za-zÀ-ÿ\s.&'-]+?)(?:\s*[\|,\-]|\s*$)/i,
  )
  if (labeledMatch) {
    return { home: labeledMatch[1].trim(), away: labeledMatch[2].trim() }
  }

  // Generic: "A x B" or "A vs B"
  const vsMatch = text.match(
    /([A-Za-zÀ-ÿ\s.&'-]{3,}?)\s+(?:[xX×]|vs\.?)\s+([A-Za-zÀ-ÿ\s.&'-]{3,}?)(?:\s*[\|,\-]|\s+odd|\s+entrada|\s*$)/i,
  )
  if (vsMatch) {
    const home = vsMatch[1].trim()
    const away = vsMatch[2].trim()
    // Filter out false positives (single words that are likely labels)
    if (home.split(' ').length >= 1 && away.split(' ').length >= 1) {
      return { home, away }
    }
  }

  return { home: null, away: null }
}

// ── Odd ──────────────────────────────────────────────────────────────────────

function extractOdd(text: string): number | null {
  const patterns = [
    /odd[:\s]+([\d.,]+)/i,
    /cotação[:\s]+([\d.,]+)/i,
    /cota[:\s]+([\d.,]+)/i,
    /@\s*([\d.,]+)/,
    /\b([\d]+[.,][\d]{2})\b/g, // last resort: any decimal that looks like an odd
  ]

  for (const p of patterns.slice(0, 4)) {
    const m = text.match(p)
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'))
      if (v >= 1.01 && v <= 50) return Math.round(v * 100) / 100
    }
  }

  // Last resort: find all decimals and pick the most "odd-like" one
  const allDecimals = [...text.matchAll(/\b(\d+[.,]\d{2})\b/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((v) => v >= 1.01 && v <= 30)

  if (allDecimals.length === 1) return Math.round(allDecimals[0] * 100) / 100

  return null
}

// ── Time ─────────────────────────────────────────────────────────────────────

function extractTime(text: string): string | null {
  const m =
    text.match(/horário?[:\s]+(\d{1,2}[h:]\d{2})/i) ||
    text.match(/às\s+(\d{1,2}[h:]\d{2})/i) ||
    text.match(/\b(\d{1,2}:\d{2})\b/)
  return m ? m[1] : null
}

// ── Competition ──────────────────────────────────────────────────────────────

function extractCompetition(text: string): string | null {
  const labeled = text.match(/(?:liga|campeonato|torneio|comp\.?)[:\s]+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i)
  if (labeled) return labeled[1].trim()

  const known = text.match(
    /(premier\s+league|la\s+liga|bundesliga|serie\s+a|ligue\s+1|champions\s+league|europa\s+league|copa\s+do\s+brasil|brasileir[aã]o|libertadores|sudamericana|mls|eredivisie|primeira\s+liga)/i,
  )
  return known ? known[1] : null
}

// ── Bookmaker ────────────────────────────────────────────────────────────────

function extractBookmaker(text: string): string | null {
  const bms = [
    'bet365', 'betano', 'sportingbet', 'betfair', 'pinnacle',
    'betway', 'bwin', 'unibet', 'william hill', 'betsson',
    'stake', 'pixbet', 'superbet', 'novibet', 'vaidebet', 'esportiva bet',
  ]
  const lower = text.toLowerCase()
  const found = bms.find((b) => lower.includes(b))
  return found ? found.replace(/\b\w/g, (c) => c.toUpperCase()) : null
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseSignalMessage(rawText: string): ParsedSignal {
  const text = rawText.trim()
  const { home, away } = extractTeams(text)
  const odd = extractOdd(text)
  const market = extractMarket(text)

  const missing: string[] = []
  if (!home || !away) missing.push('times')
  if (!odd) missing.push('odd')
  if (!market) missing.push('mercado')

  // Needs review if missing any critical field
  const status: ParsedSignal['status'] = missing.length > 0 ? 'needs_review' : 'pending'

  return {
    home_team: home,
    away_team: away,
    market,
    odd,
    competition: extractCompetition(text),
    bookmaker: extractBookmaker(text),
    match_time: extractTime(text),
    raw_text: rawText,
    status,
    missing_fields: missing,
  }
}
