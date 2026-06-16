import { useMemo } from 'react'
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Target, BarChart2, Zap, Shield,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/dashboard/StatCard'
import { formatCurrency, formatPercent, formatDate } from '../utils/helpers'
import { Signal } from '../types'

// ── Helpers ────────────────────────────────────────────────────

function implicitProbability(odd: number): number {
  return (1 / odd) * 100
}

interface RiskInfo { label: string; color: string; bg: string }

function riskLabel(odd: number): RiskInfo {
  if (odd < 1.4)  return { label: 'Muito Baixa', color: '#00d084', bg: 'rgba(0,208,132,0.10)' }
  if (odd < 2.5)  return { label: 'Baixa',       color: '#22c55e', bg: 'rgba(34,197,94,0.10)' }
  if (odd < 4.0)  return { label: 'Média',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' }
  if (odd < 8.0)  return { label: 'Alta',        color: '#f97316', bg: 'rgba(249,115,22,0.10)' }
  return            { label: 'Muito Alta',  color: '#ff4757', bg: 'rgba(255,71,87,0.10)' }
}

interface MarketStat {
  market: string
  total: number
  greens: number
  reds: number
  winRate: number
  roi: number
  profit: number
  avgOdd: number
}

function marketStats(signals: Signal[]): MarketStat[] {
  const groups = new Map<string, Signal[]>()
  signals.forEach((s) => {
    const m = s.market_category ?? 'Other'
    if (!groups.has(m)) groups.set(m, [])
    groups.get(m)!.push(s)
  })
  const out: MarketStat[] = []
  groups.forEach((list, market) => {
    const greens = list.filter((s) => s.status === 'green')
    const reds   = list.filter((s) => s.status === 'red')
    const settled = greens.length + reds.length
    const totalStaked = [...greens, ...reds].reduce((a, s) => a + s.stake, 0)
    const profit = list.reduce((a, s) => a + (s.profit_loss ?? 0), 0)
    const withOdd = list.filter((s) => s.odd !== null)
    const avgOdd = withOdd.length > 0 ? withOdd.reduce((a, s) => a + (s.odd ?? 0), 0) / withOdd.length : 0
    out.push({
      market,
      total: list.length,
      greens: greens.length,
      reds: reds.length,
      winRate: settled > 0 ? (greens.length / settled) * 100 : 0,
      roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
      profit,
      avgOdd,
    })
  })
  return out
}

interface TipsterStat {
  name: string
  total: number
  greens: number
  reds: number
  winRate: number
  roi: number
  profit: number
}

function tipsterStats(signals: Signal[]): TipsterStat[] {
  const groups = new Map<string, Signal[]>()
  signals.forEach((s) => {
    if (!s.forwarded_from) return
    if (!groups.has(s.forwarded_from)) groups.set(s.forwarded_from, [])
    groups.get(s.forwarded_from)!.push(s)
  })
  const out: TipsterStat[] = []
  groups.forEach((list, name) => {
    const greens = list.filter((s) => s.status === 'green')
    const reds   = list.filter((s) => s.status === 'red')
    const settled = greens.length + reds.length
    const totalStaked = [...greens, ...reds].reduce((a, s) => a + s.stake, 0)
    const profit = list.reduce((a, s) => a + (s.profit_loss ?? 0), 0)
    out.push({
      name,
      total: list.length,
      greens: greens.length,
      reds: reds.length,
      winRate: settled > 0 ? (greens.length / settled) * 100 : 0,
      roi: totalStaked > 0 ? (profit / totalStaked) * 100 : 0,
      profit,
    })
  })
  return out
}

function signalScore(signal: Signal, allSignals: Signal[]): number {
  const odd = signal.odd
  let score = 0

  // 1) Implicit probability — 25pts max (best near 45%)
  if (odd && odd > 1) {
    const prob = implicitProbability(odd)
    const probScore = Math.max(0, 25 - Math.abs(prob - 45) * 0.4)
    score += probScore
  }

  // 2) AI confidence — 20pts max
  if (signal.confidence_score !== null) {
    score += (signal.confidence_score / 100) * 20
  } else {
    score += 10 // neutral
  }

  // 3) Market history win rate — 30pts max
  const marketSettled = allSignals.filter(
    (s) => s.market_category === signal.market_category && (s.status === 'green' || s.status === 'red'),
  )
  if (marketSettled.length >= 3) {
    const greens = marketSettled.filter((s) => s.status === 'green').length
    const wr = (greens / marketSettled.length) * 100
    score += (wr / 100) * 30
  } else {
    score += 15 // neutral
  }

  // 4) Tipster win rate — 25pts max
  if (signal.forwarded_from) {
    const tipSettled = allSignals.filter(
      (s) => s.forwarded_from === signal.forwarded_from && (s.status === 'green' || s.status === 'red'),
    )
    if (tipSettled.length >= 3) {
      const greens = tipSettled.filter((s) => s.status === 'green').length
      const wr = (greens / tipSettled.length) * 100
      score += (wr / 100) * 25
    } else {
      score += 12.5
    }
  } else {
    score += 12.5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

interface ScoreCfg { label: string; color: string; bg: string }

function scoreConfig(score: number): ScoreCfg {
  if (score >= 80) return { label: 'Excelente',        color: '#00d084', bg: 'rgba(0,208,132,0.10)' }
  if (score >= 65) return { label: 'Boa',              color: '#22c55e', bg: 'rgba(34,197,94,0.10)' }
  if (score >= 50) return { label: 'Média',            color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' }
  if (score >= 35) return { label: 'Arriscada',        color: '#f97316', bg: 'rgba(249,115,22,0.10)' }
  return              { label: 'Muito Arriscada', color: '#ff4757', bg: 'rgba(255,71,87,0.10)' }
}

interface Alert {
  code: string
  message: string
  severity: 'warning' | 'danger' | 'info'
}

function buildAlerts(signal: Signal, allSignals: Signal[]): Alert[] {
  const out: Alert[] = []
  const odd = signal.odd

  if (odd !== null) {
    if (odd > 10) out.push({ code: 'ODD_VERY_HIGH', message: 'Odd muito alta — risco elevado', severity: 'danger' })
    else if (odd < 1.25) out.push({ code: 'ODD_VERY_LOW', message: 'Odd muito baixa — retorno mínimo', severity: 'info' })
  }

  const marketSettled = allSignals.filter(
    (s) => s.market_category === signal.market_category && (s.status === 'green' || s.status === 'red'),
  )
  if (marketSettled.length >= 5) {
    const greens = marketSettled.filter((s) => s.status === 'green').length
    const wr = (greens / marketSettled.length) * 100
    if (wr < 40) out.push({ code: 'VOLATILE_MARKET', message: 'Mercado historicamente volátil', severity: 'warning' })
  } else {
    if (marketSettled.length < 3) {
      out.push({ code: 'FEW_HISTORY', message: 'Pouco histórico neste mercado', severity: 'info' })
    }
  }

  if (signal.is_bet_builder) {
    out.push({ code: 'BET_BUILDER', message: 'Acumuladora — risco composto', severity: 'warning' })
  }

  if (signal.confidence_score !== null && signal.confidence_score < 60) {
    out.push({ code: 'LOW_CONFIDENCE', message: 'IA com baixa confiança na leitura', severity: 'warning' })
  }

  if (signal.forwarded_from) {
    const tipCount = allSignals.filter((s) => s.forwarded_from === signal.forwarded_from).length
    if (tipCount < 3) {
      out.push({ code: 'NEW_TIPSTER', message: 'Tipster sem histórico suficiente', severity: 'info' })
    }
  }

  return out
}

// ── UI helpers ─────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cfg = scoreConfig(score)
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {score} · {cfg.label}
    </span>
  )
}

function RiskChip({ odd }: { odd: number }) {
  const r = riskLabel(odd)
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium"
      style={{ background: r.bg, color: r.color }}
    >
      {r.label}
    </span>
  )
}

function AlertSeverityBadge({ severity }: { severity: Alert['severity'] }) {
  const map = {
    danger:  { label: 'Crítico', color: '#ff4757', bg: 'rgba(255,71,87,0.12)' },
    warning: { label: 'Atenção', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    info:    { label: 'Info',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  }[severity]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium"
      style={{ background: map.bg, color: map.color }}
    >
      {map.label}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────

export function SignalIntelligencePage() {
  const { signals } = useApp()

  const settled = useMemo(
    () => signals.filter((s) => s.status === 'green' || s.status === 'red'),
    [signals],
  )

  const markets = useMemo(() => marketStats(signals).sort((a, b) => b.winRate - a.winRate), [signals])
  const tipsters = useMemo(() => tipsterStats(signals).sort((a, b) => b.roi - a.roi), [signals])

  const pending = useMemo(
    () => signals.filter((s) => s.status === 'pending' || s.status === 'needs_review'),
    [signals],
  )

  const pendingWithScore = useMemo(
    () => pending.map((s) => ({ signal: s, score: signalScore(s, signals), alerts: buildAlerts(s, signals) })),
    [pending, signals],
  )

  const avgPendingScore = pendingWithScore.length > 0
    ? Math.round(pendingWithScore.reduce((a, p) => a + p.score, 0) / pendingWithScore.length)
    : 0

  const bestMarket = markets.filter((m) => (m.greens + m.reds) >= 3).sort((a, b) => b.winRate - a.winRate)[0] ?? null
  const worstMarket = markets.filter((m) => (m.greens + m.reds) >= 3).sort((a, b) => a.winRate - b.winRate)[0] ?? null
  const bestTipster = tipsters.filter((t) => (t.greens + t.reds) >= 3).sort((a, b) => b.roi - a.roi)[0] ?? null

  const totalAlerts = pendingWithScore.reduce((a, p) => a + p.alerts.length, 0)

  const lastSignals = useMemo(() => {
    return [...signals]
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .slice(0, 20)
      .map((s) => ({ signal: s, score: signalScore(s, signals) }))
  }, [signals])

  if (settled.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inteligência do Sinal"
          subtitle="Score, risco e contexto histórico de cada sinal recebido."
        />
        <Card className="py-10">
          <EmptyState
            icon={<Brain size={20} />}
            title="Ainda não há dados suficientes."
            description="Após alguns greens e reds, a inteligência do sinal aparecerá aqui."
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inteligência do Sinal"
        subtitle="Score, risco e contexto histórico de cada sinal recebido."
      />

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Score Médio (Pendentes)"
          value={pendingWithScore.length > 0 ? `${avgPendingScore}` : '—'}
          icon={<Brain size={16} />}
          accent={avgPendingScore >= 65 ? 'green' : avgPendingScore >= 50 ? 'yellow' : 'red'}
          subtext={`${pendingWithScore.length} sinais ativos`}
        />
        <StatCard
          label="Melhor Mercado"
          value={bestMarket ? bestMarket.market : '—'}
          icon={<Target size={16} />}
          accent="green"
          subtext={bestMarket ? `${formatPercent(bestMarket.winRate, 0)} de acerto` : 'Sem histórico'}
        />
        <StatCard
          label="Mercado Arriscado"
          value={worstMarket ? worstMarket.market : '—'}
          icon={<TrendingDown size={16} />}
          accent="red"
          subtext={worstMarket ? `${formatPercent(worstMarket.winRate, 0)} de acerto` : 'Sem histórico'}
        />
        <StatCard
          label="Melhor Fonte"
          value={bestTipster ? bestTipster.name : '—'}
          icon={<Shield size={16} />}
          accent="green"
          subtext={bestTipster ? `ROI ${bestTipster.roi.toFixed(1)}%` : 'Sem fontes'}
        />
        <StatCard
          label="Alertas Ativos"
          value={String(totalAlerts)}
          icon={<AlertTriangle size={16} />}
          accent={totalAlerts > 0 ? 'yellow' : 'green'}
          subtext="Sinais pendentes"
        />
      </div>

      {/* Markets table */}
      <Card>
        <div className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-center gap-2">
          <BarChart2 size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Histórico por Mercado</h2>
        </div>
        {markets.length === 0 ? (
          <EmptyState title="Nenhum mercado registrado ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)] border-b border-[color:var(--color-border)]">
                  <th className="px-5 py-2 font-medium">Mercado</th>
                  <th className="px-3 py-2 font-medium text-right">Sinais</th>
                  <th className="px-3 py-2 font-medium text-right">Greens</th>
                  <th className="px-3 py-2 font-medium text-right">Reds</th>
                  <th className="px-3 py-2 font-medium text-right">Acerto</th>
                  <th className="px-3 py-2 font-medium text-right">ROI</th>
                  <th className="px-5 py-2 font-medium text-right">Risco</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m.market} className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-nav-hover-bg)]">
                    <td className="px-5 py-2.5 text-[color:var(--color-text-primary)]">{m.market}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-secondary)]">{m.total}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-accent-green">{m.greens}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-accent-red">{m.reds}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-primary)]">
                      {m.greens + m.reds > 0 ? formatPercent(m.winRate, 0) : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${m.roi >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {m.greens + m.reds > 0 ? `${m.roi >= 0 ? '+' : ''}${m.roi.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      {m.avgOdd > 0 ? <RiskChip odd={m.avgOdd} /> : <span className="text-[color:var(--color-text-muted)] text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Tipster ranking */}
      {tipsters.length > 0 && (
        <Card>
          <div className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-center gap-2">
            <Shield size={15} className="text-brand" />
            <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Ranking de Fontes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)] border-b border-[color:var(--color-border)]">
                  <th className="px-5 py-2 font-medium">Fonte</th>
                  <th className="px-3 py-2 font-medium text-right">Sinais</th>
                  <th className="px-3 py-2 font-medium text-right">Greens</th>
                  <th className="px-3 py-2 font-medium text-right">Reds</th>
                  <th className="px-3 py-2 font-medium text-right">Acerto</th>
                  <th className="px-3 py-2 font-medium text-right">ROI</th>
                  <th className="px-5 py-2 font-medium text-right">Lucro</th>
                </tr>
              </thead>
              <tbody>
                {tipsters.map((t) => (
                  <tr key={t.name} className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-nav-hover-bg)]">
                    <td className="px-5 py-2.5 text-[color:var(--color-text-primary)] truncate max-w-[200px]">{t.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-secondary)]">{t.total}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-accent-green">{t.greens}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-accent-red">{t.reds}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-primary)]">
                      {t.greens + t.reds > 0 ? formatPercent(t.winRate, 0) : '—'}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-mono text-xs ${t.roi >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {t.greens + t.reds > 0 ? `${t.roi >= 0 ? '+' : ''}${t.roi.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`px-5 py-2.5 text-right font-mono text-xs ${t.profit >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {t.profit >= 0 ? '+' : ''}{formatCurrency(t.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alerts for pending signals */}
      <Card>
        <div className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-center gap-2">
          <AlertTriangle size={15} className="text-accent-yellow" />
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Alertas dos Sinais Pendentes</h2>
        </div>
        {pendingWithScore.flatMap((p) => p.alerts).length === 0 ? (
          <EmptyState
            icon={<Zap size={18} />}
            title="Nenhum alerta ativo."
            description="Todos os sinais pendentes parecem dentro do esperado."
          />
        ) : (
          <div>
            {pendingWithScore.map((p) =>
              p.alerts.map((a, idx) => {
                const game = p.signal.home_team && p.signal.away_team
                  ? `${p.signal.home_team} x ${p.signal.away_team}`
                  : p.signal.home_team ?? 'Jogo desconhecido'
                return (
                  <div
                    key={`${p.signal.id}-${idx}`}
                    className="flex items-center gap-3 px-5 py-2.5 border-b border-[color:var(--color-border)] last:border-0"
                  >
                    <span className="text-sm text-[color:var(--color-text-primary)] truncate flex-1">{game}</span>
                    <span className="text-xs text-[color:var(--color-text-secondary)] truncate">{a.message}</span>
                    <AlertSeverityBadge severity={a.severity} />
                  </div>
                )
              }),
            )}
          </div>
        )}
      </Card>

      {/* Last 20 signals with score */}
      <Card>
        <div className="px-5 py-4 border-b border-[color:var(--color-border)] flex items-center gap-2">
          <TrendingUp size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Análise dos Últimos Sinais</h2>
        </div>
        {lastSignals.length === 0 ? (
          <EmptyState title="Nenhum sinal recebido ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)] border-b border-[color:var(--color-border)]">
                  <th className="px-5 py-2 font-medium">Recebido</th>
                  <th className="px-3 py-2 font-medium">Partida</th>
                  <th className="px-3 py-2 font-medium">Mercado</th>
                  <th className="px-3 py-2 font-medium text-right">Odd</th>
                  <th className="px-3 py-2 font-medium text-right">Prob.</th>
                  <th className="px-5 py-2 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {lastSignals.map(({ signal, score }) => {
                  const game = signal.home_team && signal.away_team
                    ? `${signal.home_team} x ${signal.away_team}`
                    : signal.home_team ?? '—'
                  const prob = signal.odd ? implicitProbability(signal.odd) : null
                  return (
                    <tr key={signal.id} className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-nav-hover-bg)]">
                      <td className="px-5 py-2.5 text-[10px] font-mono text-[color:var(--color-text-muted)] whitespace-nowrap">
                        {formatDate(signal.received_at)}
                      </td>
                      <td className="px-3 py-2.5 text-[color:var(--color-text-primary)] truncate max-w-[180px]">{game}</td>
                      <td className="px-3 py-2.5 text-xs text-[color:var(--color-text-secondary)] truncate max-w-[160px]">
                        {signal.market_category ?? signal.market ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-primary)]">
                        {signal.odd?.toFixed(2) ?? '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-secondary)]">
                        {prob !== null ? `${prob.toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <ScoreBadge score={score} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
