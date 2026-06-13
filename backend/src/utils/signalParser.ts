export interface ParsedSignal {
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  competition: string | null
  bookmaker: string | null
  match_time: string | null
  raw_text: string
}

function extractMarket(text: string): string | null {
  if (/ambas?\s+marcam?\s*[:\-]?\s*sim/i.test(text) || /btts\s*(sim|yes)/i.test(text)) return 'Ambas Marcam - Sim'
  if (/ambas?\s+marcam?\s*[:\-]?\s*n[aã]o/i.test(text) || /btts\s*(no|n[aã]o)/i.test(text)) return 'Ambas Marcam - Não'
  const overMatch = text.match(/over\s*([\d.]+)/i) || text.match(/acima\s+de\s*([\d.]+)/i)
  if (overMatch) return `Over ${overMatch[1]}`
  const underMatch = text.match(/under\s*([\d.]+)/i)
  if (underMatch) return `Under ${underMatch[1]}`
  if (/handicap/i.test(text)) { const m = text.match(/handicap\s*([+-]?\d+)/i); return m ? `Handicap ${m[1]}` : 'Handicap' }
  if (/1x2|resultado\s+final/i.test(text)) return 'Resultado Final'
  if (/dupla\s+chance/i.test(text)) return 'Dupla Chance'
  return null
}

function extractTeams(text: string): { home: string | null; away: string | null } {
  const pattern = /([A-Za-zÀ-ÿ\s.]+?)\s+[xX×vs]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$|\s+odd|\s+entrada)/i
  const jogo = /(?:jogo|partida)[:\s]+([A-Za-zÀ-ÿ\s.]+?)\s+[xX×]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$)/i
  for (const p of [jogo, pattern]) {
    const m = text.match(p)
    if (m) return { home: m[1].trim(), away: m[2].trim() }
  }
  return { home: null, away: null }
}

function extractOdd(text: string): number | null {
  const patterns = [/odd[:\s]+([\d.,]+)/i, /@\s*([\d.,]+)/, /([\d.,]{3,})\s*$/]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'))
      if (v >= 1.01 && v <= 50) return v
    }
  }
  return null
}

function extractTime(text: string): string | null {
  const m = text.match(/(\d{1,2}[h:]\d{2})/i)
  return m ? m[1] : null
}

function extractCompetition(text: string): string | null {
  const m = text.match(/(premier\s+league|la\s+liga|bundesliga|serie\s+a|ligue\s+1|champions\s+league|copa\s+do\s+brasil|brasileir[aã]o|libertadores)/i)
  return m ? m[1] : null
}

function extractBookmaker(text: string): string | null {
  const bms = ['bet365', 'betano', 'sportingbet', 'betfair', 'pinnacle', 'stake', 'pixbet', 'superbet', 'novibet', 'vaidebet']
  const lower = text.toLowerCase()
  const found = bms.find((b) => lower.includes(b))
  return found ? found.charAt(0).toUpperCase() + found.slice(1) : null
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
