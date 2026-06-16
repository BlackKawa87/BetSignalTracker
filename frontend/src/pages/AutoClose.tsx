import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Play, CheckCircle, XCircle, Clock, AlertTriangle,
  Search, Zap, Activity, Info,
} from 'lucide-react'
import { supabase } from '../utils/supabase'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatusBadge } from '../components/ui/Badge'
import { formatCurrency, formatDate } from '../utils/helpers'
import { ProcessingLog, AutoCloseStatus, Signal } from '../types'

// ── Action meta ───────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  closed:         'Fechado',
  not_found:      'Não encontrado',
  in_progress:    'Em andamento',
  not_finished:   'Não encerrado',
  unknown_market: 'Mercado desconhecido',
  skipped:        'Ignorado',
  error:          'Erro',
}

const ACTION_ICON: Record<string, JSX.Element> = {
  closed:         <CheckCircle size={13} className="text-accent-green" />,
  not_found:      <Search size={13} className="text-[color:var(--color-text-muted)]" />,
  in_progress:    <Activity size={13} className="text-accent-yellow" />,
  not_finished:   <Clock size={13} className="text-[color:var(--color-text-muted)]" />,
  unknown_market: <Info size={13} className="text-blue-400" />,
  skipped:        <AlertTriangle size={13} className="text-orange-400" />,
  error:          <XCircle size={13} className="text-accent-red" />,
}

const RESULT_COLOR: Record<string, string> = {
  green: 'text-accent-green',
  red:   'text-accent-red',
  void:  'text-[color:var(--color-text-secondary)]',
  error: 'text-accent-red',
}

// ── Component ─────────────────────────────────────────────────

export function AutoClosePage() {
  const { signals, refreshAll } = useApp()
  const [status, setStatus]   = useState<AutoCloseStatus | null>(null)
  const [logs,   setLogs]     = useState<ProcessingLog[]>([])
  const [running, setRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastRunResult, setLastRunResult] = useState<string | null>(null)

  const pendingEligible = signals.filter((s: Signal) => {
    if (s.status !== 'pending' && s.status !== 'needs_review') return false
    if (!s.home_team || !s.away_team) return false
    const minAge = Date.now() - 110 * 60_000
    return new Date(s.received_at).getTime() < minAge
  })

  const pendingWaiting = signals.filter((s: Signal) => {
    if (s.status !== 'pending' && s.status !== 'needs_review') return false
    if (!s.home_team || !s.away_team) return false
    const minAge = Date.now() - 110 * 60_000
    return new Date(s.received_at).getTime() >= minAge
  })

  const loadData = useCallback(async () => {
    const [statusRes, logsRes] = await Promise.all([
      fetch('/api/autoclose/status').then((r) => r.json()).catch(() => null),
      supabase
        .from('processing_logs')
        .select('id, created_at, signal_id, action, details, result, signals(home_team, away_team, market)')
        .order('created_at', { ascending: false })
        .limit(60),
    ])

    if (statusRes) setStatus(statusRes)
    if (!logsRes.error && logsRes.data) setLogs(logsRes.data as unknown as ProcessingLog[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleRun = async () => {
    setRunning(true)
    setLastRunResult(null)
    try {
      const res  = await fetch('/api/autoclose/run', { method: 'POST' })
      const data = await res.json()
      const s    = data.stats
      if (s) {
        setLastRunResult(
          `Processados: ${s.processed} | Fechados: ${s.closed} | Ignorados: ${s.skipped} | Erros: ${s.errors}`,
        )
      }
      await Promise.all([loadData(), refreshAll()])
    } catch (err) {
      setLastRunResult(`Erro: ${String(err)}`)
    }
    setRunning(false)
  }

  return (
    <div className="space-y-6">

      <PageHeader
        title="Fechamento Automático"
        subtitle="O sistema acompanha resultados e atualiza sinais automaticamente quando possível."
        actions={
          <>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-nav-hover-bg)] transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleRun}
              disabled={running || !status?.apiKeySet}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-40"
            >
              <Play size={15} />
              {running ? 'Processando...' : 'Executar agora'}
            </button>
          </>
        }
      />

      {/* API Key warning */}
      {status && !status.apiKeySet && (
        <div className="flex items-start gap-3 p-4 bg-accent-red/5 border border-accent-red/20 rounded-lg">
          <AlertTriangle size={16} className="text-accent-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-accent-red">SPORTS_API_KEY não configurada</p>
            <p className="text-xs text-[color:var(--color-text-secondary)] mt-1">
              Cadastre-se em{' '}
              <span className="text-blue-400 font-mono">rapidapi.com/api-sports/api/api-football</span>
              {' '}(plano gratuito: 100 req/dia), depois adicione{' '}
              <span className="text-accent-green font-mono">SPORTS_API_KEY</span> nas variáveis de ambiente da Vercel.
            </p>
          </div>
        </div>
      )}

      {/* Last run result */}
      {lastRunResult && (
        <div className="p-3 bg-[color:var(--color-input-bg)] border border-[color:var(--color-border)] rounded-lg text-sm font-mono text-[color:var(--color-text-secondary)]">
          {lastRunResult}
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Status API</p>
          <p className={`text-sm font-bold ${status?.apiKeySet ? 'text-accent-green' : 'text-accent-red'}`}>
            {status?.apiKeySet ? '● Configurada' : '● Não configurada'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Última execução</p>
          <p className="text-sm font-mono text-[color:var(--color-text-secondary)]">
            {status?.lastRun ? formatDate(status.lastRun) : 'Nunca'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Fechados hoje</p>
          <p className="text-xl font-bold font-mono text-[color:var(--color-text-primary)]">{status?.today.closed ?? 0}</p>
          <p className="text-xs font-mono mt-0.5">
            <span className="text-accent-green">{status?.today.green ?? 0}G</span>
            {' / '}
            <span className="text-accent-red">{status?.today.red ?? 0}R</span>
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono uppercase tracking-wider mb-1">Prontos p/ verificar</p>
          <p className="text-xl font-bold font-mono text-accent-yellow">{pendingEligible.length}</p>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">sinais</p>
        </Card>
      </div>

      {/* Eligible signals */}
      {pendingEligible.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-[color:var(--color-border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)] flex items-center gap-2">
              <Zap size={14} className="text-accent-yellow" />
              Prontos para verificar ({pendingEligible.length})
            </h2>
            <span className="text-xs text-[color:var(--color-text-muted)] font-mono">{">"} 110 min atrás</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[500px]">
              {pendingEligible.map((s: Signal) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-input-bg)]/30">
                  <StatusBadge status={s.status} />
                  <span className="flex-1 text-sm text-[color:var(--color-text-primary)] truncate">
                    {s.home_team} x {s.away_team}
                  </span>
                  <span className="text-xs text-[color:var(--color-text-muted)] font-mono w-40 flex-shrink-0">{s.market ?? '—'}</span>
                  <span className="text-xs text-[color:var(--color-text-muted)] font-mono w-24 text-right flex-shrink-0">
                    {formatCurrency(s.stake)}
                  </span>
                  <span className="text-xs text-[color:var(--color-text-muted)] font-mono w-28 text-right flex-shrink-0">
                    {formatDate(s.received_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Waiting signals (too recent) */}
      {pendingWaiting.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-[color:var(--color-border)]">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)] flex items-center gap-2">
              <Clock size={14} className="text-[color:var(--color-text-muted)]" />
              Aguardando horário do jogo ({pendingWaiting.length})
            </h2>
          </div>
          <div>
            {pendingWaiting.map((s: Signal) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[color:var(--color-border)] last:border-0 text-[color:var(--color-text-muted)]">
                <Clock size={13} />
                <span className="flex-1 text-sm truncate">
                  {s.home_team ?? '?'} x {s.away_team ?? '?'}
                </span>
                <span className="text-xs font-mono">{formatDate(s.received_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Processing logs */}
      <Card>
        <div className="px-4 py-3 border-b border-[color:var(--color-border)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)]">Log de Processamento</h2>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">Últimas {logs.length} entradas</p>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            title="Nenhum processamento ainda."
            description="Execute o fechamento automático para verificar resultados pendentes."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              {logs.map((log) => {
                const sig = (log as ProcessingLog & { signals?: { home_team: string | null; away_team: string | null; market: string | null } | null }).signals
                const game = sig?.home_team && sig?.away_team
                  ? `${sig.home_team} x ${sig.away_team}`
                  : '—'

                const score = (log.details?.score as string) ?? null
                const league = (log.details?.league as string) ?? null

                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-input-bg)]/20">
                    <div className="flex-shrink-0 pt-0.5">
                      {ACTION_ICON[log.action] ?? <Info size={13} className="text-[color:var(--color-text-muted)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[color:var(--color-text-secondary)]">
                          {ACTION_LABEL[log.action] ?? log.action}
                        </span>
                        <span className="text-xs text-[color:var(--color-text-muted)]">·</span>
                        <span className="text-xs text-[color:var(--color-text-secondary)] truncate">{game}</span>
                        {score && (
                          <span className="text-xs font-mono font-bold text-[color:var(--color-text-primary)] bg-[color:var(--color-nav-hover-bg)] px-1.5 py-0.5 rounded">
                            {score}
                          </span>
                        )}
                        {league && (
                          <span className="text-[10px] text-[color:var(--color-text-muted)] truncate">{league}</span>
                        )}
                      </div>
                      {log.action === 'closed' && sig?.market && (
                        <p className="text-[11px] text-[color:var(--color-text-muted)] font-mono mt-0.5 truncate">
                          {sig.market}
                        </p>
                      )}
                      {typeof log.details?.reason === 'string' && (
                        <p className="text-[11px] text-[color:var(--color-text-muted)] mt-0.5">{log.details.reason}</p>
                      )}
                      {typeof log.details?.error === 'string' && (
                        <p className="text-[11px] text-accent-red/80 font-mono mt-0.5 truncate">{log.details.error}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {log.result && log.result !== 'skip' && (
                        <span className={`text-xs font-mono font-bold uppercase ${RESULT_COLOR[log.result] ?? 'text-[color:var(--color-text-secondary)]'}`}>
                          {log.result}
                        </span>
                      )}
                      <p className="text-[10px] text-[color:var(--color-text-muted)] font-mono mt-0.5">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {/* How it works */}
      <Card className="p-4">
        <h3 className="text-xs font-semibold text-[color:var(--color-text-secondary)] mb-3 uppercase tracking-wider">Como funciona</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[color:var(--color-text-muted)] leading-relaxed">
          <div>
            <p className="text-[color:var(--color-text-secondary)] font-semibold mb-1">Mercados suportados</p>
            <ul className="space-y-0.5">
              <li>● BTTS / Ambas Marcam (Sim/Não)</li>
              <li>● Over/Under gols (ex: Mais de 2.5)</li>
              <li>● Resultado Final 1X2 / Moneyline</li>
              <li>● Dupla Hipótese (1X, 12, X2)</li>
              <li>● Handicap Asiático/Europeu</li>
              <li>● Escanteios Over/Under *</li>
              <li>● Cartões Over/Under *</li>
            </ul>
            <p className="text-[color:var(--color-text-muted)] mt-1">* Requer dados de estatísticas da API</p>
          </div>
          <div>
            <p className="text-[color:var(--color-text-secondary)] font-semibold mb-1">Fluxo automático</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>A cada 15 min, busca sinais pendentes {">"} 110min</li>
              <li>Pesquisa a partida na API esportiva</li>
              <li>Se encerrada: avalia o mercado</li>
              <li>Marca Green / Red / Void automaticamente</li>
              <li>Atualiza banca e bankroll_history</li>
              <li>Registra tudo no log de processamento</li>
            </ol>
            <p className="text-[color:var(--color-text-muted)] mt-1">
              Multiples são ignoradas (precisam de fechamento manual).
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
