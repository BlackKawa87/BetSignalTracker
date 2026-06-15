import { useState, useCallback, useRef } from 'react'
import {
  Play, CheckCircle, XCircle, Loader2, AlertCircle,
  FlaskConical, RefreshCw, ChevronDown, ChevronUp, Send,
  Bot, Shield, Zap, Database, Bug,
} from 'lucide-react'
import { Card } from '../components/ui/Card'

// ── Types ─────────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'running' | 'pass' | 'fail'

interface TestResult {
  status: TestStatus
  elapsed: number
  detail: string
  response?: unknown
}

interface TestDef {
  id: string
  name: string
  category: string
  run: () => Promise<{ ok: boolean; detail: string; response?: unknown }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiGet(path: string): Promise<Response> {
  return fetch(`/api${path}`)
}

async function apiPost(path: string, body?: unknown): Promise<Response> {
  return fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── Preset signals ────────────────────────────────────────────────────────────

const PRESETS: { key: string; label: string; text: string }[] = [
  { key: 'btts',   label: 'BTTS SIM',        text: 'SINAL: Ambas Marcam SIM - Flamengo x Palmeiras - Odd 1.75' },
  { key: 'over25', label: 'Over 2.5',         text: 'Over 2.5 gols | PSG x Lyon | Odd 1.90 | Ligue 1' },
  { key: 'dupla',  label: 'Dupla Hipótese 1X',text: 'Dupla Hipótese 1X | Arsenal x Chelsea | Odd 1.55 | Premier League' },
  { key: 'result', label: 'Resultado Final',  text: 'Resultado Final - 1 | Bayern Munich x Dortmund | odd 1.65 | Bundesliga' },
  { key: 'under',  label: 'Under 2.5',        text: 'Under 2.5 gols | Atletico Madrid x Sevilla | Odd 1.80' },
  { key: 'real',   label: 'BTTS Real Madrid', text: 'BTTS SIM | Real Madrid x Barcelona | odd 1.82 | La Liga' },
]

// ── Test definitions ──────────────────────────────────────────────────────────

function buildTests(
  telegramText: string,
): TestDef[] {
  return [
    // ── Infrastructure ──────────────────────────────────────
    {
      id: 'health',
      name: 'Health check',
      category: 'infra',
      run: async () => {
        const r    = await apiGet('/health')
        const data = await r.json() as { status?: string; latency_ms?: number; services?: Record<string, string> }
        const ok   = r.ok && data?.status === 'ok'
        return { ok, detail: ok ? `latency=${data.latency_ms}ms` : `status=${data.status}`, response: data }
      },
    },
    {
      id: 'supabase',
      name: 'Conectividade Supabase',
      category: 'infra',
      run: async () => {
        const r    = await apiGet('/test/supabase')
        const data = await r.json() as { ok?: boolean; signals_count?: number; settings_exists?: boolean }
        const ok   = r.ok && !!data?.ok
        return {
          ok,
          detail: ok ? `${data.signals_count} sinais · settings=${data.settings_exists}` : `HTTP ${r.status}`,
          response: data,
        }
      },
    },

    // ── AI Parser ───────────────────────────────────────────
    {
      id: 'parser_btts',
      name: 'Parser — BTTS SIM',
      category: 'parser',
      run: async () => {
        const r    = await apiPost('/test/parser', { preset: 'btts' })
        const data = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; home_team?: string; market?: string } }
        const ok   = r.ok && !!data?.ok
        return {
          ok,
          detail: ok ? `${data.parsed?.home_team} · conf=${data.parsed?.confidence_score}% · "${data.parsed?.market}"` : `HTTP ${r.status}`,
          response: data?.parsed,
        }
      },
    },
    {
      id: 'parser_over25',
      name: 'Parser — Over 2.5',
      category: 'parser',
      run: async () => {
        const r    = await apiPost('/test/parser', { preset: 'over25' })
        const data = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; odd?: number; market?: string } }
        const ok   = r.ok && !!data?.ok
        return {
          ok,
          detail: ok ? `odd=${data.parsed?.odd} · conf=${data.parsed?.confidence_score}% · "${data.parsed?.market}"` : `HTTP ${r.status}`,
          response: data?.parsed,
        }
      },
    },
    {
      id: 'parser_dupla',
      name: 'Parser — Dupla Hipótese 1X',
      category: 'parser',
      run: async () => {
        const r    = await apiPost('/test/parser', { preset: 'dupla' })
        const data = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; competition?: string; market?: string } }
        const ok   = r.ok && !!data?.ok
        return {
          ok,
          detail: ok ? `comp="${data.parsed?.competition}" · conf=${data.parsed?.confidence_score}%` : `HTTP ${r.status}`,
          response: data?.parsed,
        }
      },
    },
    {
      id: 'parser_threshold',
      name: 'Parser — limite needs_review (<80%)',
      category: 'parser',
      run: async () => {
        const vague = 'Sinal 1X Odd favorita ganhar'
        const r     = await apiPost('/test/parser', { text: vague })
        const data  = await r.json() as { ok?: boolean; parsed?: { confidence_score?: number; status?: string } }
        const ok    = r.ok && !!data?.ok
        const conf  = data?.parsed?.confidence_score ?? 100
        const status = data?.parsed?.status
        return {
          ok,
          detail: ok
            ? `conf=${conf}% · status=${status} ${conf < 80 ? '→ needs_review ✓' : '→ IA conseguiu extrair com alta confiança'}`
            : `HTTP ${r.status}`,
          response: data?.parsed,
        }
      },
    },

    // ── Signal pipeline ─────────────────────────────────────
    {
      id: 'stake_calc',
      name: 'Cálculo de stake',
      category: 'pipeline',
      run: async () => {
        const r    = await apiPost('/test/telegram-update', { preset: 'btts' })
        const data = await r.json() as { ok?: boolean; stake?: number; stakePct?: number; signal_id?: string }
        const ok   = r.ok && !!data?.ok && typeof data?.stake === 'number' && data.stake > 0
        return {
          ok,
          detail: ok ? `R$${data.stake} (${data.stakePct}%) · signal_id=${data.signal_id}` : `HTTP ${r.status}`,
          response: data,
        }
      },
    },
    {
      id: 'telegram_sim',
      name: 'Simulação Telegram (sinal personalizado)',
      category: 'pipeline',
      run: async () => {
        const text = telegramText || PRESETS[0].text
        const r    = await apiPost('/test/telegram-update', { text })
        const data = await r.json() as { ok?: boolean; signal_id?: string; parsed?: { confidence_score?: number; status?: string } }
        const ok   = r.ok && !!data?.ok
        return {
          ok,
          detail: ok ? `id=${data.signal_id} · conf=${data.parsed?.confidence_score}% · status=${data.parsed?.status}` : `HTTP ${r.status}`,
          response: data,
        }
      },
    },

    // ── Security ────────────────────────────────────────────
    {
      id: 'webhook_no_secret',
      name: 'Webhook — sem header de autenticação',
      category: 'security',
      run: async () => {
        const r = await fetch('/api/telegram/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ update_id: 99999 }),
        })
        const ok = r.status === 200 || r.status === 401
        return {
          ok,
          detail: r.status === 401 ? 'Webhook SEGURO — rejeitado sem secret (401) ✓'
                : r.status === 200 ? 'Webhook aberto (TELEGRAM_WEBHOOK_SECRET não configurado)'
                : `Status inesperado: ${r.status}`,
        }
      },
    },
    {
      id: 'webhook_wrong_secret',
      name: 'Webhook — secret incorreto (espera 401)',
      category: 'security',
      run: async () => {
        const r = await fetch('/api/telegram/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-telegram-bot-api-secret-token': 'wrong-token-test-12345',
          },
          body: JSON.stringify({ update_id: 99997 }),
        })
        const ok = r.status === 401 || r.status === 200
        return {
          ok,
          detail: r.status === 401 ? 'Secret errado corretamente rejeitado (401) ✓'
                : 'Webhook sem proteção (sem TELEGRAM_WEBHOOK_SECRET)',
        }
      },
    },
    {
      id: 'test_guard',
      name: 'Guard de endpoints de teste',
      category: 'security',
      run: async () => {
        const r    = await apiGet('/test/presets')
        const data = await r.json() as Record<string, string> | { error?: string }
        const ok   = r.ok && 'btts' in data
        return {
          ok,
          detail: ok
            ? `${Object.keys(data).length} presets acessíveis (dev/ALLOW_TEST_ENDPOINTS=true) ✓`
            : r.status === 403 ? 'Endpoints bloqueados em produção ✓'
            : `HTTP ${r.status}`,
          response: data,
        }
      },
    },

    // ── E2E ─────────────────────────────────────────────────
    {
      id: 'full_flow',
      name: 'Fluxo completo E2E (parse → DB → green → cleanup)',
      category: 'e2e',
      run: async () => {
        const r    = await apiPost('/test/full-flow', { text: 'BTTS SIM | Flamengo x Vasco | Odd 1.82 | Brasileirao' })
        const data = await r.json() as {
          ok?: boolean
          total_elapsed_ms?: number
          steps_passed?: number
          steps_failed?: number
          report?: Array<{ step: string; ok: boolean; elapsed: number; detail?: string }>
        }
        const ok     = r.ok && !!data?.ok
        const failed = data?.report?.filter((s) => !s.ok) ?? []
        return {
          ok,
          detail: ok
            ? `${data.steps_passed}/${(data.steps_passed ?? 0) + (data.steps_failed ?? 0)} etapas · ${data.total_elapsed_ms}ms`
            : `Falhou: ${failed.map((s) => s.step).join(', ')} (HTTP ${r.status})`,
          response: data?.report,
        }
      },
    },
  ]
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TestStatus }) {
  if (status === 'pass')    return <CheckCircle size={15} className="text-accent-green flex-shrink-0" />
  if (status === 'fail')    return <XCircle     size={15} className="text-accent-red flex-shrink-0" />
  if (status === 'running') return <Loader2     size={15} className="text-blue-400 animate-spin flex-shrink-0" />
  return <div className="w-[15px] h-[15px] rounded-full border border-dark-500 flex-shrink-0" />
}

// ── Test card ─────────────────────────────────────────────────────────────────

function TestCard({
  test,
  result,
  onRun,
}: {
  test: TestDef
  result?: TestResult
  onRun: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const status = result?.status ?? 'idle'

  const rowBg =
    status === 'pass' ? 'border-accent-green/10 bg-accent-green/2'
    : status === 'fail' ? 'border-accent-red/10 bg-accent-red/2'
    : 'border-dark-600 bg-transparent'

  return (
    <div className={`rounded-lg border ${rowBg} transition-colors`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <StatusIcon status={status} />
        <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">{test.name}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {result && result.elapsed > 0 && (
            <span className="text-[10px] font-mono text-gray-600">{result.elapsed}ms</span>
          )}
          {result?.detail && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          <button
            onClick={() => onRun(test.id)}
            disabled={status === 'running'}
            className="p-1 rounded text-gray-600 hover:text-accent-green hover:bg-accent-green/10 transition-colors disabled:opacity-40"
          >
            {status === 'running' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
          </button>
        </div>
      </div>

      {expanded && result && (
        <div className="px-3 pb-3 space-y-2 border-t border-dark-600/50 pt-2">
          {result.detail && (
            <p className="text-[11px] text-gray-500 font-mono">{result.detail}</p>
          )}
          {result.response !== undefined && (
            <pre className="text-[10px] font-mono text-gray-600 bg-dark-900 rounded p-2 overflow-x-auto max-h-40">
              {JSON.stringify(result.response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Category section ──────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; icon: React.ReactNode }> = {
  infra:    { label: 'Infraestrutura',    icon: <Database  size={13} /> },
  parser:   { label: 'Parser IA',         icon: <Zap       size={13} /> },
  pipeline: { label: 'Pipeline de Sinais',icon: <Bot       size={13} /> },
  security: { label: 'Segurança',         icon: <Shield    size={13} /> },
  e2e:      { label: 'Fluxo E2E',         icon: <FlaskConical size={13} /> },
}

// ── Telegram Raw Debug panel ──────────────────────────────────────────────────

const EXAMPLE_UPDATE = JSON.stringify({
  update_id: 123456789,
  message: {
    message_id: 42,
    from: { id: 111, username: 'tipster_vip' },
    chat: { id: 999, type: 'private' },
    date: 1718400000,
    photo: [
      { file_id: 'AgACAgIAAxk...', file_unique_id: 'abc', width: 320, height: 240, file_size: 12000 },
      { file_id: 'AgACAgIAAxk...LARGE', file_unique_id: 'xyz', width: 1280, height: 960, file_size: 98000 },
    ],
    caption: '1.5% ✅ Odd 1.67',
    forward_from_chat: { id: -1001234567890, type: 'channel', title: 'VIP Sinais' },
    forward_date: 1718399900,
  },
}, null, 2)

interface RawDebugResult {
  source_type: string
  detected: {
    has_text: boolean
    has_caption: boolean
    has_photo: boolean
    has_document: boolean
    is_forwarded: boolean
    document_mime: string | null
  }
  text: string | null
  caption: string | null
  telegram_file_id: string | null
  image_bytes: number | null
  mime_type: string | null
  has_image: boolean
  forwarded_from: string | null
  media_group_id: string | null
  download_error: string | null
  parse_error: string | null
  parse_result: {
    picks_count?: number
    picks?: unknown[]
    parse_error?: string | null
    raw_ai_json_preview?: string
  } | Record<string, unknown> | null
  elapsed_ms: number
}

function TelegramRawDebugPanel() {
  const [json,      setJson]      = useState(EXAMPLE_UPDATE)
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState<RawDebugResult | null>(null)
  const [parseErr,  setParseErr]  = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const run = useCallback(async () => {
    setJsonError(null)
    let body: unknown
    try {
      body = JSON.parse(json)
    } catch (e) {
      setJsonError(`JSON inválido: ${String(e)}`)
      return
    }
    setLoading(true)
    setResult(null)
    setParseErr(null)
    try {
      const r    = await fetch('/api/test/telegram-raw', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await r.json() as RawDebugResult
      setResult(data)
    } catch (err) {
      setParseErr(String(err))
    } finally {
      setLoading(false)
    }
  }, [json])

  const sourceColor = (t: string) =>
    t === 'image_with_caption' ? 'text-purple-400' :
    t === 'image'              ? 'text-blue-400'   :
    t === 'document_image'     ? 'text-cyan-400'   :
    t === 'text'               ? 'text-accent-green' :
    'text-gray-500'

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Bug size={14} className="text-orange-400" />
        <p className="text-sm font-semibold text-gray-300">Telegram Raw Debug</p>
        <span className="text-[10px] text-gray-600 font-mono ml-auto">POST /api/test/telegram-raw</span>
      </div>
      <p className="text-[11px] text-gray-500">
        Cole aqui o JSON bruto de um update do Telegram para ver exatamente o que o sistema lê,
        baixa e parseia — sem salvar no banco.
      </p>

      <textarea
        value={json}
        onChange={(e) => { setJson(e.target.value); setJsonError(null) }}
        rows={10}
        spellCheck={false}
        className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-y"
        placeholder='{"update_id": 123, "message": {...}}'
      />

      {jsonError && (
        <p className="text-[11px] text-accent-red font-mono">{jsonError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={loading || !json.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Bug size={14} />}
          Analisar Update
        </button>
        <button
          onClick={() => setJson(EXAMPLE_UPDATE)}
          className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          Carregar exemplo
        </button>
      </div>

      {parseErr && (
        <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
          <p className="text-xs text-accent-red font-mono">{parseErr}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3 text-[11px] font-mono">
          {/* Source type */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-900 border border-dark-600">
            <span className="text-gray-500">source_type</span>
            <span className={`font-semibold ${sourceColor(result.source_type)}`}>
              {result.source_type}
            </span>
            <span className="ml-auto text-gray-600">{result.elapsed_ms}ms</span>
          </div>

          {/* Detection grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {Object.entries(result.detected).map(([k, v]) => (
              <div key={k} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border ${
                v === true  ? 'border-accent-green/30 bg-accent-green/5 text-accent-green' :
                v === false ? 'border-dark-600 text-gray-600' :
                'border-dark-600 text-gray-500'
              }`}>
                {v === true  ? <CheckCircle size={10} /> :
                 v === false ? <XCircle     size={10} /> :
                 <span className="w-[10px]" />}
                <span>{k.replace(/_/g, ' ')}</span>
                {v !== true && v !== false && v != null && (
                  <span className="text-gray-400 ml-auto">{String(v)}</span>
                )}
              </div>
            ))}
          </div>

          {/* Fields */}
          <div className="space-y-1">
            {([
              ['forwarded_from',   result.forwarded_from],
              ['caption',          result.caption],
              ['text',             result.text],
              ['telegram_file_id', result.telegram_file_id],
              ['image_bytes',      result.image_bytes != null ? `${result.image_bytes.toLocaleString()} bytes` : null],
              ['mime_type',        result.mime_type],
              ['media_group_id',   result.media_group_id],
              ['download_error',   result.download_error],
            ] as [string, string | number | null][]).filter(([, v]) => v != null).map(([k, v]) => (
              <div key={k} className="flex gap-2 px-2 py-1 rounded bg-dark-900">
                <span className="text-gray-600 min-w-[130px]">{k}</span>
                <span className={k === 'download_error' ? 'text-accent-red' : 'text-gray-300'}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>

          {/* Parse result */}
          {result.parse_error && (
            <div className="p-2 rounded bg-accent-red/10 border border-accent-red/20">
              <span className="text-accent-red">parse_error: {result.parse_error}</span>
            </div>
          )}

          {result.parse_result && (
            <div className="space-y-2">
              {'picks_count' in result.parse_result && (
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-accent-green/5 border border-accent-green/20">
                  <CheckCircle size={11} className="text-accent-green" />
                  <span className="text-accent-green">
                    {(result.parse_result as { picks_count: number }).picks_count} aposta(s) extraída(s)
                  </span>
                </div>
              )}
              <details className="group">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-400 select-none">
                  Resultado completo ▶
                </summary>
                <pre className="mt-1 text-[10px] text-gray-500 bg-dark-900 rounded p-2 overflow-x-auto max-h-80">
                  {JSON.stringify(result.parse_result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TestLabPage() {
  const [telegramText, setTelegramText] = useState(PRESETS[0].text)
  const [results,      setResults]      = useState<Record<string, TestResult>>({})
  const [running,      setRunning]      = useState(false)
  const [simResult,    setSimResult]    = useState<unknown>(null)
  const [simRunning,   setSimRunning]   = useState(false)
  const runningRef = useRef(false)

  const tests = buildTests(telegramText)

  const setResult = useCallback((id: string, r: TestResult) => {
    setResults((prev) => ({ ...prev, [id]: r }))
  }, [])

  const runTest = useCallback(async (id: string) => {
    const test = tests.find((t) => t.id === id)
    if (!test) return
    const start = Date.now()
    setResult(id, { status: 'running', elapsed: 0, detail: '' })
    try {
      const { ok, detail, response } = await test.run()
      setResult(id, { status: ok ? 'pass' : 'fail', elapsed: Date.now() - start, detail, response })
    } catch (err) {
      setResult(id, { status: 'fail', elapsed: Date.now() - start, detail: String(err) })
    }
  }, [tests, setResult])

  const runAll = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)
    // Mark all running
    const fresh: Record<string, TestResult> = {}
    tests.forEach((t) => { fresh[t.id] = { status: 'idle', elapsed: 0, detail: '' } })
    setResults(fresh)

    for (const test of tests) {
      const start = Date.now()
      setResult(test.id, { status: 'running', elapsed: 0, detail: '' })
      try {
        const { ok, detail, response } = await test.run()
        setResult(test.id, { status: ok ? 'pass' : 'fail', elapsed: Date.now() - start, detail, response })
      } catch (err) {
        setResult(test.id, { status: 'fail', elapsed: Date.now() - start, detail: String(err) })
      }
    }
    runningRef.current = false
    setRunning(false)
  }, [tests, setResult])

  const simulateTelegram = useCallback(async () => {
    setSimRunning(true)
    setSimResult(null)
    try {
      const r    = await apiPost('/test/telegram-update', { text: telegramText })
      const data = await r.json() as unknown
      setSimResult(data)
    } catch (err) {
      setSimResult({ error: String(err) })
    }
    setSimRunning(false)
  }, [telegramText])

  // ── Aggregate stats ─────────────────────────────────────────────────────────
  const all    = Object.values(results)
  const passed = all.filter((r) => r.status === 'pass').length
  const failed = all.filter((r) => r.status === 'fail').length
  const ran    = all.filter((r) => r.status !== 'idle').length
  const avgMs  = ran > 0
    ? Math.round(all.filter((r) => r.elapsed > 0).reduce((s, r) => s + r.elapsed, 0) / ran)
    : 0

  // ── Group tests by category ─────────────────────────────────────────────────
  const categories = ['infra', 'parser', 'pipeline', 'security', 'e2e']

  const simData = simResult as null | {
    ok?: boolean
    signal_id?: string
    stake?: number
    parsed?: { confidence_score?: number; status?: string; market?: string }
    error?: string
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical size={22} className="text-blue-400" /> Test Lab
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Suite de testes automatizados — valida o fluxo ponta a ponta
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ran > 0 && (
            <span className="text-[11px] font-mono text-gray-500">
              {passed}/{ran} · avg {avgMs}ms
            </span>
          )}
          <button
            onClick={runAll}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Executar Todos
          </button>
          {ran > 0 && (
            <button
              onClick={() => setResults({})}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {ran > 0 && (
        <div className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${
          failed === 0
            ? 'border-accent-green/30 bg-accent-green/5'
            : 'border-accent-red/30 bg-accent-red/5'
        }`}>
          <div className="flex items-center gap-2">
            {failed === 0 ? (
              <CheckCircle size={16} className="text-accent-green" />
            ) : (
              <XCircle size={16} className="text-accent-red" />
            )}
            <span className={`text-sm font-semibold ${failed === 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {failed === 0 ? 'Todos os testes passaram' : `${failed} teste${failed > 1 ? 's' : ''} falharam`}
            </span>
          </div>
          <div className="flex gap-4 ml-auto text-xs font-mono text-gray-500">
            <span className="text-accent-green">{passed} pass</span>
            {failed > 0 && <span className="text-accent-red">{failed} fail</span>}
            <span>{ran}/{tests.length} executados</span>
          </div>
        </div>
      )}

      {/* Telegram simulation panel */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bot size={14} className="text-blue-400" />
          <p className="text-sm font-semibold text-gray-300">Simular Sinal Telegram</p>
          <span className="text-[10px] text-gray-600 font-mono ml-auto">POST /api/test/telegram-update</span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setTelegramText(p.text)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                telegramText === p.text
                  ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                  : 'bg-dark-700 border border-dark-500 text-gray-500 hover:text-gray-300 hover:border-dark-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <textarea
          value={telegramText}
          onChange={(e) => setTelegramText(e.target.value)}
          rows={2}
          className="w-full bg-dark-900 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
          placeholder="Digite ou cole o texto do sinal..."
        />

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={simulateTelegram}
            disabled={simRunning || !telegramText.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            {simRunning ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Enviar Sinal
          </button>

          {simData && (
            <div className={`flex items-center gap-2 text-sm ${simData.ok ? 'text-accent-green' : 'text-accent-red'}`}>
              {simData.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {simData.ok
                ? `Sinal criado · id=${simData.signal_id} · R$${simData.stake} · conf=${simData.parsed?.confidence_score}% · ${simData.parsed?.status}`
                : simData.error ?? 'Erro ao processar sinal'}
            </div>
          )}
        </div>

        {simData?.ok && (
          <div className="mt-2 p-2 bg-dark-900 rounded text-[10px] font-mono text-gray-600">
            market="{simData.parsed?.market}" · {simData.parsed?.status === 'needs_review' && (
              <span className="text-orange-400">⚠ needs_review — verifique na página de Revisão</span>
            )}
            {simData.parsed?.status === 'pending' && (
              <span className="text-yellow-400">pendente — aparece no Dashboard</span>
            )}
          </div>
        )}
      </Card>

      {/* Test categories */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const catTests = tests.filter((t) => t.category === cat)
          const meta     = CAT_META[cat]
          const catPass  = catTests.filter((t) => results[t.id]?.status === 'pass').length
          const catFail  = catTests.filter((t) => results[t.id]?.status === 'fail').length
          const catRan   = catTests.filter((t) => (results[t.id]?.status ?? 'idle') !== 'idle').length

          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-600">{meta.icon}</span>
                <h2 className="text-[11px] text-gray-600 font-mono uppercase tracking-wider">{meta.label}</h2>
                {catRan > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    {catFail > 0 && (
                      <span className="text-[10px] font-mono text-accent-red">{catFail} fail</span>
                    )}
                    {catPass > 0 && (
                      <span className="text-[10px] font-mono text-accent-green">{catPass} pass</span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                {catTests.map((test) => (
                  <TestCard
                    key={test.id}
                    test={test}
                    result={results[test.id]}
                    onRun={runTest}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Telegram Raw Debug */}
      <TelegramRawDebugPanel />

      {/* Info footer */}
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle size={14} className="text-gray-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-[11px] text-gray-600 font-mono">
            <p>Os endpoints de teste (<code>/api/test/*</code>) só funcionam em desenvolvimento ou quando <code>ALLOW_TEST_ENDPOINTS=true</code>.</p>
            <p>Sinais criados pelo "Simular Telegram" ficam no Dashboard marcados como <code>[TEST]</code> e podem ser apagados manualmente.</p>
            <p>O "Fluxo E2E" cria e apaga o sinal automaticamente — sua banca não é alterada ao final.</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
