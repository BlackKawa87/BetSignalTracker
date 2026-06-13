import { useState } from 'react'
import { X, Save, AlertCircle } from 'lucide-react'
import { Signal, SignalStatus } from '../../types'
import { useApp } from '../../contexts/AppContext'

interface EditSignalModalProps {
  signal: Signal
  onClose: () => void
}

const STATUS_OPTIONS: { value: SignalStatus; label: string }[] = [
  { value: 'pending',      label: 'Pendente' },
  { value: 'needs_review', label: 'Revisar' },
  { value: 'green',        label: 'Green ✓' },
  { value: 'red',          label: 'Red ✗' },
  { value: 'void',         label: 'Void' },
]

export function EditSignalModal({ signal, onClose }: EditSignalModalProps) {
  const { updateSignal } = useApp()
  const [form, setForm] = useState({
    home_team:   signal.home_team   ?? '',
    away_team:   signal.away_team   ?? '',
    market:      signal.market      ?? '',
    odd:         signal.odd != null ? String(signal.odd) : '',
    competition: signal.competition ?? '',
    bookmaker:   signal.bookmaker   ?? '',
    match_time:  signal.match_time  ?? '',
    notes:       signal.notes       ?? '',
    status:      signal.status,
  })
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }))

  const handleSave = async () => {
    setSaving(true)
    await updateSignal(signal.id, {
      home_team:   form.home_team   || null,
      away_team:   form.away_team   || null,
      market:      form.market      || null,
      odd:         form.odd ? parseFloat(form.odd) : null,
      competition: form.competition || null,
      bookmaker:   form.bookmaker   || null,
      match_time:  form.match_time  || null,
      notes:       form.notes       || null,
      status:      form.status as SignalStatus,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-dark-800 border border-dark-500 rounded-xl w-full max-w-lg mx-4 shadow-2xl animate-fade-in">

        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-600">
          <h2 className="text-sm font-semibold text-white">Editar Sinal</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {signal.status === 'needs_review' && (
          <div className="mx-5 mt-4 p-3 bg-orange-400/5 border border-orange-400/20 rounded-lg flex items-start gap-2">
            <AlertCircle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-300/80">
              Este sinal precisa de revisão manual. Preencha os campos faltantes e altere o status para <strong>Pendente</strong>.
            </p>
          </div>
        )}

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Time da Casa</span>
              <input
                value={form.home_team}
                onChange={set('home_team')}
                placeholder="Ex: Flamengo"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Time Visitante</span>
              <input
                value={form.away_team}
                onChange={set('away_team')}
                placeholder="Ex: Palmeiras"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Mercado</span>
              <input
                value={form.market}
                onChange={set('market')}
                placeholder="Ex: Ambas Marcam"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Odd</span>
              <input
                type="number"
                step="0.01"
                min="1"
                value={form.odd}
                onChange={set('odd')}
                placeholder="Ex: 1.85"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400 font-mono"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Campeonato</span>
              <input
                value={form.competition}
                onChange={set('competition')}
                placeholder="Ex: Brasileirão"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Casa de Aposta</span>
              <input
                value={form.bookmaker}
                onChange={set('bookmaker')}
                placeholder="Ex: Bet365"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Horário</span>
              <input
                value={form.match_time}
                onChange={set('match_time')}
                placeholder="Ex: 20:00"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400 font-mono"
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 font-mono mb-1 block">Status</span>
              <select
                value={form.status}
                onChange={set('status')}
                className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-dark-400"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-gray-500 font-mono mb-1 block">Notas</span>
            <textarea
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Observações sobre o sinal..."
              className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400 resize-none"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-dark-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-accent-green text-dark-900 font-semibold rounded-lg text-sm disabled:opacity-40 hover:bg-accent-green/90 transition-colors"
          >
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
