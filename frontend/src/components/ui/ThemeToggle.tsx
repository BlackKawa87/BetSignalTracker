import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="p-2 rounded-lg transition-colors text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-nav-hover-bg)]"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
