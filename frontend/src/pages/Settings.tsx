import { useState, useEffect } from 'react'
import {
  Save, Bot, DollarSign, Percent, Zap, Building, Link2,
  CheckCircle, XCircle, RefreshCw, Download, Trash2,
  AlertTriangle, Database, Eye, EyeOff, FlaskConical,
} from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { supabase } from '../utils/supabase'
import { Card } from '../components/ui/Card'
import { formatCurrency, calculateStake } from '../utils/helpers'
import {
  exportSignalsCsv, exportSignalsJson,
  exportBankrollCsv, exportFullBackupJson, exportAnalyticsCsv,
} from '../utils/export'

// ── Shared input style ────────────────────────────────────────

const INPUT = 'w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400 font-mono'
const LABEL = 'text-xs text-gray-500 font-mono mb-1 block'
const SECTION_TITLE = 'text-sm font-semibold text-gray-300 flex items-center gap-2 mb-4'

// ── Section: Bankroll ─────────────────────────────────────────

function BankrollSection({
  form, setForm, onResetBankroll, resetting,
}: {
  form: Record<string, string>
  setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>
  onResetBankroll: () => Promise<void>
  resetting: boolean
}) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }))

  const stakePreview = calculateStake(
    parseFloat(form.current_bankroll) || 0,
    parseFloat(form.stake_percentage) || 2,
  )

  const initialBankroll = parseFloat(form.initial_bankroll) || 0
  const currentBankroll = parseFloat(form.current_bankroll) || 0
  const plTotal = Math.round((currentBankroll - initialBankroll) * 100) / 100
  const plPct   = initialBankroll > 0 ? (plTotal / initialBankroll) * 100 : 0

  return (
    <Card className="p-5 space-y-4">
      <h2 className={SECTION_TITLE}><DollarSign size={14} className="text-accent-green" /> Gestão de Banca</h2>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={LABEL}>Banca Inicial (R$)</span>
          <input type="number" value={form.initial_bankroll} onChange={set('initial_bankroll')} className={INPUT} />
        </label>
        <label className="block">
          <span className={LABEL}>Banca Atual (R$)</span>
          <input type="number" value={form.current_bankroll} onChange={set('current_bankroll')} className={INPUT} />
        </label>
      </div>

      {initialBankroll > 0 && currentBankroll > 0 && (
        <div className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-lg">
          <div>
            <p className="text-[10px] text-gray-600 font-mono uppercase">P&L Total</p>
            <p className={`text-base font-bold font-mono ${plTotal >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {plTotal >= 0 ? '+' : ''}{formatCurrency(plTotal)}
            </p>
          </div>
          <div className="w-px h-8 bg-dark-600" />
          <div>
            <p className="text-[10px] text-gray-600 font-mono uppercase">ROI</p>
            <p className={`text-base font-bold font-mono ${plPct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {plPct >= 0 ? '+' : ''}{plPct.toFixed(2)}%
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={onResetBankroll}
              disabled={resetting || currentBankroll === initialBankroll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-dark-500 text-gray-500 hover:text-yellow-400 hover:border-yellow-400/30 rounded-lg transition-colors disabled:opacity-30"
            >
              <RefreshCw size={12} className={resetting ? 'animate-spin' : ''} />
              {resetting ? 'Resetando...' : 'Resetar para inicial'}
            </button>
          </div>
        </div>
      )}

      <label className="block">
        <span className={LABEL}><Percent size={11} className="inline mr-1" />Stake por sinal (%)</span>
        <input type="number" step="0.5" min="0.5" max="20" value={form.stake_percentage} onChange={set('stake_percentage')} className={INPUT} />
        {stakePreview > 0 && (
          <p className="text-xs text-gray-600 mt-1">
            → Stake por aposta: <span className="text-accent-green font-mono">{formatCurrency(stakePreview)}</span>
          </p>
        )}
      </label>
    </Card>
  )
}

// ── Section: Strategy ─────────────────────────────────────────

function StrategySection({ form, setForm }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }))

  return (
    <Card className="p-5 space-y-4">
      <h2 className={SECTION_TITLE}><Zap size={14} className="text-accent-yellow" /> Estratégia e Preferências</h2>

      <label className="block">
        <span className={LABEL}><Building size={11} className="inline mr-1" />Casa de Aposta Preferida</span>
        <input type="text" value={form.preferred_bookmaker} onChange={set('preferred_bookmaker')} placeholder="Ex: Bet365" className={INPUT} />
      </label>

      <label className="block">
        <span className={LABEL}>Estratégia Principal</span>
        <input type="text" value={form.main_strategy} onChange={set('main_strategy')} placeholder="Ex: Ambas Marcam" className={INPUT} />
      </label>
    </Card>
  )
}

// ── Section: Telegram ─────────────────────────────────────────

function TelegramSection({ form, setForm }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }))

  const [showToken,     setShowToken]     = useState(false)
  const [testResult,    setTestResult]    = useState<{ ok: boolean; info?: string } | null>(null)
  const [testing,       setTesting]       = useState(false)
  const [settingWh,     setSettingWh]     = useState(false)
  const [whResult,      setWhResult]      = useState<string | null>(null)

  const deployUrl = form.deploy_url?.trim()
  const webhookUrl = deployUrl ? `${deployUrl.replace(/\/$/, '')}/api/telegram/webhook` : ''

  const testTelegram = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/telegram/info')
      const data = await res.json() as { ok?: boolean; result?: { url?: string } }
      if (data.ok) {
        const configured = !!data.result?.url
        setTestResult({
          ok: configured,
          info: configured
            ? `Webhook ativo: ${data.result?.url}`
            : 'Conectado ao bot, mas webhook não configurado ainda.',
        })
      } else {
        setTestResult({ ok: false, info: 'Não foi possível conectar. Verifique o token.' })
      }
    } catch {
      setTestResult({ ok: false, info: 'Erro de rede — verifique o deploy.' })
    }
    setTesting(false)
  }

  const configureWebhook = async () => {
    if (!deployUrl) return
    setSettingWh(true)
    setWhResult(null)
    try {
      const res  = await fetch(`/api/telegram/set-webhook?url=${encodeURIComponent(deployUrl)}`)
      const data = await res.json() as { telegram_response?: { ok?: boolean } }
      const ok   = data.telegram_response?.ok === true
      setWhResult(ok ? `✅ Webhook configurado: ${webhookUrl}` : `❌ Falha: ${JSON.stringify(data)}`)
    } catch (e) {
      setWhResult(`❌ Erro: ${String(e)}`)
    }
    setSettingWh(false)
  }

  return (
    <Card className="p-5 space-y-4">
      <h2 className={SECTION_TITLE}><Bot size={14} className="text-blue-400" /> Integração Telegram</h2>

      <p className="text-xs text-gray-500 leading-relaxed">
        Crie um bot via <span className="text-blue-400 font-mono">@BotFather</span>, adicione o token abaixo.
        O token é salvo criptografado no Supabase — nunca é exposto no frontend.
      </p>

      <label className="block">
        <span className={LABEL}>Bot Token</span>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={form.telegram_bot_token}
            onChange={set('telegram_bot_token')}
            placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
            className={INPUT + ' pr-9'}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">
          ⚠️ O token também deve ser configurado como <span className="text-gray-400 font-mono">TELEGRAM_BOT_TOKEN</span> nas variáveis de ambiente da Vercel.
        </p>
      </label>

      <label className="block">
        <span className={LABEL}><Link2 size={11} className="inline mr-1" />URL do Deploy (Vercel)</span>
        <input
          type="url"
          value={form.deploy_url}
          onChange={set('deploy_url')}
          placeholder="https://betsignaltracker.vercel.app"
          className={INPUT}
        />
        {webhookUrl && (
          <p className="text-[10px] text-gray-600 mt-1">
            Webhook URL: <span className="text-gray-400 font-mono break-all">{webhookUrl}</span>
          </p>
        )}
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={testTelegram}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dark-500 text-gray-400 hover:text-blue-400 hover:border-blue-400/30 rounded-lg transition-colors disabled:opacity-40"
        >
          {testing ? <RefreshCw size={12} className="animate-spin" /> : <Bot size={12} />}
          {testing ? 'Testando...' : 'Testar conexão'}
        </button>

        <button
          onClick={configureWebhook}
          disabled={settingWh || !deployUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-dark-500 text-gray-400 hover:text-accent-green hover:border-accent-green/30 rounded-lg transition-colors disabled:opacity-40"
        >
          {settingWh ? <RefreshCw size={12} className="animate-spin" /> : <Link2 size={12} />}
          {settingWh ? 'Configurando...' : 'Configurar Webhook'}
        </button>
      </div>

      {testResult && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${testResult.ok ? 'bg-accent-green/5 border border-accent-green/20 text-accent-green' : 'bg-accent-red/5 border border-accent-red/20 text-accent-red'}`}>
          {testResult.ok ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5" /> : <XCircle size={13} className="flex-shrink-0 mt-0.5" />}
          {testResult.info}
        </div>
      )}

      {whResult && (
        <div className={`p-3 rounded-lg text-xs font-mono break-all ${whResult.startsWith('✅') ? 'bg-accent-green/5 border border-accent-green/20 text-accent-green' : 'bg-accent-red/5 border border-accent-red/20 text-accent-red'}`}>
          {whResult}
        </div>
      )}
    </Card>
  )
}

// ── Section: Export ───────────────────────────────────────────

function ExportSection() {
  const { signals, bankrollHistory } = useApp()

  return (
    <Card className="p-5">
      <h2 className={SECTION_TITLE}><Download size={14} className="text-purple-400" /> Exportar Dados</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'Sinais — CSV', sub: `${signals.length} registros`,  action: () => exportSignalsCsv(signals),        color: 'green' },
          { label: 'Sinais — JSON', sub: `${signals.length} registros`, action: () => exportSignalsJson(signals),       color: 'green' },
          { label: 'Banca — CSV',  sub: `${bankrollHistory.length} entradas`, action: () => exportBankrollCsv(bankrollHistory), color: 'blue' },
          { label: 'Analytics — CSV', sub: 'Resumo por mercado',        action: () => exportAnalyticsCsv(signals),     color: 'purple' },
          {
            label: 'Backup Completo — JSON',
            sub: 'Sinais + histórico de banca',
            action: () => exportFullBackupJson({ signals, bankrollHistory, exportedAt: new Date().toISOString() }),
            color: 'yellow',
          },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-3 p-3 bg-dark-700/50 border border-dark-500 hover:border-dark-400 rounded-lg transition-colors text-left group"
          >
            <Download size={14} className={`text-${item.color}-400 flex-shrink-0`} />
            <div>
              <p className="text-sm text-gray-200 font-medium">{item.label}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">{item.sub}</p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}

// ── Section: Demo ─────────────────────────────────────────────

function DemoSection() {
  const { refreshAll } = useApp()
  const [seeding,  setSeeding]  = useState(false)
  const [clearing, setClearing] = useState(false)
  const [result,   setResult]   = useState<string | null>(null)

  const seed = async () => {
    setSeeding(true)
    setResult(null)
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' })
      const data = await res.json() as { ok?: boolean; signals?: number; bankrollHistory?: number; error?: string }
      if (data.ok) {
        setResult(`✅ ${data.signals} sinais demo inseridos + ${data.bankrollHistory} entradas de banca`)
        await refreshAll()
      } else {
        setResult(`❌ ${data.error ?? 'Erro desconhecido'}`)
      }
    } catch (e) { setResult(`❌ ${String(e)}`) }
    setSeeding(false)
  }

  const clearDemo = async () => {
    setClearing(true)
    setResult(null)
    try {
      const res = await fetch('/api/demo/clear', { method: 'DELETE' })
      const data = await res.json() as { ok?: boolean; deleted?: number; error?: string }
      if (data.ok) {
        setResult(`✅ ${data.deleted} sinais demo removidos`)
        await refreshAll()
      } else {
        setResult(`❌ ${data.error ?? 'Erro desconhecido'}`)
      }
    } catch (e) { setResult(`❌ ${String(e)}`) }
    setClearing(false)
  }

  return (
    <Card className="p-5">
      <h2 className={SECTION_TITLE}><FlaskConical size={14} className="text-cyan-400" /> Modo Demo</h2>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Popula o sistema com 30 sinais fictícios (greens, reds, pendentes, needs_review) para
        testar analytics e o dashboard sem dados reais. Sinais demo são marcados com <span className="text-gray-300 font-mono">[DEMO]</span> nas notas.
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={seed}
          disabled={seeding}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/20 rounded-lg transition-colors disabled:opacity-40"
        >
          {seeding ? <RefreshCw size={13} className="animate-spin" /> : <Database size={13} />}
          {seeding ? 'Inserindo...' : 'Inserir dados demo'}
        </button>
        <button
          onClick={clearDemo}
          disabled={clearing}
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-dark-500 text-gray-500 hover:text-orange-400 hover:border-orange-400/30 rounded-lg transition-colors disabled:opacity-40"
        >
          {clearing ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
          {clearing ? 'Limpando...' : 'Limpar dados demo'}
        </button>
      </div>
      {result && (
        <p className={`text-xs mt-3 font-mono ${result.startsWith('✅') ? 'text-accent-green' : 'text-accent-red'}`}>{result}</p>
      )}
    </Card>
  )
}

// ── Section: Danger Zone ──────────────────────────────────────

function DangerZone() {
  const { refreshAll } = useApp()
  const [confirm1, setConfirm1] = useState(false)
  const [confirm2, setConfirm2] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [result,   setResult]   = useState<string | null>(null)

  const clearAll = async () => {
    if (!confirm1) { setConfirm1(true); setTimeout(() => setConfirm1(false), 5000); return }
    if (!confirm2) { setConfirm2(true); setTimeout(() => setConfirm2(false), 5000); return }

    setDeleting(true)
    setResult(null)
    try {
      const res  = await fetch('/api/demo/all', { method: 'DELETE' })
      const data = await res.json() as { ok?: boolean; deleted?: number; error?: string }
      if (data.ok) {
        setResult(`✅ ${data.deleted} sinais removidos. Configurações mantidas.`)
        await refreshAll()
      } else {
        setResult(`❌ ${data.error ?? 'Erro'}`)
      }
    } catch (e) { setResult(`❌ ${String(e)}`) }
    setDeleting(false)
    setConfirm1(false)
    setConfirm2(false)
  }

  const label = !confirm1 ? 'Apagar todos os dados'
    : !confirm2 ? '⚠️ Tem certeza? Clique de novo'
    : '🚨 Clique para confirmar — IRREVERSÍVEL'

  return (
    <Card className="p-5 border-accent-red/20">
      <h2 className={SECTION_TITLE}><AlertTriangle size={14} className="text-accent-red" /> Zona de Perigo</h2>
      <p className="text-xs text-gray-500 mb-4">
        Remove <strong className="text-gray-300">todos os sinais e histórico de banca</strong>.
        Configurações são mantidas. Requer 3 cliques.
      </p>
      <button
        onClick={clearAll}
        disabled={deleting}
        className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all ${
          confirm2 ? 'bg-red-500/20 border border-red-500/50 text-red-400'
          : confirm1 ? 'bg-orange-500/10 border border-orange-500/30 text-orange-400'
          : 'border border-dark-500 text-gray-600 hover:text-red-400 hover:border-red-400/30'
        }`}
      >
        {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
        {deleting ? 'Apagando...' : label}
      </button>
      {result && (
        <p className={`text-xs mt-3 font-mono ${result.startsWith('✅') ? 'text-accent-green' : 'text-accent-red'}`}>{result}</p>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, updateSettings } = useApp()
  const [form, setForm] = useState<Record<string, string>>({
    initial_bankroll:    '',
    current_bankroll:    '',
    stake_percentage:    '',
    preferred_bookmaker: '',
    main_strategy:       '',
    telegram_bot_token:  '',
    deploy_url:          '',
  })
  const [saving,    setSaving]    = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        initial_bankroll:    String(settings.initial_bankroll),
        current_bankroll:    String(settings.current_bankroll),
        stake_percentage:    String(settings.stake_percentage),
        preferred_bookmaker: settings.preferred_bookmaker,
        main_strategy:       settings.main_strategy,
        telegram_bot_token:  settings.telegram_bot_token ?? '',
        deploy_url:          '',
      })
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    await updateSettings({
      initial_bankroll:    parseFloat(form.initial_bankroll)    || 0,
      current_bankroll:    parseFloat(form.current_bankroll)    || 0,
      stake_percentage:    parseFloat(form.stake_percentage)    || 2,
      preferred_bookmaker: form.preferred_bookmaker,
      main_strategy:       form.main_strategy,
      telegram_bot_token:  form.telegram_bot_token || null,
    })
    setSaving(false)
  }

  const handleResetBankroll = async () => {
    const initial = parseFloat(form.initial_bankroll) || 0
    if (!initial) return
    setResetting(true)
    await updateSettings({ current_bankroll: initial })
    setForm((p) => ({ ...p, current_bankroll: String(initial) }))

    // Add bankroll history entry for the reset
    const { data: settingsRow } = await supabase.from('settings').select('id').limit(1).single()
    if (settingsRow) {
      await supabase.from('bankroll_history').insert({
        bankroll: initial,
        change: 0,
        reason: 'Reset manual da banca para valor inicial',
        signal_id: null,
      })
    }
    setResetting(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-500 text-sm mt-0.5">Gerencie banca, estratégia e integrações</p>
      </div>

      <BankrollSection   form={form} setForm={setForm} onResetBankroll={handleResetBankroll} resetting={resetting} />
      <StrategySection   form={form} setForm={setForm} />
      <TelegramSection   form={form} setForm={setForm} />
      <ExportSection />
      <DemoSection />

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-2.5 bg-accent-green text-dark-900 font-semibold rounded-lg hover:bg-accent-green/90 transition-colors disabled:opacity-40"
      >
        <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Configurações'}
      </button>

      <DangerZone />
    </div>
  )
}
