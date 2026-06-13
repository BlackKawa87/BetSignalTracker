import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { parseSignalMessage } from '../utils/signalParser'
import { sendMessage, setWebhook, getWebhookInfo } from '../utils/telegram'

const router = Router()

// ── Types ────────────────────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  username?: string
  first_name?: string
}

interface TelegramChat {
  id: number
  type: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
  caption?: string
  forward_date?: number
  forward_from?: TelegramUser
  forward_from_chat?: { id: number; title?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMessageText(msg: TelegramMessage): string | null {
  return msg.text?.trim() || msg.caption?.trim() || null
}

function isForwarded(msg: TelegramMessage): boolean {
  return !!msg.forward_date
}

function buildReply(
  parsed: ReturnType<typeof parseSignalMessage>,
  stake: number,
): string {
  if (parsed.status === 'needs_review') {
    const missing = parsed.missing_fields.join(', ')
    return (
      `⚠️ <b>Sinal salvo para revisão</b>\n\n` +
      `Campos não identificados: <b>${missing}</b>\n\n` +
      `O sinal foi registrado com status <b>needs_review</b>. ` +
      `Edite manualmente no dashboard.`
    )
  }

  const game = `${parsed.home_team} x ${parsed.away_team}`
  const lines = [
    `✅ <b>Sinal registrado!</b>`,
    ``,
    `⚽ <b>${game}</b>`,
    `📊 Mercado: ${parsed.market}`,
    `🎯 Odd: ${parsed.odd?.toFixed(2)}`,
    `💰 Stake: R$ ${stake.toFixed(2)}`,
  ]
  if (parsed.competition) lines.push(`🏆 ${parsed.competition}`)
  if (parsed.match_time) lines.push(`🕐 ${parsed.match_time}`)

  return lines.join('\n')
}

// ── Webhook ──────────────────────────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  // Always respond 200 immediately — Telegram requires it
  res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update?.message
    if (!message) return

    const chatId = message.chat.id
    const text = getMessageText(message)

    // Ignore empty messages and bot commands
    if (!text || text.startsWith('/')) return

    // Ignore very short messages unlikely to be signals
    if (text.length < 10) return

    const parsed = parseSignalMessage(text)

    // Load settings for stake calculation
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settingsError || !settings) {
      console.error('Settings not found:', settingsError)
      await sendMessage(chatId, '❌ Erro: configurações da banca não encontradas. Configure no dashboard primeiro.')
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
      status: parsed.status,
      profit_loss: null,
      raw_text: text,
      telegram_message_id: message.message_id,
      notes: parsed.missing_fields.length > 0
        ? `Revisão necessária: ${parsed.missing_fields.join(', ')}`
        : null,
    }

    const { error: insertError } = await supabase.from('signals').insert(signal)

    if (insertError) {
      console.error('Insert error:', JSON.stringify(insertError))
      await sendMessage(chatId, `❌ Erro ao salvar sinal: ${insertError.message}`)
      return
    }

    console.log(`Signal saved | status: ${parsed.status} | game: ${parsed.home_team} x ${parsed.away_team} | odd: ${parsed.odd}`)
    await sendMessage(chatId, buildReply(parsed, stake))

  } catch (err) {
    console.error('Webhook handler error:', err)
  }
})

// ── Set webhook ──────────────────────────────────────────────────────────────

router.get('/set-webhook', async (req: Request, res: Response) => {
  const url = (req.query.url as string) || process.env.PUBLIC_WEBHOOK_URL
  if (!url) {
    res.status(400).json({ error: 'Pass ?url=https://yourdomain.com or set PUBLIC_WEBHOOK_URL' })
    return
  }

  const webhookUrl = `${url.replace(/\/$/, '')}/api/telegram/webhook`

  try {
    const data = await setWebhook(webhookUrl)
    res.json({ configured_url: webhookUrl, telegram_response: data })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ── Webhook info ─────────────────────────────────────────────────────────────

router.get('/info', async (_req: Request, res: Response) => {
  try {
    const data = await getWebhookInfo()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
