import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

function extractMarket(text: string): string | null {
  if (/ambas?\s+marcam?\s*[:\-]?\s*sim/i.test(text) || /btts\s*(sim|yes)/i.test(text)) return 'Ambas Marcam - Sim'
  if (/ambas?\s+marcam?\s*[:\-]?\s*n[aã]o/i.test(text)) return 'Ambas Marcam - Não'
  const over = text.match(/over\s*([\d.]+)/i); if (over) return `Over ${over[1]}`
  const under = text.match(/under\s*([\d.]+)/i); if (under) return `Under ${under[1]}`
  if (/1x2|resultado\s+final/i.test(text)) return 'Resultado Final'
  return null
}

function extractTeams(text: string) {
  const m = text.match(/([A-Za-zÀ-ÿ\s.]+?)\s+[xX×vs]\s+([A-Za-zÀ-ÿ\s.]+?)(?:\s*[\|,\-]|$|\s+odd)/i)
  return m ? { home: m[1].trim(), away: m[2].trim() } : { home: null, away: null }
}

function extractOdd(text: string): number | null {
  const m = text.match(/odd[:\s]+([\d.,]+)/i) || text.match(/@\s*([\d.,]+)/)
  if (!m) return null
  const v = parseFloat(m[1].replace(',', '.'))
  return v >= 1.01 && v <= 50 ? v : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.status(200).json({ ok: true })

  const message = req.body?.message
  if (!message?.text) return

  const text = (message.text as string).trim()
  if (text.startsWith('/')) return

  const { home, away } = extractTeams(text)

  const { data: settings } = await supabase
    .from('settings')
    .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!settings) return

  const stake = Math.round((settings.current_bankroll * settings.stake_percentage) / 100 * 100) / 100

  await supabase.from('signals').insert({
    received_at: new Date().toISOString(),
    home_team: home,
    away_team: away,
    market: extractMarket(text),
    odd: extractOdd(text),
    bookmaker: settings.preferred_bookmaker,
    stake,
    status: 'pending',
    profit_loss: null,
    raw_text: text,
    telegram_message_id: message.message_id,
    notes: null,
  })
}
