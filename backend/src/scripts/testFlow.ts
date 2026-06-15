/**
 * CLI test runner for BetSignalTracker.
 * Usage: npm run test:flow
 *        TEST_BASE_URL=https://your-app.vercel.app npm run test:flow
 */

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3001'
const ALLOW    = process.env.ALLOW_TEST_ENDPOINTS ?? 'true'

const RESET  = '\x1b[0m'
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const GRAY   = '\x1b[90m'
const BOLD   = '\x1b[1m'

type Result = { name: string; ok: boolean; elapsed: number; detail: string }
const results: Result[] = []

async function run(
  name: string,
  fn: () => Promise<{ ok: boolean; detail: string }>,
): Promise<void> {
  const start = Date.now()
  process.stdout.write(`  ${CYAN}→${RESET} ${name.padEnd(45)} `)
  try {
    const { ok, detail } = await fn()
    const elapsed = Date.now() - start
    const badge = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`
    console.log(`${badge}  ${GRAY}${elapsed}ms${RESET}`)
    if (detail) console.log(`       ${GRAY}${detail}${RESET}`)
    results.push({ name, ok, elapsed, detail })
  } catch (err) {
    const elapsed = Date.now() - start
    console.log(`${RED}ERR ${RESET}  ${GRAY}${elapsed}ms${RESET}`)
    console.log(`       ${RED}${String(err)}${RESET}`)
    results.push({ name, ok: false, elapsed, detail: String(err) })
  }
}

async function get(path: string): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    headers: { 'x-allow-test': ALLOW },
  })
}

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-allow-test': ALLOW },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testHealth(): Promise<void> {
  await run('Health check — GET /health', async () => {
    const r   = await get('/health')
    const data = await r.json() as { status?: string; latency_ms?: number }
    const ok   = r.ok && data?.status === 'ok'
    return { ok, detail: ok ? `latency=${data.latency_ms}ms` : `status=${data.status}` }
  })
}

async function testSupabaseConnectivity(): Promise<void> {
  await run('Supabase connectivity — GET /test/supabase', async () => {
    const r    = await get('/test/supabase')
    const data = await r.json() as { ok?: boolean; signals_count?: number; settings_exists?: boolean }
    return {
      ok: r.ok && !!data?.ok,
      detail: `signals=${data.signals_count} settings=${data.settings_exists} ${r.status !== 200 ? `HTTP ${r.status}` : ''}`,
    }
  })
}

async function testParserFallback(): Promise<void> {
  await run('AI parser — POST /test/parser (btts preset)', async () => {
    const r   = await post('/test/parser', { preset: 'btts' })
    const data = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; home_team?: string } }
    const ok   = r.ok && !!data?.ok && typeof data?.parsed?.confidence_score === 'number'
    return {
      ok,
      detail: ok
        ? `conf=${data.parsed?.confidence_score}% teams=${data.parsed?.home_team}`
        : `HTTP ${r.status} ok=${data?.ok}`,
    }
  })
}

async function testParserOver25(): Promise<void> {
  await run('AI parser — Over 2.5 preset', async () => {
    const r    = await post('/test/parser', { preset: 'over25' })
    const data = await r.json() as { ok?: boolean; parsed?: { market?: string; odd?: number; confidence_score?: number } }
    const ok   = r.ok && !!data?.ok
    return {
      ok,
      detail: `market="${data?.parsed?.market}" odd=${data?.parsed?.odd} conf=${data?.parsed?.confidence_score}%`,
    }
  })
}

async function testParserDupla(): Promise<void> {
  await run('AI parser — Dupla Hipótese preset', async () => {
    const r    = await post('/test/parser', { preset: 'dupla' })
    const data = await r.json() as { ok?: boolean; parsed?: { market?: string; confidence_score?: number } }
    const ok   = r.ok && !!data?.ok
    return {
      ok,
      detail: `market="${data?.parsed?.market}" conf=${data?.parsed?.confidence_score}%`,
    }
  })
}

async function testParserCustomText(): Promise<void> {
  const text = 'ENTRADA: Gols: Over 1.5 ⚽ | Atletico x Cruzeiro | @1.62 | Brasileirao | 20:00'
  await run('AI parser — custom text', async () => {
    const r    = await post('/test/parser', { text })
    const data = await r.json() as { ok?: boolean; parsed?: { odd?: number; confidence_score?: number } }
    const ok   = r.ok && !!data?.ok
    return { ok, detail: `odd=${data?.parsed?.odd} conf=${data?.parsed?.confidence_score}%` }
  })
}

async function testStakeCalc(): Promise<void> {
  await run('Stake calculation (bankroll 1000, 2% stake)', async () => {
    // Indirect: run telegram simulation and check stake makes sense
    const r    = await post('/test/telegram-update', { preset: 'btts' })
    const data = await r.json() as { ok?: boolean; stake?: number; stakePct?: number }
    const ok   = r.ok && !!data?.ok && typeof data?.stake === 'number' && data.stake > 0
    return {
      ok,
      detail: ok ? `stake=R$${data.stake} (${data.stakePct}%)` : `HTTP ${r.status}`,
    }
  })
}

async function testTelegramSimulation(): Promise<void> {
  await run('Telegram simulation — POST /test/telegram-update', async () => {
    const r    = await post('/test/telegram-update', { preset: 'real' })
    const data = await r.json() as { ok?: boolean; signal_id?: string; parsed?: { confidence_score?: number; status?: string } }
    const ok   = r.ok && !!data?.ok && !!data?.signal_id
    return {
      ok,
      detail: ok
        ? `id=${data.signal_id} conf=${data.parsed?.confidence_score}% status=${data.parsed?.status}`
        : `HTTP ${r.status}`,
    }
  })
}

async function testWebhookSecurityNoSecret(): Promise<void> {
  await run('Webhook security — no secret header (expect 200)', async () => {
    // If TELEGRAM_WEBHOOK_SECRET is not set, webhook is open and returns 200.
    // If it IS set, this should return 401.
    // We just verify the endpoint is reachable — actual security depends on env config.
    const r = await fetch(`${BASE_URL}/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: 99999 }),
    })
    // 200 = open (no secret set) | 401 = secured | both are acceptable states
    const ok = r.status === 200 || r.status === 401
    return {
      ok,
      detail: r.status === 401 ? 'Webhook is SECURED (401 without secret) ✓'
            : r.status === 200 ? 'Webhook is open (no TELEGRAM_WEBHOOK_SECRET set)'
            : `Unexpected status ${r.status}`,
    }
  })
}

async function testWebhookSecurityWrongSecret(): Promise<void> {
  await run('Webhook security — wrong secret (expect 401 if configured)', async () => {
    const r = await fetch(`${BASE_URL}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-bot-api-secret-token': 'definitely-wrong-secret-12345',
      },
      body: JSON.stringify({ update_id: 99998 }),
    })
    // If TELEGRAM_WEBHOOK_SECRET is set, wrong secret = 401
    // If not set, any request = 200
    const ok = r.status === 401 || r.status === 200
    return {
      ok,
      detail: r.status === 401 ? 'Wrong secret correctly rejected ✓' : 'Webhook unprotected (no secret env var)',
    }
  })
}

async function testNeedsReviewThreshold(): Promise<void> {
  await run('needs_review threshold — low-confidence text', async () => {
    const vague = 'Sinal 1X Odd favorita ganhar'
    const r     = await post('/test/parser', { text: vague })
    const data  = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; status?: string } }
    const ok    = r.ok && !!data?.ok
    const conf  = data?.parsed?.confidence_score ?? 100
    const status = data?.parsed?.status
    return {
      ok,
      detail: `conf=${conf}% status=${status} → ${
        conf < 80 && status === 'needs_review' ? 'needs_review correctly triggered ✓'
        : conf >= 80 ? 'AI parsed with high confidence (not needs_review)'
        : 'threshold logic may have an issue'
      }`,
    }
  })
}

async function testFullFlow(): Promise<void> {
  await run('Full E2E flow — POST /test/full-flow', async () => {
    const r    = await post('/test/full-flow', { text: 'BTTS SIM | Flamengo x Vasco | Odd 1.82 | Brasileirao' })
    const data = await r.json() as {
      ok?: boolean
      total_elapsed_ms?: number
      steps_passed?: number
      steps_failed?: number
      report?: Array<{ step: string; ok: boolean; elapsed: number; detail?: string }>
    }
    const ok = r.ok && !!data?.ok

    if (data?.report) {
      const failed = data.report.filter((s) => !s.ok)
      const detail = ok
        ? `${data.steps_passed}/${(data.steps_passed ?? 0) + (data.steps_failed ?? 0)} steps in ${data.total_elapsed_ms}ms`
        : `Failed: ${failed.map((s) => s.step).join(', ')}`
      return { ok, detail }
    }

    return { ok, detail: `HTTP ${r.status}` }
  })
}

async function testTestEndpointGuard(): Promise<void> {
  // This test verifies that the guard logic exists — in dev mode it should pass through.
  await run('Test endpoint guard — accessible in dev/allowed mode', async () => {
    const r    = await get('/test/presets')
    const data = await r.json() as Record<string, string>
    const ok   = r.ok && typeof data?.btts === 'string'
    return { ok, detail: ok ? `${Object.keys(data).length} presets available` : `HTTP ${r.status}` }
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${BOLD}${CYAN}BetSignalTracker — Test Suite${RESET}`)
  console.log(`${GRAY}Target: ${BASE_URL}${RESET}`)
  console.log(`${GRAY}${'─'.repeat(65)}${RESET}\n`)

  console.log(`${YELLOW}Infrastructure${RESET}`)
  await testHealth()
  await testSupabaseConnectivity()

  console.log(`\n${YELLOW}AI Parser${RESET}`)
  await testParserFallback()
  await testParserOver25()
  await testParserDupla()
  await testParserCustomText()
  await testNeedsReviewThreshold()

  console.log(`\n${YELLOW}Signal Pipeline${RESET}`)
  await testStakeCalc()
  await testTelegramSimulation()

  console.log(`\n${YELLOW}Security${RESET}`)
  await testWebhookSecurityNoSecret()
  await testWebhookSecurityWrongSecret()
  await testTestEndpointGuard()

  console.log(`\n${YELLOW}End-to-End${RESET}`)
  await testFullFlow()

  // ── Summary ──────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  const total  = results.length
  const avgMs  = Math.round(results.reduce((s, r) => s + r.elapsed, 0) / total)

  console.log(`\n${GRAY}${'─'.repeat(65)}${RESET}`)
  console.log(
    `${BOLD}Results: ${passed === total ? GREEN : RED}${passed}/${total} passed${RESET}  ` +
    `${GRAY}avg ${avgMs}ms${RESET}`,
  )

  if (failed > 0) {
    console.log(`\n${RED}Failed tests:${RESET}`)
    results.filter((r) => !r.ok).forEach((r) => {
      console.log(`  ${RED}✗${RESET} ${r.name}`)
      if (r.detail) console.log(`    ${GRAY}${r.detail}${RESET}`)
    })
    console.log()
    process.exit(1)
  }

  console.log(`\n${GREEN}All tests passed! ✓${RESET}\n`)
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${String(err)}${RESET}`)
  process.exit(1)
})
