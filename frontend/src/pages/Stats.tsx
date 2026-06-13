import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useApp } from '../contexts/AppContext'
import { Card } from '../components/ui/Card'
import { formatCurrency, formatPercent } from '../utils/helpers'

const COLORS = { green: '#00d084', red: '#ff4757', pending: '#ffd32a', void: '#6b7280' }

export function Stats() {
  const { stats, bankrollHistory, signals } = useApp()

  const bankrollData = bankrollHistory.map((h) => ({
    date: new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    banca: h.bankroll,
  }))

  const pieData = [
    { name: 'Green', value: stats?.greens ?? 0 },
    { name: 'Red', value: stats?.reds ?? 0 },
    { name: 'Pendente', value: stats?.pending ?? 0 },
  ].filter((d) => d.value > 0)

  const marketMap: Record<string, { greens: number; reds: number }> = {}
  signals.forEach((s) => {
    const market = s.market ?? 'Outros'
    if (!marketMap[market]) marketMap[market] = { greens: 0, reds: 0 }
    if (s.status === 'green') marketMap[market].greens++
    if (s.status === 'red') marketMap[market].reds++
  })
  const marketData = Object.entries(marketMap)
    .map(([market, counts]) => ({ market: market.slice(0, 20), ...counts }))
    .sort((a, b) => (b.greens + b.reds) - (a.greens + a.reds))
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
        <p className="text-gray-500 text-sm mt-0.5">Visão geral do desempenho</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Média de Odd', value: (stats?.avgOdd ?? 0).toFixed(2) },
          { label: 'Taxa de Acerto', value: formatPercent(stats?.winRate ?? 0) },
          { label: 'ROI', value: formatPercent(stats?.roi ?? 0) },
          { label: 'Lucro Total', value: formatCurrency(stats?.totalProfitLoss ?? 0) },
          { label: 'Total Sinais', value: String(stats?.totalSignals ?? 0) },
          { label: 'Banca Atual', value: formatCurrency(stats?.currentBankroll ?? 0) },
        ].map(({ label, value }) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-gray-500 font-mono uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-bold font-mono text-white">{value}</p>
          </Card>
        ))}
      </div>

      {bankrollData.length > 1 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Evolução da Banca</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={bankrollData}>
              <XAxis dataKey="date" stroke="#444" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis stroke="#444" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1a24', border: '1px solid #2e2e3a', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Line type="monotone" dataKey="banca" stroke="#00d084" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Distribuição de Resultados</h2>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.name === 'Green' ? COLORS.green : entry.name === 'Red' ? COLORS.red : COLORS.pending} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {marketData.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Mercados por Resultado</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marketData} layout="vertical">
                <XAxis type="number" stroke="#444" tick={{ fill: '#666', fontSize: 11 }} />
                <YAxis dataKey="market" type="category" stroke="#444" tick={{ fill: '#666', fontSize: 10 }} width={100} />
                <Tooltip contentStyle={{ background: '#1a1a24', border: '1px solid #2e2e3a', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="greens" name="Green" fill={COLORS.green} radius={[0, 4, 4, 0]} />
                <Bar dataKey="reds" name="Red" fill={COLORS.red} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  )
}
