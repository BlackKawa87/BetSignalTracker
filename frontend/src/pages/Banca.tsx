import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Save, RefreshCw, Percent } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { EmptyState } from '../components/ui/EmptyState'
import { StatCard } from '../components/dashboard/StatCard'
import { formatCurrency, formatDate, calculateStake } from '../utils/helpers'

export function BancaPage() {
  const { settings, bankrollHistory, updateSettings } = useApp()
  const [form, setForm] = useState({ initial_bankroll: '', current_bankroll: '', stake_percentage: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        initial_bankroll: String(settings.initial_bankroll),
        current_bankroll: String(settings.current_bankroll),
        stake_percentage: String(settings.stake_percentage),
      })
    }
  }, [settings])

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Gestão de Banca" subtitle="Controle seu capital, defina sua unidade e acompanhe sua evolução com disciplina." />
        <EmptyState icon={<Wallet size={20} />} title="Carregando configurações da banca..." />
      </div>
    )
  }

  const initial = parseFloat(form.initial_bankroll) || 0
  const current = parseFloat(form.current_bankroll) || 0
  const stakePct = parseFloat(form.stake_percentage) || 0
  const pl = Math.round((current - initial) * 100) / 100
  const roi = initial > 0 ? (pl / initial) * 100 : 0
  const stake = calculateStake(current, stakePct)

  const handleSave = async () => {
    setSaving(true)
    await updateSettings({
      initial_bankroll: initial,
      current_bankroll: current,
      stake_percentage: stakePct,
    })
    setSaving(false)
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }))

  const inputCls =
    'w-full rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand transition-colors bg-[color:var(--color-input-bg)] border border-[color:var(--color-input-border)] text-[color:var(--color-text-primary)] placeholder-[color:var(--color-text-muted)]'
  const labelCls = 'text-xs mb-1 block text-[color:var(--color-text-muted)] uppercase tracking-wider font-medium'

  const reversed = [...bankrollHistory].reverse()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Banca"
        subtitle="Controle seu capital, defina sua unidade e acompanhe sua evolução com disciplina."
      />

      {/* Top stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Banca Inicial" value={formatCurrency(initial)} icon={<Wallet size={16} />} />
        <StatCard label="Banca Atual" value={formatCurrency(current)} icon={<Wallet size={16} />} accent="green" />
        <StatCard
          label="Lucro / Prejuízo"
          value={`${pl >= 0 ? '+' : ''}${formatCurrency(pl)}`}
          icon={pl >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={pl >= 0 ? 'green' : 'red'}
        />
        <StatCard
          label="ROI"
          value={`${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`}
          accent={roi >= 0 ? 'green' : 'red'}
        />
        <StatCard label="Stake Atual" value={formatCurrency(stake)} accent="yellow" icon={<Percent size={16} />} />
      </div>

      {/* Settings card */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wallet size={15} className="text-brand" />
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Configuração da Banca</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className={labelCls}>Banca Inicial (R$)</span>
            <input type="number" value={form.initial_bankroll} onChange={set('initial_bankroll')} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Banca Atual (R$)</span>
            <input type="number" value={form.current_bankroll} onChange={set('current_bankroll')} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Stake (%)</span>
            <input type="number" step="0.5" min="0.5" max="20" value={form.stake_percentage} onChange={set('stake_percentage')} className={inputCls} />
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-brand text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
        >
          {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </Card>

      {/* History table */}
      <Card>
        <div className="px-5 py-4 border-b border-[color:var(--color-border)]">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Histórico de Movimentações</h2>
          <p className="text-xs text-[color:var(--color-text-muted)] mt-0.5">
            {bankrollHistory.length} {bankrollHistory.length === 1 ? 'entrada' : 'entradas'}
          </p>
        </div>

        {reversed.length === 0 ? (
          <EmptyState
            icon={<Wallet size={18} />}
            title="Nenhuma movimentação registrada."
            description="Marque sinais como Green ou Red e o histórico da sua banca aparecerá aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)] border-b border-[color:var(--color-border)]">
                  <th className="px-5 py-2 font-medium">Data</th>
                  <th className="px-5 py-2 font-medium">Motivo</th>
                  <th className="px-5 py-2 font-medium text-right">Variação</th>
                  <th className="px-5 py-2 font-medium text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {reversed.map((h) => (
                  <tr key={h.id} className="border-b border-[color:var(--color-border)] last:border-0 hover:bg-[color:var(--color-nav-hover-bg)]">
                    <td className="px-5 py-2.5 text-xs font-mono text-[color:var(--color-text-muted)] whitespace-nowrap">
                      {formatDate(h.created_at)}
                    </td>
                    <td className="px-5 py-2.5 text-[color:var(--color-text-secondary)]">{h.reason}</td>
                    <td className={`px-5 py-2.5 text-right font-mono text-xs ${h.change >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {h.change >= 0 ? '+' : ''}{formatCurrency(h.change)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-xs text-[color:var(--color-text-primary)]">
                      {formatCurrency(h.bankroll)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
