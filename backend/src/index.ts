import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import telegramRouter from './routes/telegram'
import signalsRouter from './routes/signals'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/api/telegram', telegramRouter)
app.use('/api/signals', signalsRouter)

app.listen(PORT, () => {
  console.log(`BetSignalTracker backend running on port ${PORT}`)
  console.log(`Telegram webhook endpoint: POST /api/telegram/webhook`)
})
