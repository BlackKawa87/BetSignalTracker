import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { parseSignal } from '../utils/signalParser'

const router = Router()

interface TelegramMessage {
  message_id: number
  from?: { id: number; username?: string }
  chat: { id: number; type: string }
  text?: string
  forward_from_chat?: { id: number; title?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

router.post('/webhook', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })

  const update: TelegramUpdate = req.body
  const message = update.message
  if (!message?.text) return

  const text = message.text.trim()
  if (text.startsWith('/')) return

  const parsed = parseSignal(text)

  const { data: settings } = await supabase
    .from('settings')
    .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (!settings) {
    console.warn('No settings found, skipping signal')
    return
  }

  const stake = Math.round((settings.current_bankroll * settings.stake_percentage) / 100 * 100) / 100

  const signal = {
    received_at: new Date().toISOString(),
    home_team: parsed.home_team,
    away_team: parsed.away_team,
    market: parsed.market,
    odd: parsed.odd,
    competition: parsed.competition,
    bookmaker: parsed.bookmaker ?? settings.preferred_bookmaker,
    match_time: parsed.match_time,
    stake,
    status: 'pending',
    profit_loss: null,
    raw_text: text,
    telegram_message_id: message.message_id,
    notes: null,
  }

  const { error } = await supabase.from('signals').insert(signal)
  if (error) {
    console.error('Failed to insert signal:', error)
  } else {
    console.log(`Signal received: ${parsed.home_team} x ${parsed.away_team} | ${parsed.market} | Odd ${parsed.odd}`)
  }
})

router.post('/set-webhook', async (req: Request, res: Response) => {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const webhookUrl = req.body.url as string

  if (!token) {
    res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' })
    return
  }
  if (!webhookUrl) {
    res.status(400).json({ error: 'url is required in body' })
    return
  }

  const response = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: `${webhookUrl}/api/telegram/webhook` }),
    },
  )
  const data = await response.json()
  res.json(data)
})

router.get('/webhook-info', async (_req: Request, res: Response) => {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) { res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' }); return }
  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
  const data = await response.json()
  res.json(data)
})

export default router
