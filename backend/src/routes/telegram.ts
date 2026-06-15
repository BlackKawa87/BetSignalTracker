import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { sendMessage, setWebhook, getWebhookInfo, downloadPhotoAsBase64 } from '../utils/telegram'
import { parseSignalWithAI } from '../services/aiSignalParser'
import { parseImageWithAI, pickToSignalFields } from '../services/imageSignalParser'
import { logger } from '../utils/logger'

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

function confidenceLabel(score: number): string {
  if (score >= 90) return `✅ Confiança: ${score}%`
  if (score >= 80) return `✅ Confiança: ${score}%`
  if (score >= 60) return `⚠️ Confiança parcial: ${score}%`
  return `⚠️ Confiança baixa: ${score}%`
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
    confidence_score?: number
    reasoning?: string
  },
  stake: number,
  stakePct: number,
  source: 'text' | 'image',
): string {
  const icon = source === 'image' ? '🖼️' : '📨'

  if (data.status === 'needs_review') {
    const conf = data.confidence_score !== undefined ? `\nConfiança: ${data.confidence_score}%` : ''
    const reason = data.reasoning ? `\n💡 ${data.reasoning}` : ''
    return (
      `⚠️ <b>Sinal salvo para revisão</b> ${icon}${conf}${reason}\n\n` +
      `Acesse o dashboard → Revisão para corrigir os campos ausentes.`
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
  if (data.recommended_stake_pct) lines.push(`📌 Stake tipster: ${data.recommended_stake_pct}%`)
  if (data.competition) lines.push(`🏆 ${data.competition}`)
  if (data.match_time) lines.push(`🕐 ${data.match_time}`)
  if (data.confidence_score !== undefined && data.confidence_score < 90) {
    lines.push(`\n${confidenceLabel(data.confidence_score)}`)
  }

  return lines.join('\n')
}

// ── Process text signal (AI parser) ──────────────────────────────────────────

async function processTextSignal(
  text: string,
  settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string },
  messageId: number,
) {
  const parsed = await parseSignalWithAI(text)
  const stakePct = parsed.stake_pct ?? settings.stake_percentage
  const stake = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

  const notes: string[] = []
  if (parsed.missing_fields.length > 0) notes.push(`Revisão: ${parsed.missing_fields.join(', ')}`)
  if (parsed.reasoning && parsed.confidence_score < 80) notes.push(`IA: ${parsed.reasoning}`)
  if (parsed.is_multiple) notes.push('Múltipla')

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
      confidence_score: parsed.confidence_score,
      notes: notes.length > 0 ? notes.join(' | ') : null,
    },
    replyData: {
      ...parsed,
      recommended_stake_pct: parsed.stake_pct,
      confidence_score: parsed.confidence_score,
      reasoning: parsed.reasoning,
    },
    stake,
    stakePct,
    source: 'text' as const,
  }
}

// ── Process image signal (GPT-4o Vision structured parser) ───────────────────

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
  const parsed = await parseImageWithAI(base64, mediaType)

  if (parsed.parse_error || parsed.picks.length === 0) {
    throw new Error(parsed.parse_error ?? 'Nenhuma aposta encontrada na imagem')
  }

  const rawText = caption || '[imagem]'
  const stakePct = settings.stake_percentage
  const stake = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

  // Use the first (or only) pick as the primary signal
  const pick = parsed.picks[0]
  const fields = pickToSignalFields(pick)

  const missing: string[] = []
  if (!fields.home_team && !fields.away_team) missing.push('times')
  if (!fields.odd) missing.push('odd')
  if (!fields.market) missing.push('mercado')

  const confidence_score = fields.confidence_score
  const status: 'pending' | 'needs_review' =
    missing.length > 0 || confidence_score < 80 ? 'needs_review' : 'pending'

  const notes: string[] = []
  if (missing.length > 0) notes.push(`Revisão: ${missing.join(', ')}`)
  if (parsed.picks.length > 1) notes.push(`Múltiplas apostas na imagem: ${parsed.picks.length}`)
  if (fields.is_bet_builder) notes.push('Bet Builder')

  return {
    signal: {
      received_at: new Date().toISOString(),
      home_team: fields.home_team,
      away_team: fields.away_team,
      market: fields.market,
      market_category: fields.market_category,
      selection: fields.selection,
      period: fields.period,
      line: fields.line,
      team: fields.team,
      player: fields.player,
      is_bet_builder: fields.is_bet_builder,
      legs: fields.legs.length > 0 ? fields.legs : null,
      odd: fields.odd,
      competition: fields.competition,
      bookmaker: settings.preferred_bookmaker,
      match_time: null,
      stake,
      status,
      profit_loss: null,
      raw_text: rawText,
      ai_raw_json: parsed.raw_ai_json,
      telegram_message_id: messageId,
      confidence_score,
      notes: notes.length > 0 ? notes.join(' | ') : null,
    },
    replyData: {
      home_team: fields.home_team,
      away_team: fields.away_team,
      market: fields.market,
      odd: fields.odd,
      competition: fields.competition,
      match_time: null,
      status,
      recommended_stake_pct: null,
      is_multiple: parsed.picks.length > 1,
      bookmaker: settings.preferred_bookmaker,
      raw_text: rawText,
      missing_fields: missing,
      confidence_score,
      reasoning: missing.length > 0
        ? `Campos ausentes: ${missing.join(', ')}`
        : `${parsed.picks.length} aposta(s) extraída(s) da imagem`,
    },
    stake,
    stakePct,
    source: 'image' as const,
  }
}

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  // Validate webhook secret if configured
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token']
    if (incoming !== webhookSecret) {
      logger.warning('Webhook', `Invalid secret token from ${req.ip} — rejected`)
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  res.status(200).json({ ok: true })

  try {
    const update: TelegramUpdate = req.body
    const message = update?.message
    if (!message) return

    const chatId = message.chat.id
    const hasText = !!message.text?.trim()
    const hasPhoto = !!message.photo?.length

    logger.info('Webhook', `Received update_id=${update.update_id} hasText=${hasText} hasPhoto=${hasPhoto}`)

    if (!hasText && !hasPhoto) return
    if (hasText && message.text!.trim().startsWith('/')) return

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settingsError || !settings) {
      logger.error('Webhook', 'Settings not found', settingsError?.message)
      await sendMessage(chatId, '❌ Configure a banca no dashboard primeiro.')
      return
    }

    let result: Awaited<ReturnType<typeof processTextSignal>> | Awaited<ReturnType<typeof processImageSignal>>

    if (hasPhoto) {
      const photo = getLargestPhoto(message.photo!)
      await sendMessage(chatId, '🔍 Analisando imagem com IA...')
      try {
        result = await processImageSignal(photo, message.caption, settings, message.message_id)
      } catch (ocrErr) {
        logger.error('Webhook', 'OCR image processing failed', String(ocrErr))
        await sendMessage(chatId, `❌ Erro ao ler imagem: ${String(ocrErr)}\n\nEnvie o sinal em texto também.`)
        return
      }
    } else {
      const text = (message.text ?? message.caption)!.trim()
      if (text.length < 5) return
      await sendMessage(chatId, '🤖 Analisando sinal com IA...')
      result = await processTextSignal(text, settings, message.message_id)
    }

    const { error: insertError } = await supabase.from('signals').insert(result.signal)

    if (insertError) {
      logger.error('Webhook', 'Supabase insert failed', insertError.message)
      await sendMessage(chatId, `❌ Erro ao salvar: ${insertError.message}`)
      return
    }

    const conf = (result.signal as { confidence_score?: number }).confidence_score ?? 0
    console.log(
      `Signal saved | source:${result.source} | status:${result.signal.status}` +
      ` | confidence:${conf}% | ${result.signal.home_team ?? 'múltipla'} x ${result.signal.away_team ?? '—'}` +
      ` | odd:${result.signal.odd}`,
    )

    await sendMessage(chatId, buildReply(result.replyData, result.stake, result.stakePct, result.source))

  } catch (err) {
    logger.critical('Webhook', 'Unhandled webhook error', String(err))
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
