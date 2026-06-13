/**
 * Signal Auto-Close Service
 *
 * Groups pending signals by date, batches API calls,
 * evaluates markets and closes signals automatically.
 *
 * Called by the cron endpoint every 15 minutes.
 */

import { supabase } from '../utils/supabase'
import { searchMatch } from './sportsApi'
import { evaluateMarket, explainResult, EvalResult } from './marketEvaluator'

// ── Types ─────────────────────────────────────────────────────

interface Signal {
  id: string
  home_team: string | null
  away_team: string | null
  market: string | null
  odd: number | null
  stake: number
  status: string
  received_at: string
  notes: string | null
}

interface ProcessingLogInsert {
  signal_id: string
  action: string
  details: Record<string, unknown>
  result: string | null
}

export interface JobStats {
  processed: number
  closed:    number
  skipped:   number
  errors:    number
  startedAt: string
  finishedAt: string
}

// ── Helpers ───────────────────────────────────────────────────

async function writeLog(log: ProcessingLogInsert): Promise<void> {
  await supabase.from('processing_logs').insert(log)
}

async function getSettings() {
  const { data } = await supabase
    .from('settings')
    .select('id, current_bankroll')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

/** Returns the last log action for a signal in the last N minutes. */
async function getLastLog(signalId: string, withinMinutes = 30): Promise<string | null> {
  const since = new Date(Date.now() - withinMinutes * 60_000).toISOString()
  const { data } = await supabase
    .from('processing_logs')
    .select('action, result')
    .eq('signal_id', signalId)
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.action ?? null
}

function isMultiple(signal: Signal): boolean {
  const notes = (signal.notes ?? '').toLowerCase()
  return notes.includes('múltipla') || notes.includes('multipla') || notes.includes('acumulador')
}

function calculateProfitLoss(result: EvalResult, stake: number, odd: number | null): number {
  if (result === 'green') return Math.round(stake * ((odd ?? 2) - 1) * 100) / 100
  if (result === 'red')   return -stake
  return 0 // void
}

// ── Main processor ────────────────────────────────────────────

export async function processPendingSignals(): Promise<JobStats> {
  const startedAt = new Date().toISOString()
  const stats: JobStats = { processed: 0, closed: 0, skipped: 0, errors: 0, startedAt, finishedAt: '' }

  if (!process.env.SPORTS_API_KEY) {
    console.warn('[autoclose] SPORTS_API_KEY not set — skipping job')
    stats.finishedAt = new Date().toISOString()
    return stats
  }

  // Signals received > 110 min ago (enough time for match to finish) and < 7 days ago
  const minAge = new Date(Date.now() - 110 * 60_000).toISOString()
  const maxAge = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString()

  const { data: signals, error } = await supabase
    .from('signals')
    .select('id, home_team, away_team, market, odd, stake, status, received_at, notes')
    .in('status', ['pending', 'needs_review'])
    .lt('received_at', minAge)
    .gt('received_at', maxAge)
    .not('home_team', 'is', null)
    .order('received_at', { ascending: true })
    .limit(50) // safety cap per run

  if (error || !signals || signals.length === 0) {
    console.log('[autoclose] no signals to process')
    stats.finishedAt = new Date().toISOString()
    return stats
  }

  console.log(`[autoclose] processing ${signals.length} signals`)

  const settings = await getSettings()
  if (!settings) {
    console.error('[autoclose] settings not found')
    stats.finishedAt = new Date().toISOString()
    return stats
  }

  let currentBankroll = settings.current_bankroll

  for (const signal of signals as Signal[]) {
    stats.processed++

    // ── Skip multiples ──────────────────────────────────────
    if (isMultiple(signal)) {
      await writeLog({
        signal_id: signal.id,
        action: 'skipped',
        details: { reason: 'Múltipla — fechamento automático não suportado' },
        result: 'skip',
      })
      stats.skipped++
      continue
    }

    // ── Skip if no team info ────────────────────────────────
    if (!signal.home_team || !signal.away_team) {
      await writeLog({
        signal_id: signal.id,
        action: 'skipped',
        details: { reason: 'Faltam os nomes dos times' },
        result: 'skip',
      })
      stats.skipped++
      continue
    }

    // ── Skip if recently attempted ──────────────────────────
    const lastAction = await getLastLog(signal.id, 30)
    if (lastAction === 'not_found' || lastAction === 'in_progress') {
      stats.skipped++
      continue
    }

    // ── Search for the fixture ──────────────────────────────
    const signalDate = signal.received_at.slice(0, 10)
    try {
      const { result: match, datesChecked } = await searchMatch(
        signal.home_team,
        signal.away_team,
        signalDate,
      )

      if (!match) {
        await writeLog({
          signal_id: signal.id,
          action: 'not_found',
          details: {
            home_team:     signal.home_team,
            away_team:     signal.away_team,
            signal_date:   signalDate,
            dates_checked: datesChecked,
          },
          result: null,
        })
        continue
      }

      // ── Match found but still in progress ──────────────────
      if (match.inProgress) {
        await writeLog({
          signal_id: signal.id,
          action: 'in_progress',
          details: {
            fixture_id: match.fixtureId,
            status:     match.status,
            league:     match.leagueName,
            similarity: match.similarity,
          },
          result: null,
        })
        continue
      }

      // ── Match not finished and not started ──────────────────
      if (!match.finished) {
        await writeLog({
          signal_id: signal.id,
          action: 'not_finished',
          details: {
            fixture_id: match.fixtureId,
            status:     match.status,
            date:       match.date,
          },
          result: null,
        })
        continue
      }

      // ── Score not available ─────────────────────────────────
      if (match.homeGoals === null || match.awayGoals === null) {
        stats.skipped++
        continue
      }

      // ── Evaluate market ─────────────────────────────────────
      const score  = { home: match.homeGoals, away: match.awayGoals }
      const result = evaluateMarket({ market: signal.market ?? '', score })

      if (result === 'pending') {
        await writeLog({
          signal_id: signal.id,
          action: 'unknown_market',
          details: {
            market:     signal.market,
            score:      `${match.homeGoals}-${match.awayGoals}`,
            fixture_id: match.fixtureId,
          },
          result: null,
        })
        stats.skipped++
        continue
      }

      // ── Close the signal ────────────────────────────────────
      const profitLoss  = calculateProfitLoss(result, signal.stake, signal.odd)
      const newBankroll = Math.round((currentBankroll + profitLoss) * 100) / 100
      const explanation = explainResult(signal.market ?? '?', score, result)

      await Promise.all([
        supabase.from('signals').update({
          status:     result,
          profit_loss: profitLoss,
          updated_at: new Date().toISOString(),
        }).eq('id', signal.id),

        supabase.from('settings').update({
          current_bankroll: newBankroll,
          updated_at:       new Date().toISOString(),
        }).eq('id', settings.id),

        supabase.from('bankroll_history').insert({
          bankroll:  newBankroll,
          change:    profitLoss,
          reason:    `Auto: ${result.toUpperCase()} — ${signal.home_team} x ${signal.away_team} ${match.homeGoals}-${match.awayGoals}`,
          signal_id: signal.id,
        }),

        writeLog({
          signal_id: signal.id,
          action:    'closed',
          details: {
            fixture_id:   match.fixtureId,
            league:       match.leagueName,
            api_teams:    `${match.homeTeam} x ${match.awayTeam}`,
            similarity:   match.similarity,
            score:        `${match.homeGoals}-${match.awayGoals}`,
            market:       signal.market,
            explanation,
            profit_loss:  profitLoss,
            new_bankroll: newBankroll,
          },
          result,
        }),
      ])

      currentBankroll = newBankroll
      stats.closed++
      console.log(`[autoclose] closed ${signal.home_team} x ${signal.away_team} → ${result} (${profitLoss >= 0 ? '+' : ''}${profitLoss})`)

    } catch (err) {
      const errMsg = String(err)
      await writeLog({
        signal_id: signal.id,
        action:    'error',
        details:   { error: errMsg },
        result:    'error',
      })
      console.error(`[autoclose] error processing ${signal.id}: ${errMsg}`)
      stats.errors++
    }
  }

  stats.finishedAt = new Date().toISOString()
  console.log(`[autoclose] done — closed: ${stats.closed}, skipped: ${stats.skipped}, errors: ${stats.errors}`)
  return stats
}
