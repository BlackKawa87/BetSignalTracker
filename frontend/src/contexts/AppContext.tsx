import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase } from '../utils/supabase'
import { Signal, Settings, BankrollHistory, DashboardStats } from '../types'
import { calculateStats, calculateGreenProfit } from '../utils/helpers'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppContextValue {
  settings: Settings | null
  signals: Signal[]
  bankrollHistory: BankrollHistory[]
  stats: DashboardStats | null
  loading: boolean
  toasts: Toast[]
  showToast: (message: string, type?: Toast['type']) => void
  refreshSignals: () => Promise<void>
  updateSettings: (data: Partial<Settings>) => Promise<void>
  addSignal: (signal: Omit<Signal, 'id' | 'created_at'>) => Promise<void>
  markGreen: (signal: Signal) => Promise<void>
  markRed: (signal: Signal) => Promise<void>
  markVoid: (signal: Signal) => Promise<void>
  deleteSignal: (id: string) => Promise<void>
  updateSignalNotes: (id: string, notes: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'updated_at'> = {
  initial_bankroll: 1000,
  current_bankroll: 1000,
  stake_percentage: 2,
  preferred_bookmaker: 'Bet365',
  main_strategy: 'Ambas Marcam',
  telegram_bot_token: null,
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [signals, setSignals] = useState<Signal[]>([])
  const [bankrollHistory, setBankrollHistory] = useState<BankrollHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code === 'PGRST116') {
      const { data: created, error: createError } = await supabase
        .from('settings')
        .insert({ ...DEFAULT_SETTINGS })
        .select()
        .single()
      if (!createError && created) setSettings(created)
    } else if (!error && data) {
      setSettings(data)
    }
  }, [])

  const refreshSignals = useCallback(async () => {
    const { data, error } = await supabase
      .from('signals')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setSignals(data)
  }, [])

  const loadBankrollHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('bankroll_history')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(90)
    if (!error && data) setBankrollHistory(data)
  }, [])

  useEffect(() => {
    Promise.all([loadSettings(), refreshSignals(), loadBankrollHistory()]).finally(() =>
      setLoading(false),
    )
  }, [loadSettings, refreshSignals, loadBankrollHistory])

  const updateSettings = useCallback(
    async (data: Partial<Settings>) => {
      if (!settings) return
      const { data: updated, error } = await supabase
        .from('settings')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', settings.id)
        .select()
        .single()
      if (!error && updated) {
        setSettings(updated)
        showToast('Configurações salvas!', 'success')
      } else {
        showToast('Erro ao salvar configurações', 'error')
      }
    },
    [settings, showToast],
  )

  const addSignal = useCallback(
    async (signal: Omit<Signal, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('signals').insert(signal)
      if (!error) {
        await refreshSignals()
        showToast('Sinal cadastrado!', 'success')
      } else {
        showToast('Erro ao cadastrar sinal', 'error')
      }
    },
    [refreshSignals, showToast],
  )

  const markGreen = useCallback(
    async (signal: Signal) => {
      if (!settings || signal.status !== 'pending') return
      const odd = signal.odd ?? 2
      const profit = calculateGreenProfit(signal.stake, odd)
      const newBankroll = settings.current_bankroll + profit

      const { error } = await supabase
        .from('signals')
        .update({ status: 'green', profit_loss: profit })
        .eq('id', signal.id)
      if (error) { showToast('Erro ao marcar green', 'error'); return }

      await supabase.from('settings').update({ current_bankroll: newBankroll, updated_at: new Date().toISOString() }).eq('id', settings.id)
      await supabase.from('bankroll_history').insert({
        bankroll: newBankroll,
        change: profit,
        reason: `Green: ${signal.home_team} x ${signal.away_team}`,
        signal_id: signal.id,
      })

      setSettings((prev) => prev ? { ...prev, current_bankroll: newBankroll } : prev)
      await refreshSignals()
      await loadBankrollHistory()
      showToast(`Green! +${profit.toFixed(2)}`, 'success')
    },
    [settings, refreshSignals, loadBankrollHistory, showToast],
  )

  const markRed = useCallback(
    async (signal: Signal) => {
      if (!settings || signal.status !== 'pending') return
      const loss = -signal.stake
      const newBankroll = settings.current_bankroll + loss

      const { error } = await supabase
        .from('signals')
        .update({ status: 'red', profit_loss: loss })
        .eq('id', signal.id)
      if (error) { showToast('Erro ao marcar red', 'error'); return }

      await supabase.from('settings').update({ current_bankroll: newBankroll, updated_at: new Date().toISOString() }).eq('id', settings.id)
      await supabase.from('bankroll_history').insert({
        bankroll: newBankroll,
        change: loss,
        reason: `Red: ${signal.home_team} x ${signal.away_team}`,
        signal_id: signal.id,
      })

      setSettings((prev) => prev ? { ...prev, current_bankroll: newBankroll } : prev)
      await refreshSignals()
      await loadBankrollHistory()
      showToast(`Red. -${signal.stake.toFixed(2)}`, 'error')
    },
    [settings, refreshSignals, loadBankrollHistory, showToast],
  )

  const markVoid = useCallback(
    async (signal: Signal) => {
      const { error } = await supabase
        .from('signals')
        .update({ status: 'void', profit_loss: 0 })
        .eq('id', signal.id)
      if (!error) {
        await refreshSignals()
        showToast('Sinal anulado', 'info')
      }
    },
    [refreshSignals, showToast],
  )

  const deleteSignal = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('signals').delete().eq('id', id)
      if (!error) {
        setSignals((prev) => prev.filter((s) => s.id !== id))
        showToast('Sinal removido', 'info')
      }
    },
    [showToast],
  )

  const updateSignalNotes = useCallback(
    async (id: string, notes: string) => {
      const { error } = await supabase.from('signals').update({ notes }).eq('id', id)
      if (!error) {
        setSignals((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)))
      }
    },
    [],
  )

  const stats =
    settings && signals.length >= 0 ? calculateStats(signals, settings) : null

  return (
    <AppContext.Provider
      value={{
        settings,
        signals,
        bankrollHistory,
        stats,
        loading,
        toasts,
        showToast,
        refreshSignals,
        updateSettings,
        addSignal,
        markGreen,
        markRed,
        markVoid,
        deleteSignal,
        updateSignalNotes,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
