import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Cell, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Trophy, Target, BarChart2,
  Flame, AlertTriangle, Calendar, Activity,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import {
  computeAnalytics, roiColor, profitColor, heatmapCellColor,
  GroupStats, MonthStats, HeatmapCell,
} from '../utils/analytics'
import { formatCurrency, formatPercent } from '../utils/helpers'

// ── Reusable sub-components ───────────────────────────────────

function KpiCard({
  label, value, sub, accent, icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  icon: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1">{label}</p>
          <p className="text-xl font-bold font-mono" style={{ color: accent ?? '#e8e8e8' }}>{value}</p>
          {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg bg-dark-600 text-gray-500">{icon}</div>
      </div>
    </Card>
  )
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#111118',
    border: '1px solid #2e2e3a',
    borderRadius: 8,
    fontSize: 12,
  },
  cursor: { fill: '#1a1a24' },
}

// ── Horizontal ROI bar ────────────────────────────────────────

function HorizontalRoiTable({ data, maxRows = 8 }: { data: GroupStats[]; maxRows?: number }) {
  const maxAbsRoi = Math.max(...data.map((d) => Math.abs(d.roi)), 1)
  return (
    <div className="space-y-2">
      {data.slice(0, maxRows).map((row) => (
        <div key={row.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-300 truncate max-w-[160px]">{row.label}</span>
            <div className="flex items-center gap-3 text-right font-mono flex-shrink-0">
              <span className="text-gray-500 w-16">
                {row.greens}W {row.reds}L
              </span>
              <span className="text-gray-500 w-16 text-right">
                {formatCurrency(row.profit)}
              </span>
              <span
                className="w-14 text-right font-bold"
                style={{ color: roiColor(row.roi) }}
              >
                {row.roi > 0 ? '+' : ''}{row.roi.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(Math.abs(row.roi) / maxAbsRoi) * 100}%`,
                background: roiColor(row.roi),
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Calendar Heatmap ──────────────────────────────────────────

function CalendarHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const maxAbs = Math.max(...cells.filter((c) => c.hasData).map((c) => Math.abs(c.profit)), 1)
  const DOW_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  // Split into weeks of 7
  const weeks: HeatmapCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div>
      {/* Row labels */}
      <div className="flex gap-1 mb-1 ml-0">
        {DOW_LABELS.map((d) => (
          <div key={d} className="w-8 text-center text-[10px] text-gray-600 font-mono">{d}</div>
        ))}
      </div>
      {/* Grid: each row = one week */}
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1">
            {week.map((cell, di) => (
              <div
                key={di}
                className="w-8 h-8 rounded-sm flex items-center justify-center text-[9px] font-mono relative group"
                style={{ background: heatmapCellColor(cell, maxAbs) }}
                title={
                  cell.hasData
                    ? `${cell.date}: ${cell.profit >= 0 ? '+' : ''}${formatCurrency(cell.profit)} (${cell.count} sinal${cell.count !== 1 ? 'is' : ''})`
                    : cell.date.startsWith('pad') ? '' : cell.date
                }
              >
                {cell.hasData && Math.abs(cell.profit) > 0 && (
                  <span
                    className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 left-1/2 -translate-x-1/2 bg-dark-700 text-gray-200 px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap z-10 pointer-events-none"
                  >
                    {cell.profit >= 0 ? '+' : ''}{formatCurrency(cell.profit)}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-gray-600">Menos</span>
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((o) => (
          <div key={o} className="w-5 h-5 rounded-sm" style={{ background: `rgba(0,208,132,${o})` }} />
        ))}
        <span className="text-[10px] text-gray-600">Mais lucro</span>
        <span className="mx-2 text-gray-700">|</span>
        {[0.15, 0.35, 0.55, 0.75, 0.95].map((o) => (
          <div key={o} className="w-5 h-5 rounded-sm" style={{ background: `rgba(255,71,87,${o})` }} />
        ))}
        <span className="text-[10px] text-gray-600">Mais perda</span>
      </div>
    </div>
  )
}

// ── Monthly table ─────────────────────────────────────────────

function MonthlyTable({ data }: { data: MonthStats[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-dark-600">
            {['Mês', 'Encerrados', 'W', 'L', 'Taxa', 'Investido', 'Lucro', 'ROI'].map((h) => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-mono text-gray-600 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...data].reverse().map((m) => (
            <tr key={m.month} className="border-b border-dark-600/50 hover:bg-dark-700/30 transition-colors">
              <td className="px-3 py-2 font-mono text-gray-300">{m.shortLabel}</td>
              <td className="px-3 py-2 font-mono text-gray-400">{m.settled}</td>
              <td className="px-3 py-2 font-mono text-accent-green">{m.greens}</td>
              <td className="px-3 py-2 font-mono text-accent-red">{m.reds}</td>
              <td className="px-3 py-2 font-mono" style={{ color: m.winRate >= 50 ? '#00d084' : '#ffd32a' }}>
                {m.winRate.toFixed(1)}%
              </td>
              <td className="px-3 py-2 font-mono text-gray-500">{formatCurrency(m.staked)}</td>
              <td className="px-3 py-2 font-mono font-bold" style={{ color: profitColor(m.profit) }}>
                {m.profit >= 0 ? '+' : ''}{formatCurrency(m.profit)}
              </td>
              <td className="px-3 py-2 font-mono font-bold" style={{ color: roiColor(m.roi) }}>
                {m.roi >= 0 ? '+' : ''}{m.roi.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    label: 'Visão Geral',    icon: <Activity size={14} /> },
  { id: 'breakdown',  label: 'Breakdown',       icon: <BarChart2 size={14} /> },
  { id: 'streaks',    label: 'Sequências',      icon: <Flame size={14} /> },
  { id: 'heatmap',    label: 'Heatmap',         icon: <Calendar size={14} /> },
  { id: 'table',      label: 'Tabela Mensal',   icon: <Target size={14} /> },
]

// ── Page ──────────────────────────────────────────────────────

export function AnalyticsPage() {
  const { signals, stats } = useApp()
  const [tab, setTab] = useState('overview')

  const data = useMemo(() => computeAnalytics(signals), [signals])

  const totalPL       = stats?.totalProfitLoss ?? 0
  const bestMonth     = [...data.monthly].sort((a, b) => b.profit - a.profit)[0]
  const worstMonth    = [...data.monthly].sort((a, b) => a.profit - b.profit)[0]
  const bestROImonth  = [...data.monthly].filter((m) => m.settled >= 3).sort((a, b) => b.roi - a.roi)[0]

  // Equity curve: show settled signals sorted by date, cumulative P&L
  const equityCurve = useMemo(() => {
    const settled = [...signals]
      .filter((s) => s.profit_loss !== null)
      .sort((a, b) => a.received_at.localeCompare(b.received_at))
    let cum = 0
    return settled.map((s, i) => {
      cum += s.profit_loss ?? 0
      return { n: i + 1, value: Math.round(cum * 100) / 100 }
    })
  }, [signals])

  if (signals.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Analytics Avançado</h1>
        <Card className="p-12 text-center">
          <p className="text-gray-600">Sem dados suficientes. Registre sinais para ver as análises.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics Avançado</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {signals.filter((s) => s.status === 'green' || s.status === 'red').length} sinais encerrados analisados
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="ROI Global"
          value={`${(stats?.roi ?? 0) >= 0 ? '+' : ''}${(stats?.roi ?? 0).toFixed(2)}%`}
          sub={`${formatCurrency(totalPL)} lucro total`}
          accent={profitColor(totalPL)}
          icon={<Target size={16} />}
        />
        <KpiCard
          label="Taxa de Acerto"
          value={formatPercent(stats?.winRate ?? 0)}
          sub={`${stats?.greens ?? 0}W / ${stats?.reds ?? 0}L`}
          accent={(stats?.winRate ?? 0) >= 50 ? '#00d084' : '#ffd32a'}
          icon={<TrendingUp size={16} />}
        />
        <KpiCard
          label="Sequência Atual"
          value={`${data.streaks.currentStreak}× ${data.streaks.currentType === 'green' ? '🟢' : data.streaks.currentType === 'red' ? '🔴' : '—'}`}
          sub={data.streaks.currentType === 'none' ? 'sem dados' : data.streaks.currentType === 'green' ? 'consecutivos' : 'consecutivos'}
          accent={data.streaks.currentType === 'green' ? '#00d084' : data.streaks.currentType === 'red' ? '#ff4757' : '#666'}
          icon={<Flame size={16} />}
        />
        <KpiCard
          label="Melhor Mês"
          value={bestMonth ? `+${bestMonth.profit.toFixed(0)}` : '—'}
          sub={bestMonth?.shortLabel}
          accent="#00d084"
          icon={<Trophy size={16} />}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-dark-600 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent-green text-accent-green'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Visão Geral ── */}
      {tab === 'overview' && (
        <div className="space-y-6">

          {/* Equity Curve */}
          {equityCurve.length > 1 && (
            <Card className="p-4">
              <SectionHeader
                title="Curva de Equity"
                sub="Lucro/prejuízo acumulado por aposta encerrada"
              />
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={equityCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d084" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d084" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="equityGradNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ff4757" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff4757" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="n" stroke="#242430" tick={{ fill: '#444', fontSize: 10 }} tickLine={false} label={{ value: 'aposta nº', position: 'insideBottom', fill: '#444', fontSize: 10 }} />
                  <YAxis stroke="#242430" tick={{ fill: '#444', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={60} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [formatCurrency(v), 'Acumulado']}
                    labelFormatter={(n) => `Aposta #${n}`}
                    labelStyle={{ color: '#888' }}
                  />
                  <ReferenceLine y={0} stroke="#2e2e3a" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={totalPL >= 0 ? '#00d084' : '#ff4757'}
                    strokeWidth={2}
                    fill={totalPL >= 0 ? 'url(#equityGrad)' : 'url(#equityGradNeg)'}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Monthly P&L */}
          {data.monthly.length > 0 && (
            <Card className="p-4">
              <SectionHeader title="P&L Mensal" sub="Lucro/prejuízo por mês (barras) + acumulado (linha)" />
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={data.monthly.map((m, i, arr) => ({
                    ...m,
                    cumulative: arr.slice(0, i + 1).reduce((a, x) => a + x.profit, 0),
                  }))}
                  margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
                >
                  <XAxis dataKey="shortLabel" stroke="#242430" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} />
                  <YAxis yAxisId="bar" stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={60} tickLine={false} />
                  <YAxis yAxisId="line" orientation="right" stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={60} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [
                      formatCurrency(v),
                      name === 'profit' ? 'Mensal' : 'Acumulado',
                    ]}
                    labelStyle={{ color: '#888' }}
                  />
                  <ReferenceLine yAxisId="bar" y={0} stroke="#2e2e3a" />
                  <Bar yAxisId="bar" dataKey="profit" name="profit" radius={[3, 3, 0, 0]}>
                    {data.monthly.map((m, i) => (
                      <Cell key={i} fill={m.profit >= 0 ? '#00d084' : '#ff4757'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                  <Line yAxisId="line" type="monotone" dataKey="cumulative" stroke="#3742fa" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Weekly P&L */}
          {data.weekly.length > 1 && (
            <Card className="p-4">
              <SectionHeader title="Lucro Semanal" sub="Últimas 16 semanas" />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.weekly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} />
                  <YAxis stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={56} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [formatCurrency(v), 'Lucro']}
                    labelFormatter={(l) => `Semana ${l}`}
                    labelStyle={{ color: '#888' }}
                  />
                  <ReferenceLine y={0} stroke="#2e2e3a" />
                  <Bar dataKey="profit" radius={[3, 3, 0, 0]}>
                    {data.weekly.map((w, i) => (
                      <Cell key={i} fill={w.profit >= 0 ? '#00d084' : '#ff4757'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Breakdown ── */}
      {tab === 'breakdown' && (
        <div className="space-y-6">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Competition */}
            <Card className="p-4">
              <SectionHeader title="ROI por Campeonato" sub="Mín. 2 sinais encerrados" />
              {data.byCompetition.length === 0 ? (
                <p className="text-gray-600 text-sm">Sem dados de campeonato.</p>
              ) : (
                <HorizontalRoiTable data={data.byCompetition} />
              )}
            </Card>

            {/* By Market */}
            <Card className="p-4">
              <SectionHeader title="ROI por Mercado" sub="Mín. 2 sinais encerrados" />
              {data.byMarket.length === 0 ? (
                <p className="text-gray-600 text-sm">Sem dados de mercado.</p>
              ) : (
                <HorizontalRoiTable data={data.byMarket} />
              )}
            </Card>
          </div>

          {/* By Odds Range */}
          <Card className="p-4">
            <SectionHeader title="ROI por Faixa de Odds" />
            {data.byOddsRange.length === 0 ? (
              <p className="text-gray-600 text-sm">Sem dados suficientes.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byOddsRange} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="rangeLabel" stroke="#242430" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} />
                  <YAxis stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} width={48} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number, name: string) => [
                      name === 'roi' ? `${v.toFixed(2)}%` : String(v),
                      name === 'roi' ? 'ROI' : 'Encerrados',
                    ]}
                    labelStyle={{ color: '#888' }}
                  />
                  <ReferenceLine y={0} stroke="#2e2e3a" strokeDasharray="3 3" />
                  <Bar dataKey="roi" name="roi" radius={[4, 4, 0, 0]}>
                    {data.byOddsRange.map((r, i) => (
                      <Cell key={i} fill={roiColor(r.roi)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {/* Range detail */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
              {data.byOddsRange.map((r) => (
                <div key={r.rangeLabel} className="bg-dark-700/50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-600 font-mono">{r.rangeLabel}</p>
                  <p className="text-sm font-bold font-mono mt-1" style={{ color: roiColor(r.roi) }}>
                    {r.roi >= 0 ? '+' : ''}{r.roi.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-gray-600 font-mono">{r.greens}W {r.reds}L</p>
                </div>
              ))}
            </div>
          </Card>

          {/* By Day of Week */}
          <Card className="p-4">
            <SectionHeader title="Desempenho por Dia da Semana" />
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.byDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" stroke="#242430" tick={{ fill: '#555', fontSize: 11 }} tickLine={false} />
                <YAxis stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} width={44} tickLine={false} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: number, name: string) => [
                    name === 'roi' ? `${(v as number).toFixed(2)}%` : formatCurrency(v as number),
                    name === 'roi' ? 'ROI' : 'Lucro',
                  ]}
                  labelStyle={{ color: '#888' }}
                />
                <ReferenceLine y={0} stroke="#2e2e3a" strokeDasharray="3 3" />
                <Bar dataKey="roi" name="roi" radius={[3, 3, 0, 0]}>
                  {data.byDayOfWeek.map((d, i) => (
                    <Cell key={i} fill={roiColor(d.roi)} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ── TAB: Sequências ── */}
      {tab === 'streaks' && (
        <div className="space-y-6">

          {/* Streak cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-accent-green/10 border border-accent-green/20 flex items-center justify-center">
                  <Flame size={18} className="text-accent-green" />
                </div>
                <p className="text-sm font-semibold text-gray-300">Melhor Sequência de Greens</p>
              </div>
              <p className="text-5xl font-bold font-mono text-accent-green">{data.streaks.bestGreenStreak}</p>
              <p className="text-sm text-gray-500 mt-1">consecutivos</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-accent-red/10 border border-accent-red/20 flex items-center justify-center">
                  <AlertTriangle size={18} className="text-accent-red" />
                </div>
                <p className="text-sm font-semibold text-gray-300">Pior Sequência de Reds</p>
              </div>
              <p className="text-5xl font-bold font-mono text-accent-red">{data.streaks.worstRedStreak}</p>
              <p className="text-sm text-gray-500 mt-1">consecutivos</p>
            </Card>

            <Card className="p-5 col-span-2">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-3">Sequência Atual</p>
              {data.streaks.currentType === 'none' ? (
                <p className="text-gray-500">Sem sinais encerrados.</p>
              ) : (
                <div className="flex items-center gap-4">
                  <p
                    className="text-6xl font-bold font-mono"
                    style={{ color: data.streaks.currentType === 'green' ? '#00d084' : '#ff4757' }}
                  >
                    {data.streaks.currentStreak}
                  </p>
                  <div>
                    <p
                      className="text-xl font-bold"
                      style={{ color: data.streaks.currentType === 'green' ? '#00d084' : '#ff4757' }}
                    >
                      {data.streaks.currentType === 'green' ? 'GREEN' : 'RED'}
                    </p>
                    <p className="text-gray-500 text-sm">em sequência</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Best/Worst months */}
          {bestMonth && worstMonth && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-accent-green" />
                  <p className="text-xs text-gray-400 font-semibold">Melhor Mês</p>
                </div>
                <p className="text-sm font-mono text-gray-300">{bestMonth.shortLabel}</p>
                <p className="text-2xl font-bold font-mono text-accent-green mt-1">
                  +{formatCurrency(bestMonth.profit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ROI {bestROImonth?.roi.toFixed(1) ?? '—'}% · {bestMonth.greens}W {bestMonth.reds}L
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown size={14} className="text-accent-red" />
                  <p className="text-xs text-gray-400 font-semibold">Pior Mês</p>
                </div>
                <p className="text-sm font-mono text-gray-300">{worstMonth.shortLabel}</p>
                <p className="text-2xl font-bold font-mono text-accent-red mt-1">
                  {formatCurrency(worstMonth.profit)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  ROI {worstMonth.roi.toFixed(1)}% · {worstMonth.greens}W {worstMonth.reds}L
                </p>
              </Card>
            </div>
          )}

          {/* Daily P&L last 60 days */}
          {data.daily.filter((d) => d.profit !== 0).length > 1 && (
            <Card className="p-4">
              <SectionHeader title="Lucro Diário" sub="Últimos 60 dias" />
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.daily.filter((d) => d.profit !== 0).slice(-30)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickLine={false} interval={4} />
                  <YAxis stroke="#242430" tick={{ fill: '#555', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={56} tickLine={false} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(v: number) => [formatCurrency(v), 'Lucro']}
                    labelStyle={{ color: '#888' }}
                  />
                  <ReferenceLine y={0} stroke="#2e2e3a" />
                  <Bar dataKey="profit" radius={[2, 2, 0, 0]}>
                    {data.daily.filter((d) => d.profit !== 0).slice(-30).map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? '#00d084' : '#ff4757'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB: Heatmap ── */}
      {tab === 'heatmap' && (
        <div className="space-y-6">
          <Card className="p-4">
            <SectionHeader
              title="Heatmap de Desempenho"
              sub="Lucro/prejuízo diário — últimos 91 dias"
            />
            <CalendarHeatmap cells={data.heatmap} />
          </Card>

          {/* Active days stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(() => {
              const activeDays = data.heatmap.filter((c) => c.hasData)
              const greenDays  = activeDays.filter((c) => c.profit > 0).length
              const redDays    = activeDays.filter((c) => c.profit < 0).length
              const totalDays  = activeDays.length
              const avgDaily   = totalDays > 0 ? activeDays.reduce((a, c) => a + c.profit, 0) / totalDays : 0
              return (
                <>
                  <Card className="p-3 text-center">
                    <p className="text-[10px] text-gray-600 font-mono uppercase">Dias ativos</p>
                    <p className="text-2xl font-bold font-mono text-white mt-1">{totalDays}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-[10px] text-gray-600 font-mono uppercase">Dias positivos</p>
                    <p className="text-2xl font-bold font-mono text-accent-green mt-1">{greenDays}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-[10px] text-gray-600 font-mono uppercase">Dias negativos</p>
                    <p className="text-2xl font-bold font-mono text-accent-red mt-1">{redDays}</p>
                  </Card>
                  <Card className="p-3 text-center">
                    <p className="text-[10px] text-gray-600 font-mono uppercase">Média diária</p>
                    <p className="text-2xl font-bold font-mono mt-1" style={{ color: profitColor(avgDaily) }}>
                      {avgDaily >= 0 ? '+' : ''}{formatCurrency(avgDaily)}
                    </p>
                  </Card>
                </>
              )
            })()}
          </div>

          {/* Daily active list */}
          <Card>
            <div className="px-4 py-3 border-b border-dark-600">
              <h3 className="text-sm font-semibold text-gray-300">Dias com atividade</h3>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[400px]">
                {data.heatmap
                  .filter((c) => c.hasData)
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((c) => (
                    <div key={c.date} className="flex items-center gap-3 px-4 py-2 border-b border-dark-600/50 last:border-0">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: heatmapCellColor(c, 100) }} />
                      <span className="font-mono text-xs text-gray-500 w-24 flex-shrink-0">{c.date}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{c.count} sinal{c.count !== 1 ? 'is' : ''}</span>
                      <span
                        className="flex-1 text-right text-sm font-mono font-bold"
                        style={{ color: profitColor(c.profit) }}
                      >
                        {c.profit >= 0 ? '+' : ''}{formatCurrency(c.profit)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: Tabela Mensal ── */}
      {tab === 'table' && (
        <div className="space-y-6">

          {/* Monthly summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1">Lucro este mês</p>
              {(() => {
                const thisMonth = new Date().toISOString().slice(0, 7)
                const m = data.monthly.find((x) => x.month === thisMonth)
                return (
                  <>
                    <p className="text-2xl font-bold font-mono" style={{ color: profitColor(m?.profit ?? 0) }}>
                      {m ? `${m.profit >= 0 ? '+' : ''}${formatCurrency(m.profit)}` : '—'}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{m ? `${m.greens}W / ${m.reds}L` : 'sem sinais'}</p>
                  </>
                )
              })()}
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1">Meses positivos</p>
              {(() => {
                const pos = data.monthly.filter((m) => m.profit > 0).length
                const total = data.monthly.length
                return (
                  <>
                    <p className="text-2xl font-bold font-mono text-accent-green">{pos}</p>
                    <p className="text-xs text-gray-600 mt-0.5">de {total} {total === 1 ? 'mês' : 'meses'}</p>
                  </>
                )
              })()}
            </Card>
            <Card className="p-4">
              <p className="text-[10px] text-gray-600 font-mono uppercase tracking-wider mb-1">ROI médio mensal</p>
              {(() => {
                const months = data.monthly.filter((m) => m.settled >= 3)
                const avg = months.length > 0
                  ? months.reduce((a, m) => a + m.roi, 0) / months.length
                  : 0
                return (
                  <>
                    <p className="text-2xl font-bold font-mono" style={{ color: roiColor(avg) }}>
                      {avg >= 0 ? '+' : ''}{avg.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">mín. 3 encerrados</p>
                  </>
                )
              })()}
            </Card>
          </div>

          {/* Full table */}
          <Card>
            <div className="px-4 py-3 border-b border-dark-600">
              <h2 className="text-sm font-semibold text-gray-300">Breakdown Mensal Completo</h2>
            </div>
            {data.monthly.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-600 text-sm">Sem dados mensais ainda.</div>
            ) : (
              <MonthlyTable data={data.monthly} />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
