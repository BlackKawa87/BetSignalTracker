import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { logger } from '../utils/logger'

const router = Router()

const DEMO_TAG = '[DEMO]'

// ── Demo signal data ──────────────────────────────────────────

interface DemoSignalDef {
  daysAgo: number
  home_team: string
  away_team: string
  market: string
  odd: number
  competition: string
  bookmaker: string
  status: 'green' | 'red' | 'pending' | 'needs_review' | 'void'
  stake: number
  confidence_score: number | null
}

const DEMO_SIGNALS: DemoSignalDef[] = [
  // --- GREENS ---
  { daysAgo: 85, home_team: 'Arsenal',         away_team: 'Chelsea',        market: 'Ambas Marcam - Sim',    odd: 1.72, competition: 'Premier League',    bookmaker: 'Bet365',      status: 'green', stake: 20, confidence_score: 95 },
  { daysAgo: 78, home_team: 'Barcelona',        away_team: 'Atlético Madrid', market: 'Over 2.5 Gols',        odd: 1.85, competition: 'La Liga',           bookmaker: 'Betano',      status: 'green', stake: 20, confidence_score: 92 },
  { daysAgo: 70, home_team: 'Bayern Munich',    away_team: 'Dortmund',        market: 'Resultado Final - 1',  odd: 1.60, competition: 'Bundesliga',         bookmaker: 'Bet365',      status: 'green', stake: 20, confidence_score: 88 },
  { daysAgo: 63, home_team: 'PSG',              away_team: 'Lyon',            market: 'Ambas Marcam - Sim',   odd: 1.80, competition: 'Ligue 1',            bookmaker: 'Betway',      status: 'green', stake: 20, confidence_score: 91 },
  { daysAgo: 55, home_team: 'Flamengo',         away_team: 'Palmeiras',       market: 'Over 2.5 Gols',        odd: 2.10, competition: 'Brasileirão',        bookmaker: 'Pixbet',      status: 'green', stake: 20, confidence_score: 87 },
  { daysAgo: 48, home_team: 'Man City',         away_team: 'Liverpool',       market: 'Ambas Marcam - Sim',   odd: 1.65, competition: 'Premier League',    bookmaker: 'Pinnacle',    status: 'green', stake: 20, confidence_score: 94 },
  { daysAgo: 41, home_team: 'Real Madrid',      away_team: 'Villarreal',      market: 'Resultado Final - 1',  odd: 1.55, competition: 'La Liga',           bookmaker: 'Bet365',      status: 'green', stake: 20, confidence_score: 90 },
  { daysAgo: 35, home_team: 'Juventus',         away_team: 'Napoli',          market: 'Ambas Marcam - Sim',   odd: 1.90, competition: 'Serie A',            bookmaker: 'Betano',      status: 'green', stake: 20, confidence_score: 89 },
  { daysAgo: 28, home_team: 'Tottenham',        away_team: 'West Ham',        market: 'Over 2.5 Gols',        odd: 1.78, competition: 'Premier League',    bookmaker: 'Unibet',      status: 'green', stake: 20, confidence_score: 93 },
  { daysAgo: 21, home_team: 'Benfica',          away_team: 'Porto',           market: 'Dupla Chance - 12',    odd: 1.50, competition: 'Primeira Liga',     bookmaker: 'Betway',      status: 'green', stake: 20, confidence_score: 96 },
  { daysAgo: 14, home_team: 'Ajax',             away_team: 'PSV',             market: 'Ambas Marcam - Sim',   odd: 1.82, competition: 'Eredivisie',         bookmaker: 'Bet365',      status: 'green', stake: 20, confidence_score: 91 },
  { daysAgo: 7,  home_team: 'Sevilla',          away_team: 'Valencia',        market: 'Under 2.5 Gols',       odd: 1.70, competition: 'La Liga',           bookmaker: 'Pinnacle',    status: 'green', stake: 20, confidence_score: 85 },
  { daysAgo: 3,  home_team: 'Inter Milan',      away_team: 'AC Milan',        market: 'Ambas Marcam - Sim',   odd: 1.88, competition: 'Serie A',            bookmaker: 'Betano',      status: 'green', stake: 20, confidence_score: 92 },

  // --- REDS ---
  { daysAgo: 82, home_team: 'Everton',          away_team: 'Leicester',       market: 'Over 2.5 Gols',        odd: 1.90, competition: 'Premier League',    bookmaker: 'Bet365',      status: 'red', stake: 20, confidence_score: 88 },
  { daysAgo: 74, home_team: 'Atletico Madrid',  away_team: 'Sevilla',         market: 'Ambas Marcam - Sim',   odd: 1.85, competition: 'La Liga',           bookmaker: 'Betano',      status: 'red', stake: 20, confidence_score: 90 },
  { daysAgo: 67, home_team: 'Dortmund',         away_team: 'Leverkusen',      market: 'Resultado Final - 1',  odd: 2.10, competition: 'Bundesliga',         bookmaker: 'Unibet',      status: 'red', stake: 20, confidence_score: 86 },
  { daysAgo: 59, home_team: 'Corinthians',      away_team: 'São Paulo',       market: 'Over 2.5 Gols',        odd: 2.20, competition: 'Brasileirão',        bookmaker: 'Pixbet',      status: 'red', stake: 20, confidence_score: 83 },
  { daysAgo: 52, home_team: 'Roma',             away_team: 'Lazio',           market: 'Ambas Marcam - Sim',   odd: 1.78, competition: 'Serie A',            bookmaker: 'Betway',      status: 'red', stake: 20, confidence_score: 91 },
  { daysAgo: 44, home_team: 'Liverpool',        away_team: 'Everton',         market: 'Handicap -1.5',        odd: 2.40, competition: 'Premier League',    bookmaker: 'Pinnacle',    status: 'red', stake: 20, confidence_score: 79 },
  { daysAgo: 37, home_team: 'Chelsea',          away_team: 'Brighton',        market: 'Over 2.5 Gols',        odd: 1.88, competition: 'Premier League',    bookmaker: 'Bet365',      status: 'red', stake: 20, confidence_score: 87 },
  { daysAgo: 30, home_team: 'Marseille',        away_team: 'Monaco',          market: 'Under 2.5 Gols',       odd: 1.95, competition: 'Ligue 1',            bookmaker: 'Betano',      status: 'red', stake: 20, confidence_score: 84 },
  { daysAgo: 23, home_team: 'Celtic',           away_team: 'Rangers',         market: 'Ambas Marcam - Sim',   odd: 1.80, competition: 'Scottish PL',       bookmaker: 'Bet365',      status: 'red', stake: 20, confidence_score: 89 },
  { daysAgo: 16, home_team: 'Grêmio',           away_team: 'Internacional',   market: 'Resultado Final - X',  odd: 2.80, competition: 'Brasileirão',        bookmaker: 'Betway',      status: 'red', stake: 20, confidence_score: 76 },
  { daysAgo: 9,  home_team: 'Milan',            away_team: 'Juventus',        market: 'Handicap -1.5',        odd: 2.50, competition: 'Serie A',            bookmaker: 'Pinnacle',    status: 'red', stake: 20, confidence_score: 82 },

  // --- VOID ---
  { daysAgo: 50, home_team: 'Wolfsburg',        away_team: 'Mainz',           market: 'Over 2.5 Gols',        odd: 1.85, competition: 'Bundesliga',         bookmaker: 'Unibet',      status: 'void', stake: 20, confidence_score: 90 },
  { daysAgo: 18, home_team: 'Belenenses',       away_team: 'Sporting CP',     market: 'Resultado Final - 2',  odd: 1.65, competition: 'Primeira Liga',     bookmaker: 'Bet365',      status: 'void', stake: 20, confidence_score: 88 },

  // --- NEEDS_REVIEW ---
  { daysAgo: 6,  home_team: null as unknown as string, away_team: null as unknown as string, market: 'Ambas Marcam - Sim', odd: 1.80, competition: null as unknown as string, bookmaker: 'Betano', status: 'needs_review', stake: 20, confidence_score: 42 },
  { daysAgo: 4,  home_team: 'Fluminense',       away_team: null as unknown as string, market: null as unknown as string, odd: null as unknown as number, competition: 'Brasileirão', bookmaker: 'Pixbet', status: 'needs_review', stake: 20, confidence_score: 35 },

  // --- PENDING ---
  { daysAgo: 1,  home_team: 'Napoli',           away_team: 'Atalanta',        market: 'Ambas Marcam - Sim',   odd: 1.92, competition: 'Serie A',            bookmaker: 'Betano',      status: 'pending', stake: 20, confidence_score: 93 },
  { daysAgo: 0,  home_team: 'Man United',       away_team: 'Aston Villa',     market: 'Over 2.5 Gols',        odd: 1.75, competition: 'Premier League',    bookmaker: 'Bet365',      status: 'pending', stake: 20, confidence_score: 91 },
  { daysAgo: 0,  home_team: 'Porto',            away_team: 'Braga',           market: 'Resultado Final - 1',  odd: 1.60, competition: 'Primeira Liga',     bookmaker: 'Betway',      status: 'pending', stake: 20, confidence_score: 89 },
]

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(18 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60), 0, 0)
  return d.toISOString()
}

// POST /demo/seed — insert demo signals + bankroll history
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    // Build signal rows
    const rows = DEMO_SIGNALS.map((def) => {
      const receivedAt = daysAgoIso(def.daysAgo)
      const profit_loss =
        def.status === 'green' ? Math.round(def.stake * (def.odd - 1) * 100) / 100
        : def.status === 'red'  ? -def.stake
        : def.status === 'void' ? 0
        : null

      return {
        received_at: receivedAt,
        home_team: def.home_team ?? null,
        away_team: def.away_team ?? null,
        market: def.market ?? null,
        odd: def.odd ?? null,
        competition: def.competition ?? null,
        bookmaker: def.bookmaker,
        match_time: '20:00',
        stake: def.stake,
        status: def.status,
        profit_loss,
        raw_text: `${def.home_team ?? '?'} x ${def.away_team ?? '?'} | ${def.market ?? '?'} @ ${def.odd ?? '?'}`,
        telegram_message_id: null,
        confidence_score: def.confidence_score,
        notes: `${DEMO_TAG}${def.status === 'needs_review' ? ' Revisão: ' + (def.home_team ? 'odd, mercado' : 'times, odd, mercado') : ''}`,
      }
    })

    const { data: insertedSignals, error: signalErr } = await supabase
      .from('signals')
      .insert(rows)
      .select('id, status, profit_loss, stake, odd, home_team, away_team, received_at')

    if (signalErr) {
      logger.error('Demo', 'Seed failed', signalErr.message)
      res.status(500).json({ error: signalErr.message })
      return
    }

    // Build bankroll history for resolved signals
    const resolved = (insertedSignals ?? [])
      .filter((s) => s.profit_loss !== null && s.status !== 'void')
      .sort((a, b) => a.received_at.localeCompare(b.received_at))

    let bankroll = 1000
    const historyRows = resolved.map((s) => {
      bankroll = Math.round((bankroll + (s.profit_loss ?? 0)) * 100) / 100
      return {
        bankroll,
        change: s.profit_loss ?? 0,
        reason: `${s.status === 'green' ? 'Green' : 'Red'}: ${s.home_team ?? '?'} x ${s.away_team ?? '?'} | odd ${Number(s.odd).toFixed(2)} ${DEMO_TAG}`,
        signal_id: s.id,
        created_at: s.received_at,
      }
    })

    if (historyRows.length > 0) {
      const { error: histErr } = await supabase.from('bankroll_history').insert(historyRows)
      if (histErr) logger.warning('Demo', 'Bankroll history insert partial error', histErr.message)
    }

    logger.info('Demo', `Seeded ${rows.length} demo signals + ${historyRows.length} bankroll history entries`)
    res.json({ ok: true, signals: rows.length, bankrollHistory: historyRows.length })
  } catch (err) {
    logger.error('Demo', 'Seed error', String(err))
    res.status(500).json({ error: String(err) })
  }
})

// DELETE /demo/clear — delete all demo signals (cascade deletes bankroll_history)
router.delete('/clear', async (_req: Request, res: Response) => {
  try {
    const { count, error } = await supabase
      .from('signals')
      .delete({ count: 'exact' })
      .like('notes', `%${DEMO_TAG}%`)

    if (error) {
      logger.error('Demo', 'Clear failed', error.message)
      res.status(500).json({ error: error.message })
      return
    }

    logger.info('Demo', `Cleared ${count ?? 0} demo signals`)
    res.json({ ok: true, deleted: count ?? 0 })
  } catch (err) {
    logger.error('Demo', 'Clear error', String(err))
    res.status(500).json({ error: String(err) })
  }
})

// DELETE /demo/all — delete ALL signals (danger)
router.delete('/all', async (_req: Request, res: Response) => {
  try {
    const { count: signalCount, error: sigErr } = await supabase
      .from('signals')
      .delete({ count: 'exact' })
      .gte('created_at', '1970-01-01T00:00:00Z')

    if (sigErr) {
      logger.error('Demo', 'Clear all failed', sigErr.message)
      res.status(500).json({ error: sigErr.message })
      return
    }

    // Also clear bankroll history (orphan records not covered by cascade)
    await supabase
      .from('bankroll_history')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z')

    logger.warning('Demo', `Cleared ALL data: ${signalCount ?? 0} signals`)
    res.json({ ok: true, deleted: signalCount ?? 0 })
  } catch (err) {
    logger.error('Demo', 'Clear all error', String(err))
    res.status(500).json({ error: String(err) })
  }
})

export default router
