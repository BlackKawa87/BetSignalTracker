import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-dark-800 border border-dark-600 rounded-xl ${onClick ? 'cursor-pointer hover:border-dark-400 transition-colors' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
