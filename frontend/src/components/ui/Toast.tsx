import { CheckCircle, XCircle, Info } from 'lucide-react'
import { useApp } from '../../contexts/AppContext'

export function ToastStack() {
  const { toasts } = useApp()

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border animate-fade-in
            ${t.type === 'success' ? 'bg-accent-green/10 border-accent-green/30 text-accent-green' : ''}
            ${t.type === 'error' ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' : ''}
            ${t.type === 'info' ? 'bg-dark-700 border-dark-500 text-gray-300' : ''}
          `}
        >
          {t.type === 'success' && <CheckCircle size={16} />}
          {t.type === 'error' && <XCircle size={16} />}
          {t.type === 'info' && <Info size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  )
}
