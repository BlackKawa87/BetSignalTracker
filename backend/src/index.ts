import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import telegramRouter  from './routes/telegram'
import signalsRouter   from './routes/signals'
import autocloseRouter from './routes/autoclose'
import parseRouter     from './routes/parse'
import healthRouter    from './routes/health'
import demoRouter      from './routes/demo'
import testRouter      from './routes/test'
import { rateLimit }   from './middleware/rateLimiter'
import { logger }      from './utils/logger'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json({ limit: '5mb' }))

// Global rate limit: 120 req/min per IP
app.use(rateLimit(120))

// Vercel strips /api prefix: /api/health → /health
app.use('/health', healthRouter)

// Vercel cron job: /api/cron/autoclose → /cron/autoclose in Express
app.get('/cron/autoclose', async (_req, res) => {
  const { processPendingSignals } = await import('./services/signalAutoClose')
  try {
    logger.info('Cron', 'Auto-close job started')
    const stats = await processPendingSignals()
    logger.info('Cron', `Auto-close finished`, stats)
    res.json({ ok: true, stats })
  } catch (err) {
    logger.error('Cron', 'Auto-close job failed', String(err))
    res.status(500).json({ ok: false, error: String(err) })
  }
})

// Routes — stricter rate limit on parse (AI cost)
app.use('/telegram',  rateLimit(30),  telegramRouter)
app.use('/signals',   signalsRouter)
app.use('/autoclose', rateLimit(20),  autocloseRouter)
app.use('/parse',     rateLimit(15),  parseRouter)
app.use('/demo',      demoRouter)
app.use('/test',      rateLimit(30),  testRouter)

app.listen(PORT, () => {
  logger.info('Server', `BetSignalTracker backend running on port ${PORT}`)
  logger.info('Server', `Webhook secret: ${process.env.TELEGRAM_WEBHOOK_SECRET ? 'configured ✓' : 'not configured (open)'}`)
  logger.info('Server', `OpenAI:         ${process.env.OPENAI_API_KEY ? 'configured ✓' : 'not configured'}`)
  logger.info('Server', `Sports API:     ${process.env.SPORTS_API_KEY ? 'configured ✓' : 'not configured'}`)
})
