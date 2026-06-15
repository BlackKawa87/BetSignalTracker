import { Router, Request, Response, NextFunction } from 'express'
import { supabase } from '../utils/supabase'
import { parseSignalWithAI } from '../services/aiSignalParser'
import { parseImageWithAI } from '../services/imageSignalParser'
import { extractTelegramSignalPayload, TelegramUpdate } from '../utils/telegramPayload'
import { logger } from '../utils/logger'

const router = Router()

// ── Guard: dev or ALLOW_TEST_ENDPOINTS=true ───────────────────────────────────

function testGuard(_req: Request, res: Response, next: NextFunction): void {
  const isProd    = process.env.NODE_ENV === 'production'
  const isAllowed = process.env.ALLOW_TEST_ENDPOINTS === 'true'
  if (isProd && !isAllowed) {
    res.status(403).json({
      error: 'Test endpoints are disabled in production',
      hint:  'Set ALLOW_TEST_ENDPOINTS=true in Vercel env vars to enable',
    })
    return
  }
  next()
}

router.use(testGuard)

// ── Sample signals ────────────────────────────────────────────────────────────

const PRESET_SIGNALS: Record<string, string> = {
  btts:    'SINAL: Ambas Marcam SIM - Flamengo x Palmeiras - Odd 1.75',
  over25:  'Over 2.5 gols | PSG x Lyon | Odd 1.90 | Ligue 1',
  real:    'BTTS SIM | Real Madrid x Barcelona | odd 1.82 | La Liga',
  dupla:   'Dupla Hipótese 1X | Arsenal x Chelsea | Odd 1.55 | Premier League',
  result:  'Resultado Final - 1 | Bayern Munich x Dortmund | odd 1.65 | Bundesliga',
  under:   'Under 2.5 gols | Atletico Madrid x Sevilla | Odd 1.80',
}

// ── POST /test/telegram-raw ───────────────────────────────────────────────────
// Paste a real Telegram update JSON — see exactly what the system detects,
// downloads, and parses without saving anything to DB.

router.post('/telegram-raw', async (req: Request, res: Response) => {
  const start = Date.now()

  let update: TelegramUpdate
  try {
    update = (req.body?.update ?? req.body) as TelegramUpdate
    if (!update || typeof update.update_id !== 'number') {
      res.status(400).json({
        error: 'Body must be a valid Telegram update object with update_id',
        hint:  'Paste the raw JSON from the Telegram webhook directly',
      })
      return
    }
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }

  logger.info('TelegramRawDebug', `Received update_id=${update.update_id}`)

  // Step 1: extract payload (attempts image download if photo/doc present)
  const payload = await extractTelegramSignalPayload(update).catch((err) => ({
    source_type:      'unknown' as const,
    text:             null,
    caption:          null,
    image_base64:     null,
    mime_type:        null,
    telegram_file_id: null,
    image_bytes:      null,
    forwarded_from:   null,
    media_group_id:   null,
    chat_id:          0,
    message_id:       0,
    update_id:        update.update_id,
    detected: {
      has_text: false, has_caption: false,
      has_photo: false, has_document: false,
      is_forwarded: false, document_mime: null,
    },
    download_error: String(err),
  }))

  const out: Record<string, unknown> = {
    // Detection results
    source_type:      payload.source_type,
    detected:         payload.detected,
    // Message metadata
    chat_id:          payload.chat_id,
    message_id:       payload.message_id,
    update_id:        payload.update_id,
    forwarded_from:   payload.forwarded_from,
    media_group_id:   payload.media_group_id,
    // Content
    text:             payload.text,
    caption:          payload.caption,
    // Image download result
    telegram_file_id: payload.telegram_file_id,
    image_bytes:      payload.image_bytes,
    mime_type:        payload.mime_type,
    has_image:        !!payload.image_base64,
    download_error:   payload.download_error ?? null,
    // Parse result (filled below)
    parse_result:     null as unknown,
    parse_error:      null as unknown,
    elapsed_ms:       0,
  }

  // Step 2: parse content
  if (payload.source_type === 'text' && payload.text) {
    try {
      const parsed = await parseSignalWithAI(payload.text)
      out.parse_result = parsed
    } catch (err) {
      out.parse_error = String(err)
    }
  } else if (payload.image_base64 && payload.mime_type) {
    try {
      const parsed = await parseImageWithAI(
        payload.image_base64,
        payload.mime_type,
        payload.caption ?? undefined,
      )
      out.parse_result = {
        picks_count:         parsed.picks.length,
        picks:               parsed.picks,
        parse_error:         parsed.parse_error ?? null,
        raw_ai_json_preview: parsed.raw_ai_json.slice(0, 800),
        raw_ai_json_full:    parsed.raw_ai_json,
      }
    } catch (err) {
      out.parse_error = String(err)
    }
  } else {
    out.parse_error = 'Nothing to parse — no text and no downloadable image'
  }

  out.elapsed_ms = Date.now() - start
  res.json(out)
})

// ── POST /test/telegram-update ────────────────────────────────────────────────

router.post('/telegram-update', async (req: Request, res: Response) => {
  const { text, preset } = req.body as { text?: string; preset?: string }
  const signalText = text?.trim() || (preset && PRESET_SIGNALS[preset]) || PRESET_SIGNALS.btts

  const start = Date.now()
  logger.info('Test', `Simulating Telegram update: "${signalText.slice(0, 60)}"`)

  try {
    const { data: settings, error: settingsErr } = await supabase
      .from('settings')
      .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settingsErr || !settings) {
      res.status(500).json({ error: 'Settings not found — configure bankroll in dashboard first' })
      return
    }

    const parsed   = await parseSignalWithAI(signalText)
    const stakePct = parsed.stake_pct ?? settings.stake_percentage
    const stake    = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100

    const notes: string[] = ['[TEST]']
    if (parsed.missing_fields.length > 0) notes.push(`Revisão: ${parsed.missing_fields.join(', ')}`)
    if (parsed.reasoning && parsed.confidence_score < 80) notes.push(`IA: ${parsed.reasoning}`)

    const signal = {
      received_at:         new Date().toISOString(),
      home_team:           parsed.home_team,
      away_team:           parsed.away_team,
      market:              parsed.market,
      odd:                 parsed.odd,
      competition:         parsed.competition,
      bookmaker:           parsed.bookmaker ?? settings.preferred_bookmaker,
      match_time:          parsed.match_time,
      stake,
      status:              parsed.status,
      profit_loss:         null,
      raw_text:            signalText,
      source_type:         'text',
      telegram_message_id: null,
      confidence_score:    parsed.confidence_score,
      notes:               notes.join(' | '),
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('signals')
      .insert(signal)
      .select('id')
      .single()

    if (insertErr) {
      res.status(500).json({ error: insertErr.message })
      return
    }

    const elapsed = Date.now() - start
    logger.info('Test', `Done in ${elapsed}ms | signal_id=${inserted?.id}`)

    res.json({
      ok:         true,
      elapsed_ms: elapsed,
      signal_id:  inserted?.id,
      parsed: {
        home_team:        parsed.home_team,
        away_team:        parsed.away_team,
        market:           parsed.market,
        odd:              parsed.odd,
        competition:      parsed.competition,
        confidence_score: parsed.confidence_score,
        status:           parsed.status,
        missing_fields:   parsed.missing_fields,
        reasoning:        parsed.reasoning,
      },
      stake,
      stakePct,
    })
  } catch (err) {
    logger.error('Test', 'Telegram simulation failed', String(err))
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /test/full-flow ──────────────────────────────────────────────────────

router.post('/full-flow', async (req: Request, res: Response) => {
  const TEXT       = req.body?.text as string | undefined
  const signalText = TEXT?.trim() || PRESET_SIGNALS.btts

  const report: Array<{ step: string; ok: boolean; elapsed: number; detail?: string }> = []
  let signalId:         string | null = null
  let originalBankroll: number | null = null

  function step(name: string, ok: boolean, elapsed: number, detail?: string) {
    report.push({ step: name, ok, elapsed, detail })
    logger.info('Test', `[full-flow] ${ok ? '✅' : '❌'} ${name} (${elapsed}ms)${detail ? ` — ${detail}` : ''}`)
  }

  const overallStart = Date.now()

  try {
    let s0 = Date.now()
    const { data: settings, error: settErr } = await supabase
      .from('settings')
      .select('id, current_bankroll, stake_percentage, preferred_bookmaker')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (settErr || !settings) {
      step('Load settings', false, Date.now() - s0, settErr?.message ?? 'No settings')
      res.status(500).json({ ok: false, report })
      return
    }
    originalBankroll = settings.current_bankroll
    step('Load settings', true, Date.now() - s0, `bankroll=${settings.current_bankroll} stake=${settings.stake_percentage}%`)

    s0 = Date.now()
    let parsed
    try {
      parsed = await parseSignalWithAI(signalText)
      step('AI Parser', true, Date.now() - s0,
        `conf=${parsed.confidence_score}% "${parsed.home_team ?? '?'} x ${parsed.away_team ?? '?'}" | ${parsed.market ?? '?'} @ ${parsed.odd}`)
    } catch (e) {
      step('AI Parser', false, Date.now() - s0, String(e))
      res.status(500).json({ ok: false, report })
      return
    }

    s0 = Date.now()
    const stakePct = parsed.stake_pct ?? settings.stake_percentage
    const stake    = Math.round((settings.current_bankroll * stakePct) / 100 * 100) / 100
    const odd      = parsed.odd ?? 2.0
    step('Stake calculation', true, Date.now() - s0, `R$${stake} (${stakePct}% of R$${settings.current_bankroll})`)

    s0 = Date.now()
    const { data: inserted, error: insertErr } = await supabase
      .from('signals')
      .insert({
        received_at:         new Date().toISOString(),
        home_team:           parsed.home_team ?? 'Flamengo',
        away_team:           parsed.away_team ?? 'Palmeiras',
        market:              parsed.market    ?? 'Ambas Marcam - Sim',
        odd,
        competition:         parsed.competition,
        bookmaker:           parsed.bookmaker ?? settings.preferred_bookmaker,
        match_time:          parsed.match_time,
        stake,
        status:              'pending',
        profit_loss:         null,
        raw_text:            signalText,
        source_type:         'text',
        telegram_message_id: null,
        confidence_score:    parsed.confidence_score,
        notes:               '[TEST][FULL-FLOW]',
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      step('Insert signal', false, Date.now() - s0, insertErr?.message)
      res.status(500).json({ ok: false, report })
      return
    }
    signalId = inserted.id
    step('Insert signal', true, Date.now() - s0, `id=${signalId}`)

    s0 = Date.now()
    const profit      = Math.round(stake * (odd - 1) * 100) / 100
    const newBankroll = Math.round((settings.current_bankroll + profit) * 100) / 100
    const { error: greenErr } = await supabase
      .from('signals')
      .update({ status: 'green', profit_loss: profit, updated_at: new Date().toISOString() })
      .eq('id', signalId)
    step('Mark green', !greenErr, Date.now() - s0,
      greenErr?.message ?? `profit=+R$${profit} | new_bankroll=R$${newBankroll}`)

    s0 = Date.now()
    const { error: bkErr } = await supabase
      .from('settings')
      .update({ current_bankroll: newBankroll, updated_at: new Date().toISOString() })
      .eq('id', settings.id)
    step('Update bankroll', !bkErr, Date.now() - s0,
      bkErr?.message ?? `R$${settings.current_bankroll} → R$${newBankroll}`)

    s0 = Date.now()
    const { error: histErr } = await supabase
      .from('bankroll_history')
      .insert({
        bankroll:  newBankroll,
        change:    profit,
        reason:    `[TEST] Green: ${parsed.home_team ?? 'Flamengo'} x ${parsed.away_team ?? 'Palmeiras'} | odd ${odd.toFixed(2)}`,
        signal_id: signalId,
      })
    step('Bankroll history', !histErr, Date.now() - s0, histErr?.message)

    s0 = Date.now()
    const { data: verify } = await supabase
      .from('signals')
      .select('id, status, profit_loss, confidence_score')
      .eq('id', signalId)
      .single()
    const verifyOk = verify?.status === 'green' && verify.profit_loss === profit
    step('Verify DB records', verifyOk, Date.now() - s0,
      `status=${verify?.status} profit=${verify?.profit_loss} conf=${verify?.confidence_score}%`)

    s0 = Date.now()
    const [cleanSignal, cleanBankroll] = await Promise.all([
      supabase.from('signals').delete().eq('id', signalId),
      supabase.from('settings').update({
        current_bankroll: originalBankroll!,
        updated_at: new Date().toISOString(),
      }).eq('id', settings.id),
    ])
    const cleanOk = !cleanSignal.error && !cleanBankroll.error
    step('Cleanup', cleanOk, Date.now() - s0,
      cleanOk ? `Signal deleted, bankroll restored to R$${originalBankroll}` : 'Partial cleanup error')

    res.json({
      ok:               report.every((r) => r.ok),
      total_elapsed_ms: Date.now() - overallStart,
      steps_passed:     report.filter((r) => r.ok).length,
      steps_failed:     report.filter((r) => !r.ok).length,
      report,
    })
  } catch (err) {
    try {
      if (signalId) await supabase.from('signals').delete().eq('id', signalId)
      if (originalBankroll !== null) {
        const { data: s } = await supabase.from('settings').select('id').limit(1).single()
        if (s) await supabase.from('settings').update({ current_bankroll: originalBankroll }).eq('id', s.id)
      }
    } catch { /* best-effort */ }
    logger.error('Test', 'Full-flow crashed', String(err))
    res.status(500).json({ ok: false, error: String(err), report })
  }
})

// ── POST /test/parser ─────────────────────────────────────────────────────────

router.post('/parser', async (req: Request, res: Response) => {
  const { text, preset } = req.body as { text?: string; preset?: string }
  const signalText = text?.trim() || (preset && PRESET_SIGNALS[preset]) || PRESET_SIGNALS.btts
  const start = Date.now()
  try {
    const parsed = await parseSignalWithAI(signalText)
    res.json({ ok: true, elapsed_ms: Date.now() - start, input: signalText, parsed })
  } catch (err) {
    res.status(500).json({ ok: false, elapsed_ms: Date.now() - start, error: String(err) })
  }
})

// ── GET /test/presets ─────────────────────────────────────────────────────────

router.get('/presets', (_req: Request, res: Response) => {
  res.json(PRESET_SIGNALS)
})

// ── GET /test/supabase ────────────────────────────────────────────────────────

router.get('/supabase', async (_req: Request, res: Response) => {
  const start = Date.now()
  try {
    const [sigResult, settResult] = await Promise.all([
      supabase.from('signals').select('id', { count: 'exact', head: true }),
      supabase.from('settings').select('id').limit(1).single(),
    ])
    res.json({
      ok:              !sigResult.error && !settResult.error,
      elapsed_ms:      Date.now() - start,
      signals_count:   sigResult.count,
      settings_exists: !!settResult.data,
      errors: {
        signals:  sigResult.error?.message,
        settings: settResult.error?.message,
      },
    })
  } catch (err) {
    res.status(500).json({ ok: false, elapsed_ms: Date.now() - start, error: String(err) })
  }
})

export default router
export { PRESET_SIGNALS }
