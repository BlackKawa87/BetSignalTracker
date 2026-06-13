import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import telegramRouter from './routes/telegram'
import signalsRouter from './routes/signals'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

// Health check — Vercel strips /api prefix before hitting Express
// So /api/health (external) → /health (Express)
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() }),
)

// /api/telegram/* (external) → /telegram/* (Express after strip)
app.use('/telegram', telegramRouter)

// /api/signals/* (external) → /signals/* (Express after strip)
app.use('/signals', signalsRouter)

app.listen(PORT, () => {
  console.log(`BetSignalTracker backend running on port ${PORT}`)
  console.log(`Webhook: POST /api/telegram/webhook`)
  console.log(`Set webhook: GET /api/telegram/set-webhook?url=https://yourdomain.com`)
})
