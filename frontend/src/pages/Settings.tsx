import { useState, useEffect } from 'react'
import { Save, Bot, DollarSign, Percent, Zap, Building } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { formatCurrency, calculateStake } from '../utils/helpers'

export function SettingsPage() {
  const { settings, updateSettings } = useApp()
  const [form, setForm] = useState({
    initial_bankroll: '',
    current_bankroll: '',
    stake_percentage: '',
    preferred_bookmaker: '',
    main_strategy: '',
    telegram_bot_token: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        initial_bankroll: String(settings.initial_bankroll),
        current_bankroll: String(settings.current_bankroll),
        stake_percentage: String(settings.stake_percentage),
        preferred_bookmaker: settings.preferred_bookmaker,
        main_strategy: settings.main_strategy,
        telegram_bot_token: settings.telegram_bot_token ?? '',
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    await updateSettings({
      initial_bankroll: parseFloat(form.initial_bankroll) || 0,
      current_bankroll: parseFloat(form.current_bankroll) || 0,
      stake_percentage: parseFloat(form.stake_percentage) || 2,
      preferred_bookmaker: form.preferred_bookmaker,
      main_strategy: form.main_strategy,
      telegram_bot_token: form.telegram_bot_token || null,
    })
    setSaving(false)
  }

  const stakePreview = calculateStake(
    parseFloat(form.current_bankroll) || 0,
    parseFloat(form.stake_percentage) || 2,
  )

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerencie sua banca e preferências</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <DollarSign size={14} className="text-accent-green" /> Gestão de Banca
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-gray-500 font-mono mb-1 block">Banca Inicial (R$)</span>
            <input
              type="number"
              value={form.initial_bankroll}
              onChange={set('initial_bankroll')}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400 font-mono"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 font-mono mb-1 block">Banca Atual (R$)</span>
            <input
              type="number"
              value={form.current_bankroll}
              onChange={set('current_bankroll')}
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400 font-mono"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs text-gray-500 font-mono mb-1 flex items-center gap-1">
            <Percent size={12} /> Porcentagem da Stake (%)
          </span>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="20"
            value={form.stake_percentage}
            onChange={set('stake_percentage')}
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400 font-mono"
          />
          {stakePreview > 0 && (
            <p className="text-xs text-gray-600 mt-1">
              Stake por sinal: <span className="text-accent-green font-mono">{formatCurrency(stakePreview)}</span>
            </p>
          )}
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Zap size={14} className="text-accent-yellow" /> Estratégia e Preferências
        </h2>

        <label className="block">
          <span className="text-xs text-gray-500 font-mono mb-1 flex items-center gap-1">
            <Building size={12} /> Casa de Aposta Preferida
          </span>
          <input
            type="text"
            value={form.preferred_bookmaker}
            onChange={set('preferred_bookmaker')}
            placeholder="Ex: Bet365"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400"
          />
        </label>

        <label className="block">
          <span className="text-xs text-gray-500 font-mono mb-1 block">Estratégia Principal</span>
          <input
            type="text"
            value={form.main_strategy}
            onChange={set('main_strategy')}
            placeholder="Ex: Ambas Marcam"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400"
          />
        </label>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <Bot size={14} className="text-blue-400" /> Integração Telegram
        </h2>
        <p className="text-xs text-gray-500 leading-relaxed">
          Configure seu bot do Telegram para receber sinais automaticamente. Crie um bot via{' '}
          <span className="text-blue-400">@BotFather</span> e cole o token abaixo. Em seguida,
          encaminhe os sinais para o bot ou adicione-o a um grupo onde você coloca os sinais.
        </p>
        <label className="block">
          <span className="text-xs text-gray-500 font-mono mb-1 block">Bot Token</span>
          <input
            type="password"
            value={form.telegram_bot_token}
            onChange={set('telegram_bot_token')}
            placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
            className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400 font-mono"
          />
        </label>
        <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-300 font-semibold mb-1">Como usar:</p>
          <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
            <li>Crie o bot via @BotFather no Telegram</li>
            <li>Cole o token acima e salve</li>
            <li>No backend, configure o webhook para: <code className="text-gray-300">POST /api/telegram/webhook</code></li>
            <li>Encaminhe sinais recebidos em grupos para o seu bot</li>
            <li>Os sinais aparecem automaticamente no dashboard</li>
          </ol>
        </div>
      </Card>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-accent-green text-dark-900 font-semibold rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-40"
      >
        <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
      </button>
    </div>
  )
}
