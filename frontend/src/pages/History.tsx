import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import { SignalRow } from '../components/dashboard/SignalRow'
import { Card } from '../components/ui/Card'
import { SignalStatus } from '../types'

const STATUS_FILTERS: { label: string; value: SignalStatus | 'all' }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendentes', value: 'pending' },
  { label: 'Green', value: 'green' },
  { label: 'Red', value: 'red' },
  { label: 'Void', value: 'void' },
]

export function History() {
  const { signals } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<SignalStatus | 'all'>('all')

  const filtered = signals.filter((s) => {
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      (s.home_team ?? '').toLowerCase().includes(q) ||
      (s.away_team ?? '').toLowerCase().includes(q) ||
      (s.market ?? '').toLowerCase().includes(q) ||
      (s.competition ?? '').toLowerCase().includes(q) ||
      s.raw_text.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Histórico de Sinais</h1>
        <p className="text-gray-500 text-sm mt-0.5">{signals.length} sinais no total</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por time, mercado, campeonato..."
            className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-dark-400"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-gray-500 mr-1" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs rounded-lg font-mono transition-colors ${
                statusFilter === f.value
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
                  : 'text-gray-500 hover:text-gray-300 border border-dark-600 hover:border-dark-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-600 text-sm">
            Nenhum sinal encontrado.
          </div>
        ) : (
          <div>
            {filtered.map((s) => (
              <SignalRow key={s.id} signal={s} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
