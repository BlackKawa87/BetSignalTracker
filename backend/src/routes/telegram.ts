import { Router, Request, Response } from 'express'
import { supabase } from '../utils/supabase'
import { sendMessage, setWebhook, getWebhookInfo } from '../utils/telegram'
import { extractTelegramSignalPayload, TelegramUpdate } from '../utils/telegramPayload'
import { parseSignalWithAI } from '../services/aiSignalParser'
import { parseImageWithAI, pickToSignalFields, accumulatorLabel } from '../services/imageSignalParser'
import { logger } from '../utils/logger'

const router = Router()

// ── Reply builder ─────────────────────────────────────────────────────────────

function confidenceLabel(score: number): string {
  if (score >= 80) return `✅ Confiança: ${score}%`
  if (score >= 60) return `⚠️ Confiança parcial: ${score}%`
  return `⚠️ Confiança baixa: ${score}%`
}

type ReplySource = 'text' | 'image' | 'image_with_caption' | 'document_image'

function buildReply(
  data: {
    home_team?: string | null
    away_team?: string | null
    market?: string | null
    odd?: number | null
    competition?: string | null
    match_time?: string | null
    status: string
    stake_percentage_from_signal?: number | null
    is_multiple?: boolean
    picks_count?: number
    confidence_score?: number
    reasoning?: string
  },
  stake: number,
  stakePct: number,
  source: ReplySource,
): string {
  const icon =
    source === 'text'               ? '📨' :
    source === 'image_with_caption' ? '🖼️💬' : '🖼️'

  if (data.status === 'needs_review') {
    const conf   = data.confidence_score !== undefined ? `\nConfiança: ${data.confidence_score}%` : ''
    const reason = data.reasoning ? `\n💡 ${data.reasoning}` : ''
    return (
      `⚠️ <b>Sinal salvo para revisão</b> ${icon}${conf}${reason}\n\n` +
      `Acesse o dashboard → Revisão para corrigir os campos ausentes.`
    )
  }

  const game = data.is_multiple
    ? (data.market ?? 'Múltipla')   // Dupla / Tripla / Múltipla
    : `${data.home_team ?? '?'} x ${data.away_team ?? '?'}`

  const accIcon = data.is_multiple ? '🎰 ' : ''

  const lines = [
    `✅ <b>Sinal registrado!</b> ${icon}`,
    ``,
    `⚽ <b>${accIcon}${game}</b>`,
    `🎯 Odd: ${Number(data.odd).toFixed(2)}`,
    `💰 Stake: R$ ${stake.toFixed(2)} (${stakePct}%)`,
  ]
  if (data.stake_percentage_from_signal) {
    lines.push(`📌 Stake tipster: ${data.stake_percentage_from_signal}%`)
  }
  if (data.competition) lines.push(`🏆 ${data.competition}`)
  if (data.match_time)  lines.push(`🕐 ${data.match_time}`)
  if (data.picks_count && data.picks_count > 1) {
    lines.push(`📋 ${data.picks_count} apostas detectadas na imagem`)
  }
  if (data.confidence_score !== undefined && data.confidence_score < 90) {
    lines.push(`\n${confidenceLabel(data.confidence_score)}`)
  }
  return lines.join('\n')
}

// ── Load settings ─────────────────────────────────────────────────────────────

async function loadSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !data) throw new Error('Settings not found — configure bankroll in dashboard first')
  return data
}

// ── Process text signal ───────────────────────────────────────────────────────

async function processTextSignal(
  text: string,
  settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string },
  messageId: number,
  extra: { forwarded_from?: string | null; source_type?: string },
) {
  const parsed   = await parseSignalWithAI(text)
  const stakePct = parsed.stake_pct ?? settings.stake_percentage
  const stake    = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

  logger.info('TextSignal', [
    `conf=${parsed.confidence_score}%`,
    `status=${parsed.status}`,
    `market=${parsed.market ?? 'null'}`,
    `odd=${parsed.odd ?? 'null'}`,
    `teams="${parsed.home_team ?? '?'} x ${parsed.away_team ?? '?'}"`,
  ].join(' | '))

  const notes: string[] = []
  if (parsed.missing_fields.length > 0) notes.push(`Revisão: ${parsed.missing_fields.join(', ')}`)
  if (parsed.reasoning && parsed.confidence_score < 80) notes.push(`IA: ${parsed.reasoning}`)
  if (parsed.is_multiple)    notes.push('Múltipla')
  if (extra.forwarded_from)  notes.push(`Fwd: ${extra.forwarded_from}`)

  return {
    signal: {
      received_at:          new Date().toISOString(),
      home_team:            parsed.home_team,
      away_team:            parsed.away_team,
      market:               parsed.market,
      odd:                  parsed.odd,
      competition:          parsed.competition,
      bookmaker:            parsed.bookmaker ?? settings.preferred_bookmaker,
      match_time:           parsed.match_time,
      stake,
      status:               parsed.status,
      profit_loss:          null,
      raw_text:             text,
      source_type:          extra.source_type ?? 'text',
      forwarded_from:       extra.forwarded_from ?? null,
      telegram_message_id:  messageId,
      confidence_score:     parsed.confidence_score,
      notes:                notes.length > 0 ? notes.join(' | ') : null,
    },
    replyData: {
      home_team:                    parsed.home_team,
      away_team:                    parsed.away_team,
      market:                       parsed.market,
      odd:                          parsed.odd,
      competition:                  parsed.competition,
      match_time:                   parsed.match_time,
      status:                       parsed.status,
      stake_percentage_from_signal: parsed.stake_pct,
      is_multiple:                  parsed.is_multiple,
      confidence_score:             parsed.confidence_score,
      reasoning:                    parsed.reasoning,
    },
    stake,
    stakePct,
    source: 'text' as const,
  }
}

// ── Process image signal ──────────────────────────────────────────────────────

async function processImageSignal(
  imageBase64: string,
  mimeType: string,
  settings: { current_bankroll: number; stake_percentage: number; preferred_bookmaker: string },
  messageId: number,
  extra: {
    caption?:          string | null
    telegram_file_id?: string | null
    source_type?:      string
    forwarded_from?:   string | null
  },
) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — cannot process image signals')
  }

  const captionText = extra.caption ?? undefined
  const parsed      = await parseImageWithAI(imageBase64, mimeType, captionText)

  logger.info('ImageSignal', `AI raw (first 300 chars): ${parsed.raw_ai_json.slice(0, 300)}`)

  if (parsed.parse_error || parsed.picks.length === 0) {
    throw new Error(parsed.parse_error ?? 'Nenhuma aposta encontrada na imagem')
  }

  const isAccumulator = parsed.picks.length > 1
  const accType       = parsed.accumulator_type  // Dupla / Tripla / Múltipla / Simples
  const totalOdd      = parsed.accumulator_odd   // combined odd from the slip bottom

  // For accumulators: build legs from all picks; for singles: use first pick fields normally
  const pick   = parsed.picks[0]
  const fields = pickToSignalFields(pick)

  // Odd to use: total odd for accumulators, single pick odd otherwise
  const effectiveOdd = isAccumulator ? totalOdd : fields.odd

  // Stake % from signal: use the first pick's (tipster usually lists same % per leg)
  const stakePct = fields.stake_percentage_from_signal ?? settings.stake_percentage
  const stake    = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

  // Confidence: average across all picks
  const avgConf = Math.round(
    parsed.picks.reduce((sum, p) => sum + p.confidence_score, 0) / parsed.picks.length,
  )

  const missing: string[] = []
  if (!effectiveOdd)          missing.push('odd total')
  if (!fields.market && !isAccumulator) missing.push('mercado')

  const status: 'pending' | 'needs_review' =
    missing.length > 0 || avgConf < 80 ? 'needs_review' : 'pending'

  // Build legs for accumulator: one entry per pick
  const accLegs = isAccumulator
    ? parsed.picks.map((p) => ({
        market:    p.market_name ?? p.market_category ?? 'Mercado',
        selection: p.selection ?? p.match ?? '?',
        line:      p.line ?? null,
      }))
    : fields.legs

  // Market label
  const marketLabel = isAccumulator
    ? accType  // "Dupla" / "Tripla" / "Múltipla"
    : (fields.market ?? null)

  logger.info('ImageSignal', [
    `type=${accType}`,
    `conf=${avgConf}%`,
    `status=${status}`,
    `market=${marketLabel ?? 'null'}`,
    `odd=${effectiveOdd ?? 'null'}`,
    `picks=${parsed.picks.length}`,
    `stake_pct=${stakePct}%`,
  ].join(' | '))

  const notes: string[] = []
  if (missing.length > 0)    notes.push(`Revisão: ${missing.join(', ')}`)
  if (isAccumulator)         notes.push(`${accType}: ${parsed.picks.length} apostas`)
  if (fields.is_bet_builder) notes.push('Bet Builder')
  if (extra.forwarded_from)  notes.push(`Fwd: ${extra.forwarded_from}`)

  const rawText = captionText ? `[imagem] ${captionText}` : '[imagem]'

  return {
    signal: {
      received_at:                  new Date().toISOString(),
      home_team:                    isAccumulator ? null : fields.home_team,
      away_team:                    isAccumulator ? null : fields.away_team,
      market:                       marketLabel,
      market_category:              isAccumulator ? null : fields.market_category,
      selection:                    isAccumulator ? null : fields.selection,
      period:                       isAccumulator ? null : fields.period,
      line:                         isAccumulator ? null : fields.line,
      team:                         isAccumulator ? null : fields.team,
      player:                       isAccumulator ? null : fields.player,
      is_bet_builder:               !isAccumulator && fields.is_bet_builder,
      legs:                         accLegs.length > 0 ? accLegs : null,
      odd:                          effectiveOdd,
      competition:                  isAccumulator ? null : fields.competition,
      bookmaker:                    settings.preferred_bookmaker,
      match_time:                   null,
      stake,
      status,
      profit_loss:                  null,
      raw_text:                     rawText,
      caption_text:                 captionText ?? null,
      ai_raw_json:                  parsed.raw_ai_json,
      telegram_file_id:             extra.telegram_file_id ?? null,
      source_type:                  extra.source_type ?? 'image',
      forwarded_from:               extra.forwarded_from ?? null,
      stake_percentage_from_signal: fields.stake_percentage_from_signal,
      telegram_message_id:          messageId,
      confidence_score:             avgConf,
      notes:                        notes.length > 0 ? notes.join(' | ') : null,
    },
    replyData: {
      home_team:                    isAccumulator ? null : fields.home_team,
      away_team:                    isAccumulator ? null : fields.away_team,
      market:                       marketLabel,
      odd:                          effectiveOdd,
      competition:                  isAccumulator ? null : fields.competition,
      match_time:                   null,
      status,
      stake_percentage_from_signal: fields.stake_percentage_from_signal,
      is_multiple:                  isAccumulator,
      picks_count:                  parsed.picks.length,
      confidence_score:             avgConf,
      reasoning:                    isAccumulator
        ? `${accType} com ${parsed.picks.length} apostas — Odd total: ${effectiveOdd}`
        : missing.length > 0 ? `Campos ausentes: ${missing.join(', ')}` : undefined,
    },
    stake,
    stakePct,
    source: (extra.source_type ?? 'image') as ReplySource,
  }
}

// ── Resilient insert (falls back to baseline columns if migration not run) ────

const BASELINE_COLUMNS = new Set([
  'received_at', 'home_team', 'away_team', 'market', 'odd', 'competition',
  'bookmaker', 'match_time', 'stake', 'status', 'profit_loss', 'raw_text',
  'telegram_message_id', 'confidence_score', 'notes',
])

async function insertSignal(signal: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('signals').insert(signal)
  if (!error) return

  const isColumnError =
    error.message.includes('column') ||
    error.code === '42703' ||
    error.message.includes('does not exist')

  if (isColumnError) {
    logger.warning('Webhook', `Column error — retrying with baseline schema. ${error.message}`)
    const baseline: Record<string, unknown> = {}
    for (const key of BASELINE_COLUMNS) {
      if (key in signal) baseline[key] = signal[key]
    }
    const { error: fallbackError } = await supabase.from('signals').insert(baseline)
    if (fallbackError) throw new Error(`Baseline insert failed: ${fallbackError.message}`)
    logger.info('Webhook', 'Signal saved with baseline schema (run migrations to enable all fields)')
    return
  }

  throw new Error(error.message)
}

// ── Core update handler ───────────────────────────────────────────────────────

async function handleUpdate(update: TelegramUpdate): Promise<void> {
  logger.info('Webhook', `update_id=${update.update_id}`)

  const payload = await extractTelegramSignalPayload(update)

  logger.info('Webhook', [
    `source_type=${payload.source_type}`,
    `chat=${payload.chat_id}`,
    `fwd="${payload.forwarded_from ?? '-'}"`,
    `file_id=${payload.telegram_file_id ?? '-'}`,
    `bytes=${payload.image_bytes ?? '-'}`,
    `caption=${payload.caption ? `"${payload.caption.slice(0, 50)}"` : 'none'}`,
    `download_error=${payload.download_error ?? 'none'}`,
  ].join(' | '))

  if (payload.source_type === 'unknown') return

  const chatId = payload.chat_id

  if (payload.text?.startsWith('/')) return
  if (!payload.text && !payload.image_base64) {
    if (payload.download_error) {
      await sendMessage(chatId,
        `❌ Erro ao baixar imagem: ${payload.download_error}\n\nEnvie o sinal em texto também.`,
      )
    }
    return
  }

  const settings = await loadSettings().catch(async (err) => {
    await sendMessage(chatId, '❌ Configure a banca no dashboard primeiro.')
    throw err
  })

  let result: Awaited<ReturnType<typeof processTextSignal>> | Awaited<ReturnType<typeof processImageSignal>>

  if (payload.source_type === 'text') {
    const text = payload.text!
    if (text.length < 5) return
    await sendMessage(chatId, '🤖 Analisando sinal com IA...')
    result = await processTextSignal(text, settings, payload.message_id, {
      forwarded_from: payload.forwarded_from,
      source_type:    'text',
    })
  } else {
    await sendMessage(chatId, '🔍 Analisando imagem com IA...')
    try {
      result = await processImageSignal(
        payload.image_base64!,
        payload.mime_type ?? 'image/jpeg',
        settings,
        payload.message_id,
        {
          caption:          payload.caption,
          telegram_file_id: payload.telegram_file_id,
          source_type:      payload.source_type,
          forwarded_from:   payload.forwarded_from,
        },
      )
    } catch (imgErr) {
      logger.error('Webhook', 'Image processing failed', String(imgErr))
      await sendMessage(chatId,
        `❌ Erro ao ler imagem: ${String(imgErr)}\n\nEnvie o sinal em texto também.`,
      )
      return
    }
  }

  try {
    await insertSignal(result.signal as Record<string, unknown>)
  } catch (insertErr) {
    logger.error('Webhook', 'Insert failed', String(insertErr))
    await sendMessage(chatId, `❌ Erro ao salvar: ${String(insertErr)}`)
    return
  }

  logger.info('Webhook', [
    'Signal saved',
    `source=${result.source}`,
    `status=${result.signal.status}`,
    `conf=${(result.signal as { confidence_score?: number }).confidence_score ?? '?'}%`,
  ].join(' | '))

  await sendMessage(
    chatId,
    buildReply(result.replyData, result.stake, result.stakePct, result.source as ReplySource),
  )
}

// ── Webhook ───────────────────────────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (webhookSecret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token']
    if (incoming !== webhookSecret) {
      logger.warning('Webhook', `Invalid secret from ${req.ip}`)
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const update = req.body as TelegramUpdate

  try {
    // Process BEFORE responding — Vercel may kill async work after res.json()
    await Promise.race([
      handleUpdate(update),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout (25s)')), 25000),
      ),
    ])
  } catch (err) {
    logger.critical('Webhook', 'Update handler error', String(err))
  }

  // Always respond 200 so Telegram doesn't retry
  res.status(200).json({ ok: true })
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
