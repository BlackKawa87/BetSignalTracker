import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { parseSignalMessage } from '../utils/signalParser'
import { sendMessage, setWebhook, getWebhookInfo, downloadPhotoAsBase64 } from '../utils/telegram'
import { extractSignalFromImage, OcrResult } from '../utils/imageOcr'

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
  data: {
    home_team?: string | null
    away_team?: string | null
    market?: string | null
    odd?: number | null
    competition?: string | null
    match_time?: string | null
    status: string
    recommended_stake_pct?: number | null
    is_multiple?: boolean
  },
  stake: number,
  stakePct: number,
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

  const isMultiple = data.is_multiple
  const game = isMultiple ? '🎰 Múltipla' : `${data.home_team} x ${data.away_team}`

  const lines = [
    `✅ <b>Sinal registrado!</b> ${icon}`,
    ``,
    `⚽ <b>${game}</b>`,
    `📊 Mercado: ${data.market}`,
    `🎯 Odd: ${Number(data.odd).toFixed(2)}`,
    `💰 Stake: R$ ${stake.toFixed(2)} (${stakePct}%)`,
  ]
  if (data.recommended_stake_pct) lines.push(`📌 Stake do tipster: ${data.recommended_stake_pct}%`)
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
    stakePct: settings.stake_percentage,
    source: 'text' as const,
  }
}

// ── Process image signal ──────────────────────────────────────────────────────

async function processImageSignal(
  photo: PhotoSize,
  caption: string | undefined,
  settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string },
  messageId: number,
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — cannot process image signals')
  }

  const { base64, mediaType } = await downloadPhotoAsBase64(photo.file_id)
  const ocr: OcrResult = await extractSignalFromImage(base64, mediaType)

  const rawText = ocr.raw_text || caption || '[imagem]'

  const missing: string[] = []
  if (!ocr.home_team && !ocr.is_multiple) missing.push('times')
  if (!ocr.odd) missing.push('odd')
  if (!ocr.market) missing.push('mercado')

  const status: 'pending' | 'needs_review' = missing.length > 0 ? 'needs_review' : 'pending'

  // Use stake % from signal image if provided, otherwise use settings default
  const stakePct = ocr.recommended_stake_pct ?? settings.stake_percentage
  const stake = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

  // Build market label including selection
  const marketLabel = ocr.selection && ocr.market
    ? `${ocr.market} - ${ocr.selection}`
    : ocr.market

  const notes: string[] = []
  if (missing.length > 0) notes.push(`Revisão: ${missing.join(', ')}`)
  if (ocr.recommended_stake_pct) notes.push(`Stake recomendada pelo tipster: ${ocr.recommended_stake_pct}%`)
  if (ocr.is_multiple) notes.push('Múltipla')
  if (ocr.match_date) notes.push(`Data: ${ocr.match_date}`)

  return {
    signal: {
      received_at: new Date().toISOString(),
      home_team: ocr.home_team,
      away_team: ocr.away_team,
      market: marketLabel,
      odd: ocr.odd,
      competition: ocr.competition,
      bookmaker: ocr.bookmaker ?? settings.preferred_bookmaker,
      match_time: ocr.match_time,
      stake,
      status,
      profit_loss: null,
      raw_text: rawText,
      telegram_message_id: messageId,
      notes: notes.length > 0 ? notes.join(' | ') : null,
    },
    replyData: {
      home_team: ocr.home_team,
      away_team: ocr.away_team,
      market: marketLabel,
      odd: ocr.odd,
      competition: ocr.competition,
      match_time: ocr.match_time,
      status,
      recommended_stake_pct: ocr.recommended_stake_pct,
      is_multiple: ocr.is_multiple,
      bookmaker: ocr.bookmaker ?? settings.preferred_bookmaker,
      raw_text: rawText,
      missing_fields: missing,
    },
    stake,
    stakePct,
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

    let result: Awaited<ReturnType<typeof processTextSignal>> | Awaited<ReturnType<typeof processImageSignal>>

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
    await sendMessage(chatId, buildReply(result.replyData, result.stake, result.stakePct, result.source))

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
