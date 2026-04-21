import { useParams } from 'react-router'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'

export function AtrizPerfilPage() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <ClienteLayout>
      <div className="flex flex-col items-center justify-center gap-2 pt-20 text-zinc-400">
        <span className="text-sm">Perfil da atriz</span>
        <span className="font-mono text-xs text-zinc-600">{slug}</span>
      </div>
    </ClienteLayout>
  )
}
