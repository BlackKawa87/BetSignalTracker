import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
}

export function Card({ children, className = '', onClick, hover }: CardProps) {
  const base = 'bg-[color:var(--color-card)] border border-[color:var(--color-border)] rounded-xl shadow-card'
  const interactive = (onClick || hover) ? 'cursor-pointer hover:shadow-card-hover hover:border-[color:var(--color-border-strong)] transition-all duration-150' : ''
  return (
    <div onClick={onClick} className={`${base} ${interactive} ${className}`}>
      {children}
    </div>
  )
}
