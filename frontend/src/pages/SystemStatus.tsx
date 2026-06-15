import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle, XCircle, AlertCircle,
  Server, Bot, Brain, Wifi, Clock, Activity,
} from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { formatDate } from '../utils/helpers'

// ── Health API response ───────────────────────────────────────

interface HealthResponse {
  status: 'ok' | 'degraded'
  timestamp: string
  latency_ms: number
  services: {
    supabase:      'ok' | 'error'
    supabaseError?: string
    telegram:      'configured' | 'not_configured'
    openai:        'configured' | 'not_configured'
    sportsApi:     'configured' | 'not_configured'
  }
  security: {
    webhookSecret: boolean
    cronSecret:    boolean
  }
  env: Record<string, boolean>
}

// ── Status indicator ──────────────────────────────────────────

type IndicatorState = 'ok' | 'warning' | 'error' | 'loading'

function Indicator({ state, label, sub }: { state: IndicatorState; label: string; sub?: string }) {
  const cfg = {
    ok:      { icon: <CheckCircle size={16} className="text-accent-green" />,  border: 'border-accent-green/20',  bg: 'bg-accent-green/5' },
    warning: { icon: <AlertCircle  size={16} className="text-yellow-400" />,   border: 'border-yellow-400/20',    bg: 'bg-yellow-400/5' },
    error:   { icon: <XCircle      size={16} className="text-accent-red" />,   border: 'border-accent-red/20',    bg: 'bg-accent-red/5' },
    loading: { icon: <RefreshCw    size={16} className="text-gray-500 animate-spin" />, border: 'border-dark-500', bg: 'bg-dark-700/30' },
  }[state]

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
      <div className="flex-shrink-0">{cfg.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {sub && <p className="text-[10px] text-gray-600 font-mono truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Recent processing logs ────────────────────────────────────

interface LogRow {
  id: string
  created_at: string
  action: string
  result: string | null
  details: Record<string, unknown>
}

// ── Page ──────────────────────────────────────────────────────

export function SystemStatusPage() {
  const { signals, stats } = useApp()
  const [health,   setHealth]   = useState<HealthResponse | null>(null)
  const [logs,     setLogs]     = useState<LogRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const lastSignal = signals.length > 0 ? signals[0] : null

  const load = useCallback(async () => {
    setLoading(true)
    const [healthRes, logsRes] = await Promise.all([
      fetch('/api/health').then((r) => r.json()).catch(() => null) as Promise<HealthResponse | null>,
      supabase
        .from('processing_logs')
        .select('id, created_at, action, result, details')
        .order('created_at', { ascending: false })
        .limit(8),
    ])
    if (healthRes) setHealth(healthRes)
    if (!logsRes.error && logsRes.data) setLogs(logsRes.data as LogRow[])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const lastLog   = logs[0]
  const lastError = logs.find((l) => l.action === 'error')

  // Derive states
  const backendState: IndicatorState = !health ? 'loading' : health.status === 'ok' ? 'ok' : 'error'
  const supabaseState: IndicatorState = !health ? 'loading' : health.services.supabase === 'ok' ? 'ok' : 'error'
  const telegramState: IndicatorState = !health ? 'loading'
    : health.services.telegram === 'configured' ? 'ok' : 'warning'
  const openaiState: IndicatorState   = !health ? 'loading'
    : health.services.openai === 'configured' ? 'ok' : 'warning'
  const sportsState: IndicatorState   = !health ? 'loading'
    : health.services.sportsApi === 'configured' ? 'ok' : 'warning'
  const secretState: IndicatorState   = !health ? 'loading'
    : health.security.webhookSecret ? 'ok' : 'warning'

  const overallOk = health?.status === 'ok'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Status do Sistema</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Visão geral da saúde de todos os serviços
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-gray-600 font-mono">
              Atualizado {lastRefresh.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overall status banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${
        !health ? 'border-dark-500 bg-dark-700/30'
        : overallOk
          ? 'border-accent-green/30 bg-accent-green/5'
          : 'border-accent-red/30 bg-accent-red/5'
      }`}>
        {!health ? (
          <RefreshCw size={18} className="text-gray-500 animate-spin flex-shrink-0" />
        ) : overallOk ? (
          <CheckCircle size={18} className="text-accent-green flex-shrink-0" />
        ) : (
          <XCircle size={18} className="text-accent-red flex-shrink-0" />
        )}
        <div>
          <p className={`font-semibold ${!health ? 'text-gray-500' : overallOk ? 'text-accent-green' : 'text-accent-red'}`}>
            {!health ? 'Verificando...' : overallOk ? 'Todos os sistemas operacionais' : 'Degradado — verifique os serviços abaixo'}
          </p>
          {health && (
            <p className="text-xs text-gray-500 mt-0.5">
              Latência da API: {health.latency_ms}ms · {health.timestamp.slice(0, 19).replace('T', ' ')} UTC
            </p>
          )}
        </div>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Server size={10} /> Infraestrutura
          </p>
          <Indicator state={backendState}   label="Backend (Express/Vercel)" sub={health ? `status: ${health.status}` : undefined} />
          <Indicator state={supabaseState}  label="Supabase (PostgreSQL)"    sub={health?.services.supabaseError ?? (supabaseState === 'ok' ? 'Conectado' : undefined)} />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Wifi size={10} /> Integrações
          </p>
          <Indicator state={telegramState} label="Telegram Bot"       sub={health?.services.telegram} />
          <Indicator state={openaiState}   label="OpenAI (AI Parser)" sub={health?.services.openai} />
          <Indicator state={sportsState}   label="Sports API"         sub={health?.services.sportsApi} />
          <Indicator state={secretState}   label="Webhook Secret"     sub={health?.security.webhookSecret ? 'Ativado ✓' : 'Não configurado (aberto)'} />
        </div>
      </div>

      {/* Signal stats */}
      <Card className="p-4">
        <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Activity size={10} /> Estatísticas de Sinais
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
          {[
            { label: 'Total',    value: stats?.totalSignals ?? 0, color: 'text-white' },
            { label: 'Greens',   value: stats?.greens ?? 0,       color: 'text-accent-green' },
            { label: 'Reds',     value: stats?.reds ?? 0,         color: 'text-accent-red' },
            { label: 'Pendentes',value: stats?.pending ?? 0,      color: 'text-yellow-400' },
            { label: 'Revisão',  value: stats?.needsReview ?? 0,  color: 'text-orange-400' },
            { label: 'ROI',      value: `${(stats?.roi ?? 0).toFixed(1)}%`, color: (stats?.roi ?? 0) >= 0 ? 'text-accent-green' : 'text-accent-red' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-[9px] text-gray-600 font-mono uppercase">{s.label}</p>
              <p className={`text-lg font-bold font-mono mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Last signal */}
      {lastSignal && (
        <Card className="p-4">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Bot size={10} /> Último Sinal Recebido
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-gray-200">
                {lastSignal.home_team && lastSignal.away_team
                  ? `${lastSignal.home_team} x ${lastSignal.away_team}`
                  : 'Jogo não identificado'}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {lastSignal.market ?? '—'} · odd {lastSignal.odd?.toFixed(2) ?? '—'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-sm font-bold font-mono ${
                lastSignal.status === 'green' ? 'text-accent-green'
                : lastSignal.status === 'red' ? 'text-accent-red'
                : lastSignal.status === 'needs_review' ? 'text-orange-400'
                : 'text-yellow-400'
              }`}>
                {lastSignal.status.toUpperCase()}
              </p>
              <p className="text-[10px] text-gray-600 font-mono mt-0.5">
                {formatDate(lastSignal.received_at)}
              </p>
            </div>
          </div>
          {lastSignal.confidence_score !== null && (
            <div className="mt-2 flex items-center gap-2">
              <Brain size={11} className="text-gray-600" />
              <span className="text-[10px] text-gray-600 font-mono">Confiança IA: {lastSignal.confidence_score}%</span>
            </div>
          )}
        </Card>
      )}

      {/* Processing logs */}
      <Card>
        <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Clock size={13} /> Últimas atividades do Auto-Close
          </p>
          {lastLog && (
            <span className="text-[10px] text-gray-600 font-mono">{formatDate(lastLog.created_at)}</span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">
            Nenhuma atividade registrada ainda.
          </div>
        ) : (
          <div>
            {logs.map((log) => {
              const isError = log.action === 'error'
              return (
                <div key={log.id} className={`flex items-start gap-3 px-4 py-2.5 border-b border-dark-600/50 last:border-0 ${isError ? 'bg-red-500/3' : ''}`}>
                  {isError ? (
                    <XCircle size={13} className="text-accent-red flex-shrink-0 mt-0.5" />
                  ) : log.result === 'green' ? (
                    <CheckCircle size={13} className="text-accent-green flex-shrink-0 mt-0.5" />
                  ) : log.result === 'red' ? (
                    <XCircle size={13} className="text-accent-red flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={13} className="text-gray-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">{log.action}</p>
                    {typeof log.details?.reason === 'string' && (
                      <p className="text-[10px] text-gray-600 truncate">{log.details.reason}</p>
                    )}
                    {typeof log.details?.error === 'string' && (
                      <p className="text-[10px] text-accent-red/70 font-mono truncate">{log.details.error}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600 font-mono flex-shrink-0">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Last error */}
      {lastError && (
        <Card className="p-4 border-accent-red/20">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <XCircle size={10} className="text-accent-red" /> Último Erro Registrado
          </p>
          <p className="text-xs text-gray-400">{formatDate(lastError.created_at)}</p>
          {typeof lastError.details?.error === 'string' && (
            <p className="text-xs text-accent-red/80 font-mono mt-1 break-all">{lastError.details.error}</p>
          )}
        </Card>
      )}

      {/* Security summary */}
      {health && (
        <Card className="p-4">
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Server size={10} /> Variáveis de Ambiente
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(health.env).map(([key, present]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${present ? 'bg-accent-green' : 'bg-accent-red'}`} />
                <span className="text-[10px] text-gray-500 font-mono truncate">{key}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
