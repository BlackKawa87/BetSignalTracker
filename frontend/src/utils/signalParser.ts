import { ParsedSignal } from '../types'

const MARKET_PATTERNS = [
  /ambas?\s+marcam?\s*[:\-]?\s*(sim|n[aã]o)/i,
  /btts\s*(sim|yes|no|n[aã]o)?/i,
  /ambos\s+marcam/i,
  /gols?\s+acima\s+de\s*[\d.]+/i,
  /over\s*[\d.]+/i,
  /under\s*[\d.]+/i,
  /resultado\s+final/i,
  /1x2/i,
  /dupla\s+chance/i,
  /handicap/i,
  /escanteios?/i,
  /cartões?/i,
]

function extractMarket(text: string): string | null {
  if (/ambas?\s+marcam?\s*[:\-]?\s*sim/i.test(text) || /btts\s*(sim|yes)/i.test(text)) {
    return 'Ambas Marcam - Sim'
  }
  if (/ambas?\s+marcam?\s*[:\-]?\s*n[aã]o/i.test(text) || /btts\s*(no|n[aã]o)/i.test(text)) {
    return 'Ambas Marcam - Não'
  }
  const overMatch = text.match(/over\s*([\d.]+)/i) || text.match(/acima\s+de\s*([\d.]+)/i)
  if (overMatch) return `Over ${overMatch[1]}`
  const underMatch = text.match(/under\s*([\d.]+)/i) || text.match(/abaixo\s+de\s*([\d.]+)/i)
  if (underMatch) return `Under ${underMatch[1]}`
  if (/handicap/i.test(text)) {
    const hMatch = text.match(/handicap\s*([+-]?\d+)/i)
    return hMatch ? `Handicap ${hMatch[1]}` : 'Handicap'
  }
  if (/1x2|resultado\s+final/i.test(text)) return 'Resultado Final'
  if (/dupla\s+chance/i.test(text)) return 'Dupla Chance'
  if (/escanteios?/i.test(text)) return 'Escanteios'
  if (/cartões?/i.test(text)) return 'Cartões'
  for (const pattern of MARKET_PATTERNS) {
    if (pattern.test(text)) {
      const match = text.match(pattern)
      if (match) return match[0]
    }
  }
  return null
}

function extractTeams(text: string): { home: string | null; away: string | null } {
  const vsPatterns = [
    /([A-Za-zÀ-ÿ\s.]+?)\s+[xX×vs]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$|\s+odd|\s+entrada)/i,
    /jogo:\s*([A-Za-zÀ-ÿ\s.]+?)\s+[xX×vs]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i,
    /partida:\s*([A-Za-zÀ-ÿ\s.]+?)\s+[xX×vs]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i,
  ]

  for (const pattern of vsPatterns) {
    const match = text.match(pattern)
    if (match) {
      return {
        home: match[1].trim(),
        away: match[2].trim(),
      }
    }
  }
  return { home: null, away: null }
}

function extractOdd(text: string): number | null {
  const oddPatterns = [
    /odd[:\s]+(\d+[.,]\d+)/i,
    /odd[:\s]+(\d+)/i,
    /@\s*(\d+[.,]\d+)/,
    /cotação[:\s]+(\d+[.,]\d+)/i,
    /(\d+[.,]\d{2})\s*$/,
  ]

  for (const pattern of oddPatterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1].replace(',', '.'))
      if (value >= 1.01 && value <= 50) return value
    }
  }
  return null
}

function extractTime(text: string): string | null {
  const timePatterns = [
    /horário?[:\s]+(\d{1,2}[h:]\d{2})/i,
    /às\s+(\d{1,2}[h:]\d{2})/i,
    /(\d{1,2}[h:]\d{2})\s*(?:hs?)?/i,
    /(\d{1,2}:\d{2})/,
  ]

  for (const pattern of timePatterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return null
}

function extractCompetition(text: string): string | null {
  const compPatterns = [
    /liga[:\s]+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i,
    /campeonato[:\s]+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i,
    /torneio[:\s]+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i,
    /(premier\s+league|la\s+liga|bundesliga|serie\s+a|ligue\s+1|champions\s+league|copa\s+do\s+brasil|brasileir[aã]o|libertadores)/i,
  ]

  for (const pattern of compPatterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractBookmaker(text: string): string | null {
  const bookmakers = [
    'bet365', 'betano', 'sportingbet', 'betfair', 'pinnacle',
    'betway', 'bwin', 'unibet', 'william hill', 'betsson',
    'stake', 'pixbet', 'superbet', 'novibet', 'vaidebet',
  ]

  const lower = text.toLowerCase()
  for (const bm of bookmakers) {
    if (lower.includes(bm)) return bm.charAt(0).toUpperCase() + bm.slice(1)
  }
  return null
}

export function parseSignal(rawText: string): ParsedSignal {
  const text = rawText.trim()
  const { home, away } = extractTeams(text)

  return {
    home_team: home,
    away_team: away,
    market: extractMarket(text),
    odd: extractOdd(text),
    competition: extractCompetition(text),
    bookmaker: extractBookmaker(text),
    match_time: extractTime(text),
    raw_text: rawText,
  }
}
