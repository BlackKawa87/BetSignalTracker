import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Target, DollarSign, Zap,
  CheckCircle, Clock, Plus, RefreshCw, AlertTriangle,
  Percent, Radio,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useApp } from '../contexts/AppContext'
import { StatCard } from '../components/dashboard/StatCard'
import { SignalTable } from '../components/dashboard/SignalTable'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
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
      caption_text: null,
      ai_raw_json: null,
      image_url: null,
      telegram_file_id: null,
      source_type: 'text',
      forwarded_from: null,
      stake_percentage_from_signal: null,
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
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--color-text-muted)' }}>
        <RefreshCw size={18} className="animate-spin mr-2" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  const pendingSignals = signals.filter((s) => s.status === 'pending')
  const reviewSignals  = signals.filter((s) => s.status === 'needs_review')
  const recentSignals  = signals.slice(0, 30)
  const currentStake   = calculateStake(settings?.current_bankroll ?? 0, settings?.stake_percentage ?? 2)
  const profitLoss     = stats?.totalProfitLoss ?? 0
  const profitPositive = profitLoss >= 0

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
      <PageHeader
        title="Central de Sinais"
        subtitle="Acompanhe suas entradas recebidas pelo Telegram, controle sua banca e monitore seus resultados em tempo real."
        actions={
          <>
            <button
              onClick={refreshAll}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
              title="Atualizar"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-brand text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm"
            >
              <Plus size={15} />
              Novo Sinal
            </button>
          </>
        }
      />

      {/* Add signal form */}
      {showAddForm && (
        <Card className="p-4 animate-fade-in">
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            Cole o texto do sinal recebido:
          </p>
          <textarea
            value={signalText}
            onChange={(e) => setSignalText(e.target.value)}
            placeholder="Ex: SINAL: Ambas Marcam SIM — Flamengo x Palmeiras — Odd 1.75"
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm placeholder-[color:var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none font-mono border"
            style={{
              background: 'var(--color-input-bg)',
              borderColor: 'var(--color-input-border)',
              color: 'var(--color-text-primary)',
            }}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Stake automática:{' '}
              <span className="font-mono font-semibold text-brand">{formatCurrency(currentStake)}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(false); setSignalText('') }}
                className="px-3 py-1.5 text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddSignal}
                disabled={!signalText.trim() || adding}
                className="px-4 py-1.5 bg-brand text-white font-semibold rounded-lg text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {adding ? 'Salvando...' : 'Salvar Sinal'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Needs review alert */}
      {reviewSignals.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-400/5 dark:border-orange-400/20">
          <AlertTriangle size={15} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700 dark:text-orange-300">
            <strong>{reviewSignals.length}</strong> sinal{reviewSignals.length > 1 ? 'is precisam' : ' precisa'} de revisão.
            Vá para <strong>Revisão de Sinais</strong> para preencher os dados faltantes.
          </p>
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Banca Atual"
          value={formatCurrency(stats?.currentBankroll ?? 0)}
          icon={<DollarSign size={16} />}
          accent={stats && stats.currentBankroll >= stats.initialBankroll ? 'green' : 'red'}
          subtext={`Inicial: ${formatCurrency(stats?.initialBankroll ?? 0)}`}
        />
        <StatCard
          label="Lucro / Prejuízo"
          value={`${profitPositive ? '+' : ''}${formatCurrency(profitLoss)}`}
          icon={profitPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={profitPositive ? 'green' : 'red'}
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
          icon={<CheckCircle size={16} />}
          accent={stats && stats.winRate >= 50 ? 'green' : 'yellow'}
          subtext={`${stats?.greens ?? 0}W / ${stats?.reds ?? 0}L`}
        />
        <StatCard
          label="Stake Recomendada"
          value={formatCurrency(currentStake)}
          icon={<Percent size={16} />}
          accent="blue"
          subtext={`${settings?.stake_percentage ?? 2}% da banca`}
        />
        <StatCard
          label="Pendentes"
          value={String(stats?.pending ?? 0)}
          icon={<Clock size={16} />}
          accent={stats && (stats.pending ?? 0) > 0 ? 'yellow' : 'default'}
          subtext="aguardando resultado"
        />
      </div>

      {/* Pending + review signals */}
      {(pendingSignals.length > 0 || reviewSignals.length > 0) && (
        <Card>
          <div
            className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex items-center gap-2">
              <Radio size={14} className="text-amber-500" />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Aguardando resultado
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {reviewSignals.length > 0 && (
                <span className="text-xs font-mono px-2 py-0.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-md dark:bg-orange-400/10 dark:text-orange-400 dark:border-orange-400/20">
                  {reviewSignals.length} p/ revisar
                </span>
              )}
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
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
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Evolução da Banca
            </h2>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {bankrollHistory.length} movimentos
            </span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bancaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#00d084" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d084" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="transparent" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickLine={false} />
              <YAxis stroke="transparent" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} tickFormatter={(v: number) => `R$${v.toFixed(0)}`} width={56} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [formatCurrency(v), 'Banca']}
                labelStyle={{ color: 'var(--color-text-muted)' }}
              />
              <Area type="monotone" dataKey="banca" stroke="#00d084" strokeWidth={2} fill="url(#bancaGrad)" dot={false} activeDot={{ r: 4, fill: '#00d084' }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Recent signals */}
      <Card>
        <div
          className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Sinais Recebidos
          </h2>
          <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
            {recentSignals.length} de {signals.length}
          </span>
        </div>
        {signals.length === 0 ? (
          <EmptyState
            icon={<Zap size={20} />}
            title="Nenhum sinal recebido ainda."
            description="Encaminhe uma aposta do Telegram para o seu bot e ela aparecerá aqui automaticamente."
          />
        ) : (
          <SignalTable signals={recentSignals} />
        )}
      </Card>
    </div>
  )
}
