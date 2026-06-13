import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { processPendingSignals } from '../services/signalAutoClose'

const router = Router()

// ── Manual / Cron trigger ─────────────────────────────────────
// POST /api/autoclose/run   (manual, from dashboard button)
// GET  /api/cron/autoclose  (Vercel cron — routes to this same handler)

async function runHandler(_req: Request, res: Response): Promise<void> {
  // Optional secret protection
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided =
      _req.headers['x-cron-secret'] as string | undefined ??
      _req.headers.authorization?.replace('Bearer ', '')
    if (provided !== secret) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  try {
    const stats = await processPendingSignals()
    res.json({ ok: true, stats })
  } catch (err) {
    console.error('[autoclose] run error:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
}

router.post('/run', runHandler)
router.get('/run', runHandler) // also allow GET for Vercel cron via /api/autoclose/run

// ── Processing logs ───────────────────────────────────────────
// GET /api/autoclose/logs?limit=50&signal_id=xxx

router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  const limit    = Math.min(parseInt(req.query.limit as string) || 50, 200)
  const signalId = req.query.signal_id as string | undefined

  let query = supabase
    .from('processing_logs')
    .select('id, created_at, signal_id, action, details, result, signals(home_team, away_team, market)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (signalId) query = query.eq('signal_id', signalId)

  const { data, error } = await query
  if (error) { res.status(500).json({ error: error.message }); return }
  res.json(data)
})

// ── Service status ────────────────────────────────────────────
// GET /api/autoclose/status

router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  const apiKeySet = !!process.env.SPORTS_API_KEY

  // Latest log entry
  const { data: lastLog } = await supabase
    .from('processing_logs')
    .select('created_at, action, result')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Count pending signals eligible for auto-close
  const minAge = new Date(Date.now() - 110 * 60_000).toISOString()
  const { count } = await supabase
    .from('signals')
    .select('id', { count: 'exact', head: true })
    .in('status', ['pending', 'needs_review'])
    .lt('received_at', minAge)
    .not('home_team', 'is', null)
    .not('away_team',  'is', null)

  // Stats today
  const today = new Date().toISOString().slice(0, 10)
  const { data: todayLogs } = await supabase
    .from('processing_logs')
    .select('result')
    .eq('action', 'closed')
    .gte('created_at', `${today}T00:00:00Z`)

  const closedToday = todayLogs?.length ?? 0
  const greenToday  = todayLogs?.filter((l) => l.result === 'green').length ?? 0
  const redToday    = todayLogs?.filter((l) => l.result === 'red').length ?? 0

  res.json({
    ok: true,
    apiKeySet,
    lastRun:         lastLog?.created_at ?? null,
    eligiblePending: count ?? 0,
    today: { closed: closedToday, green: greenToday, red: redToday },
  })
})

export default router
