import type { ReactNode } from 'react'
import { Header } from '@/features/cliente/components/Header'
import { BottomNav } from '@/features/cliente/components/BottomNav'

interface ClienteLayoutProps {
  children: ReactNode
}

export function ClienteLayout({ children }: ClienteLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <Header />
      <main className="flex-1 pt-20 pb-16">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
