import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now()

  // Test Supabase connectivity with a lightweight query
  let supabaseOk = false
  let supabaseError: string | null = null
  try {
    const { error } = await supabase.from('settings').select('id').limit(1)
    if (error) { supabaseError = error.message } else { supabaseOk = true }
  } catch (e) {
    supabaseError = String(e)
  }

  const env = {
    supabaseUrl:         !!process.env.SUPABASE_URL,
    supabaseKey:         !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    telegramToken:       !!process.env.TELEGRAM_BOT_TOKEN,
    telegramSecret:      !!process.env.TELEGRAM_WEBHOOK_SECRET,
    openai:              !!process.env.OPENAI_API_KEY,
    sportsApi:           !!process.env.SPORTS_API_KEY,
    cronSecret:          !!process.env.CRON_SECRET,
  }

  const allRequired = env.supabaseUrl && env.supabaseKey
  const status = allRequired && supabaseOk ? 'ok' : 'degraded'

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    latency_ms: Date.now() - start,
    services: {
      supabase: supabaseOk ? 'ok' : 'error',
      supabaseError: supabaseError ?? undefined,
      telegram: env.telegramToken ? 'configured' : 'not_configured',
      openai:   env.openai        ? 'configured' : 'not_configured',
      sportsApi: env.sportsApi    ? 'configured' : 'not_configured',
    },
    security: {
      webhookSecret:     env.telegramSecret,
      cronSecret:        env.cronSecret,
    },
    env,
  })
})

export default router
