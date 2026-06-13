import { useState } from 'react'
import {
  TrendingUp, TrendingDown, Target, DollarSign, Zap,
  CheckCircle, XCircle, Clock, Plus, RefreshCw,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { StatCard } from '../components/dashboard/StatCard'
import { SignalRow } from '../components/dashboard/SignalRow'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatPercent, calculateStake } from '../utils/helpers'
import { parseSignal } from '../utils/signalParser'

export function Dashboard() {
  const { stats, signals, settings, addSignal, refreshSignals, loading } = useApp()
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
      odd: parsed.odd,
      competition: parsed.competition,
      bookmaker: parsed.bookmaker ?? settings.preferred_bookmaker,
      match_time: parsed.match_time,
      stake,
      status: 'pending',
      profit_loss: null,
      raw_text: parsed.raw_text,
      telegram_message_id: null,
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

  const pendingSignals = signals.filter((s) => s.status === 'pending')
  const recentSignals = signals.slice(0, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Banca: <span className="text-accent-green font-mono font-bold">
              {formatCurrency(settings?.current_bankroll ?? 0)}
            </span>
            <span className="ml-2 text-gray-600">
              • Stake: {formatCurrency(calculateStake(settings?.current_bankroll ?? 0, settings?.stake_percentage ?? 2))}
              ({settings?.stake_percentage ?? 2}%)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshSignals}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
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

      {showAddForm && (
        <Card className="p-4">
          <p className="text-sm text-gray-400 mb-3 font-medium">Cole o sinal do Telegram:</p>
          <textarea
            value={signalText}
            onChange={(e) => setSignalText(e.target.value)}
            placeholder={`Ex: SINAL: Ambas Marcam SIM - Flamengo x Palmeiras - Odd 1.75`}
            rows={3}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400 resize-none font-mono"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-600">
              Stake automática: <span className="text-accent-green font-mono">
                {formatCurrency(calculateStake(settings?.current_bankroll ?? 0, settings?.stake_percentage ?? 2))}
              </span>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Banca Atual"
          value={formatCurrency(stats?.currentBankroll ?? 0)}
          icon={<DollarSign size={16} />}
          accent={stats && stats.currentBankroll >= stats.initialBankroll ? 'green' : 'red'}
          subtext={`Inicial: ${formatCurrency(stats?.initialBankroll ?? 0)}`}
        />
        <StatCard
          label="Lucro/Prejuízo"
          value={`${stats && stats.totalProfitLoss >= 0 ? '+' : ''}${formatCurrency(stats?.totalProfitLoss ?? 0)}`}
          icon={stats && stats.totalProfitLoss >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={stats && stats.totalProfitLoss >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="ROI"
          value={formatPercent(stats?.roi ?? 0)}
          icon={<Target size={16} />}
          accent={stats && stats.roi >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="Taxa de Acerto"
          value={formatPercent(stats?.winRate ?? 0)}
          icon={<Zap size={16} />}
          accent={stats && stats.winRate >= 50 ? 'green' : 'yellow'}
          subtext={`${stats?.greens ?? 0}W / ${stats?.reds ?? 0}L`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total de Sinais"
          value={String(stats?.totalSignals ?? 0)}
          icon={<Zap size={16} />}
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
      </div>

      {pendingSignals.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-dark-600">
            <h2 className="text-sm font-semibold text-gray-300">
              Aguardando resultado ({pendingSignals.length})
            </h2>
          </div>
          <div>
            {pendingSignals.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="px-4 py-3 border-b border-dark-600">
          <h2 className="text-sm font-semibold text-gray-300">Histórico Recente</h2>
        </div>
        {recentSignals.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-600 text-sm">
            Nenhum sinal ainda. Clique em "Novo Sinal" para começar.
          </div>
        ) : (
          <div>
            {recentSignals.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
