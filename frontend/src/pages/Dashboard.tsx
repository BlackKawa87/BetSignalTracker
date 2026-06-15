import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Target, DollarSign, Zap,
  CheckCircle, XCircle, Clock, Plus, RefreshCw, AlertTriangle,
  BarChart2, Percent,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useApp } from '../contexts/AppContext'
import { StatCard } from '../components/dashboard/StatCard'
import { SignalTable } from '../components/dashboard/SignalTable'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatPercent, calculateStake, formatDateShort } from '../utils/helpers'
import { parseSignal } from '../utils/signalParser'

export function Dashboard() {
  const { stats, signals, settings, bankrollHistory, addSignal, refreshAll, loading } = useApp()
  const [signalText, setSignalText] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const handleAddSignal = async () => {
    if (!signalText.trim() || !settings) return
    setAdding(true)
    const parsed = parseSignal(signalText)
    const stake = calculateStake(settings.current_bankroll, settings.stake_percentage)
    await addSignal({
      received_at: new Date().toISOString(),
      home_team: parsed.home_team,
      away_team: parsed.away_team,
      market: parsed.market,
      market_category: null,
      selection: null,
      period: null,
      line: null,
      team: null,
      player: null,
      is_bet_builder: false,
      legs: null,
      odd: parsed.odd,
      competition: parsed.competition,
      bookmaker: parsed.bookmaker ?? settings.preferred_bookmaker,
      match_time: parsed.match_time,
      stake,
      status: 'pending',
      profit_loss: null,
      raw_text: parsed.raw_text,
      ai_raw_json: null,
      image_url: null,
      telegram_message_id: null,
      confidence_score: null,
      notes: null,
    })
    setSignalText('')
    setShowAddForm(false)
    setAdding(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <RefreshCw size={20} className="animate-spin mr-2" /> Carregando...
      </div>
    )
  }

  const pendingSignals   = signals.filter((s) => s.status === 'pending')
  const reviewSignals    = signals.filter((s) => s.status === 'needs_review')
  const recentSignals    = signals.slice(0, 30)
  const currentStake     = calculateStake(settings?.current_bankroll ?? 0, settings?.stake_percentage ?? 2)
  const profitLoss       = stats?.totalProfitLoss ?? 0
  const profitIsPositive = profitLoss >= 0

  const chartData = bankrollHistory.map((h) => ({
    date: formatDateShort(h.created_at),
    banca: h.bankroll,
  }))

  if (settings && chartData.length === 0) {
    chartData.push({ date: 'Início', banca: settings.initial_bankroll })
  }
  if (settings && chartData.length > 0) {
    chartData.push({ date: 'Agora', banca: settings.current_bankroll })
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Stake atual:{' '}
            <span className="text-accent-green font-mono font-bold">
              {formatCurrency(currentStake)}
            </span>
            <span className="text-gray-600 ml-2">
              ({settings?.stake_percentage ?? 2}% de {formatCurrency(settings?.current_bankroll ?? 0)})
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshAll}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 bg-accent-green text-dark-900 font-semibold rounded-lg hover:bg-accent-green/90 transition-colors text-sm"
          >
            <Plus size={16} /> Novo Sinal
          </button>
        </div>
      </div>

      {/* Add signal form */}
      {showAddForm && (
        <Card className="p-4 animate-fade-in">
          <p className="text-sm text-gray-400 mb-3 font-medium">Cole o sinal do Telegram:</p>
          <textarea
            value={signalText}
            onChange={(e) => setSignalText(e.target.value)}
            placeholder="Ex: SINAL: Ambas Marcam SIM — Flamengo x Palmeiras — Odd 1.75"
            rows={3}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400 resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-600">
              Stake automática:{' '}
              <span className="text-accent-green font-mono">{formatCurrency(currentStake)}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(false); setSignalText('') }}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSignal}
                disabled={!signalText.trim() || adding}
                className="px-4 py-1.5 bg-accent-green text-dark-900 font-semibold rounded-lg text-sm disabled:opacity-40 hover:bg-accent-green/90 transition-colors"
              >
                {adding ? 'Salvando...' : 'Salvar Sinal'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Needs review alert */}
      {reviewSignals.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-orange-400/5 border border-orange-400/20 rounded-lg">
          <AlertTriangle size={16} className="text-orange-400 flex-shrink-0" />
          <p className="text-sm text-orange-300/90">
            <strong>{reviewSignals.length}</strong> sinal{reviewSignals.length > 1 ? 'is precisam' : ' precisa'} de revisão manual.
            Clique em <strong>Editar</strong> para preencher os dados faltantes.
          </p>
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Banca Atual"
          value={formatCurrency(stats?.currentBankroll ?? 0)}
          icon={<DollarSign size={16} />}
          accent={stats && stats.currentBankroll >= stats.initialBankroll ? 'green' : 'red'}
          subtext={`Inicial: ${formatCurrency(stats?.initialBankroll ?? 0)}`}
        />
        <StatCard
          label="Lucro / Prejuízo"
          value={`${profitIsPositive ? '+' : ''}${formatCurrency(profitLoss)}`}
          icon={profitIsPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={profitIsPositive ? 'green' : 'red'}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats?.roi ?? 0)}
          icon={<Target size={16} />}
          accent={stats && stats.roi >= 0 ? 'green' : 'red'}
          subtext="Sobre valor apostado"
        />
        <StatCard
          label="Taxa de Acerto"
          value={formatPercent(stats?.winRate ?? 0)}
          icon={<BarChart2 size={16} />}
          accent={stats && stats.winRate >= 50 ? 'green' : 'yellow'}
          subtext={`${stats?.greens ?? 0}W / ${stats?.reds ?? 0}L`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total"
          value={String(stats?.totalSignals ?? 0)}
          icon={<Zap size={16} />}
          subtext="sinais"
        />
        <StatCard
          label="Greens"
          value={String(stats?.greens ?? 0)}
          icon={<CheckCircle size={16} />}
          accent="green"
        />
        <StatCard
          label="Reds"
          value={String(stats?.reds ?? 0)}
          icon={<XCircle size={16} />}
          accent="red"
        />
        <StatCard
          label="Pendentes"
          value={String(stats?.pending ?? 0)}
          icon={<Clock size={16} />}
          accent="yellow"
        />
        <StatCard
          label="Stake Atual"
          value={formatCurrency(currentStake)}
          icon={<Percent size={16} />}
          accent="blue"
          subtext={`${settings?.stake_percentage ?? 2}% da banca`}
        />
      </div>

      {/* Pending signals */}
      {(pendingSignals.length > 0 || reviewSignals.length > 0) && (
        <Card>
          <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              Aguardando resultado
            </h2>
            <div className="flex items-center gap-2">
              {reviewSignals.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 bg-orange-400/10 text-orange-400 border border-orange-400/20 rounded-md">
                  {reviewSignals.length} revisar
                </span>
              )}
              <span className="text-xs font-mono text-gray-600">
                {pendingSignals.length + reviewSignals.length} sinais
              </span>
            </div>
          </div>
          <SignalTable signals={[...reviewSignals, ...pendingSignals]} />
        </Card>
      )}

      {/* Bankroll chart */}
      {chartData.length > 2 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-300">Evolução da Banca</h2>
            <span className="text-xs font-mono text-gray-600">{bankrollHistory.length} movimentos</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bancaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d084" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00d084" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#242430"
                tick={{ fill: '#444', fontSize: 10 }}
                tickLine={false}
              />
              <YAxis
                stroke="#242430"
                tick={{ fill: '#444', fontSize: 10 }}
                tickFormatter={(v: number) => `R$${v.toFixed(0)}`}
                width={56}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#111118',
                  border: '1px solid #2e2e3a',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [formatCurrency(v), 'Banca']}
                labelStyle={{ color: '#888' }}
              />
              <Area
                type="monotone"
                dataKey="banca"
                stroke="#00d084"
                strokeWidth={2}
                fill="url(#bancaGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#00d084' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* All recent signals */}
      <Card>
        <div className="px-4 py-3 border-b border-dark-600 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Sinais Recentes</h2>
          <span className="text-xs font-mono text-gray-600">{recentSignals.length} de {signals.length}</span>
        </div>
        <SignalTable
          signals={recentSignals}
          emptyMessage='Nenhum sinal ainda. Clique em "Novo Sinal" para começar ou envie uma imagem para o bot.'
        />
      </Card>
    </div>
  )
}
