import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { parseSignalMessage } from '../utils/signalParser'
import { sendMessage, setWebhook, getWebhookInfo, downloadPhotoAsBase64 } from '../utils/telegram'
import { extractSignalFromImage, parseClaudeResponse } from '../utils/imageOcr'

const router = Router()

// ── Telegram types ────────────────────────────────────────────────────────────

interface PhotoSize {
  file_id: string
  width: number
  height: number
  file_size?: number
}

interface TelegramMessage {
  message_id: number
  from?: { id: number; username?: string; first_name?: string }
  chat: { id: number; type: string }
  text?: string
  caption?: string
  photo?: PhotoSize[]
  forward_date?: number
  forward_from?: { id: number }
  forward_from_chat?: { id: number; title?: string }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLargestPhoto(photos: PhotoSize[]): PhotoSize {
  return photos.reduce((best, p) => (p.file_size ?? 0) > (best.file_size ?? 0) ? p : best)
}

function buildReply(
  data: { home_team?: string | null; away_team?: string | null; market?: string | null; odd?: number | null; competition?: string | null; match_time?: string | null; status: string },
  stake: number,
  source: 'text' | 'image',
): string {
  const icon = source === 'image' ? '🖼️' : '📨'

  if (data.status === 'needs_review') {
    return (
      `⚠️ <b>Sinal salvo para revisão</b> ${icon}\n\n` +
      `Não consegui identificar todos os campos.\n` +
      `Edite manualmente no dashboard.`
    )
  }

  const game = `${data.home_team} x ${data.away_team}`
  const lines = [
    `✅ <b>Sinal registrado!</b> ${icon}`,
    ``,
    `⚽ <b>${game}</b>`,
    `📊 Mercado: ${data.market}`,
    `🎯 Odd: ${Number(data.odd).toFixed(2)}`,
    `💰 Stake: R$ ${stake.toFixed(2)}`,
  ]
  if (data.competition) lines.push(`🏆 ${data.competition}`)
  if (data.match_time) lines.push(`🕐 ${data.match_time}`)

  return lines.join('\n')
}

// ── Process text signal ───────────────────────────────────────────────────────

async function processTextSignal(text: string, settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string }, messageId: number) {
  const parsed = parseSignalMessage(text)
  const stake = Math.round((settings.current_bankroll * settings.stake_percentage) / 100 * 100) / 100

  return {
    signal: {
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
      telegram_message_id: messageId,
      notes: parsed.missing_fields.length > 0 ? `Revisão: ${parsed.missing_fields.join(', ')}` : null,
    },
    replyData: { ...parsed, status: parsed.status },
    stake,
    source: 'text' as const,
  }
}

// ── Process image signal ──────────────────────────────────────────────────────

async function processImageSignal(photo: PhotoSize, caption: string | undefined, settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string }, messageId: number) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured — cannot process image signals')
  }

  const { base64, mediaType } = await downloadPhotoAsBase64(photo.file_id)
  const jsonText = await extractSignalFromImage(base64, mediaType)
  const extracted = parseClaudeResponse(jsonText)

  const rawText = (extracted.raw_text as string) || caption || '[imagem sem texto]'
  const odd = extracted.odd ? Number(extracted.odd) : null

  const missing: string[] = []
  if (!extracted.home_team || !extracted.away_team) missing.push('times')
  if (!odd) missing.push('odd')
  if (!extracted.market) missing.push('mercado')

  const status = missing.length > 0 ? 'needs_review' : 'pending'
  const stake = Math.round((settings.current_bankroll * settings.stake_percentage) / 100 * 100) / 100

  return {
    signal: {
      received_at: new Date().toISOString(),
      home_team: (extracted.home_team as string) || null,
      away_team: (extracted.away_team as string) || null,
      market: (extracted.market as string) || null,
      odd,
      competition: (extracted.competition as string) || null,
      bookmaker: (extracted.bookmaker as string) || settings.preferred_bookmaker,
      match_time: (extracted.match_time as string) || null,
      stake,
      status,
      profit_loss: null,
      raw_text: rawText,
      telegram_message_id: messageId,
      notes: missing.length > 0 ? `Revisão: ${missing.join(', ')}` : null,
    },
    replyData: {
      home_team: (extracted.home_team as string) || null,
      away_team: (extracted.away_team as string) || null,
      market: (extracted.market as string) || null,
      odd,
      competition: (extracted.competition as string) || null,
      match_time: (extracted.match_time as string) || null,
      status,
    },
    stake,
    source: 'image' as const,
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update?.message
    if (!message) return

    const chatId = message.chat.id
    const hasText = !!message.text?.trim()
    const hasPhoto = !!message.photo?.length
    const hasCaption = !!message.caption?.trim()

    // Nothing to process
    if (!hasText && !hasPhoto) return

    // Ignore bot commands
    if (hasText && message.text!.trim().startsWith('/')) return

    // Load settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settingsError || !settings) {
      await sendMessage(chatId, '❌ Configure a banca no dashboard primeiro.')
      return
    }

    let result: Awaited<ReturnType<typeof processTextSignal>>

    if (hasPhoto) {
      // Image signal
      const photo = getLargestPhoto(message.photo!)
      await sendMessage(chatId, '🔍 Analisando imagem do sinal...')

      try {
        result = await processImageSignal(photo, message.caption, settings, message.message_id)
      } catch (ocrErr) {
        console.error('OCR error:', ocrErr)
        await sendMessage(chatId, `❌ Erro ao ler imagem: ${String(ocrErr)}\n\nEnvie o sinal em texto também.`)
        return
      }
    } else {
      // Text signal
      const text = (message.text ?? message.caption)!.trim()
      if (text.length < 10) return
      result = await processTextSignal(text, settings, message.message_id)
    }

    const { error: insertError } = await supabase.from('signals').insert(result.signal)

    if (insertError) {
      console.error('Insert error:', JSON.stringify(insertError))
      await sendMessage(chatId, `❌ Erro ao salvar: ${insertError.message}`)
      return
    }

    console.log(`Signal saved | source: ${result.source} | status: ${result.signal.status} | ${result.signal.home_team} x ${result.signal.away_team} | odd: ${result.signal.odd}`)
    await sendMessage(chatId, buildReply(result.replyData, result.stake, result.source))

  } catch (err) {
    console.error('Webhook error:', err)
  }
})

// ── Set webhook ───────────────────────────────────────────────────────────────

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

// ── Webhook info ──────────────────────────────────────────────────────────────

router.get('/info', async (_req: Request, res: Response) => {
  try {
    const data = await getWebhookInfo()
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
