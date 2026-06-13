import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import telegramRouter  from './routes/telegram'
import signalsRouter   from './routes/signals'
import autocloseRouter from './routes/autoclose'

const app  = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

// Health check
// Vercel strips /api prefix: /api/health (external) → /health (Express)
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
)

// Vercel cron job endpoint (declared in vercel.json as /api/cron/autoclose)
// Vercel strips /api → /cron/autoclose in Express
app.get('/cron/autoclose', async (_req, res) => {
  const { processPendingSignals } = await import('./services/signalAutoClose')
  try {
    const stats = await processPendingSignals()
    res.json({ ok: true, stats })
  } catch (err) {
    console.error('[cron] autoclose error:', err)
    res.status(500).json({ ok: false, error: String(err) })
  }
})

// Routes
app.use('/telegram',  telegramRouter)
app.use('/signals',   signalsRouter)
app.use('/autoclose', autocloseRouter)

app.listen(PORT, () => {
  console.log(`BetSignalTracker backend running on port ${PORT}`)
  console.log(`  Webhook:      POST /api/telegram/webhook`)
  console.log(`  Set webhook:  GET  /api/telegram/set-webhook?url=https://yourdomain.com`)
  console.log(`  Auto-close:   POST /api/autoclose/run`)
  console.log(`  Cron route:   GET  /api/cron/autoclose`)
})
