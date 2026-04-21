import { useNavigate } from 'react-router'
import { Megaphone, Zap, Image, CreditCard, Info } from 'lucide-react'
import { clsx } from 'clsx'
import type { Notificacao } from '@/features/cliente/notificacoes/types'
import { getNotificationDestination, tempoRelativo } from '@/features/cliente/notificacoes/utils/getNotificationDestination'
import { useMarcarLida } from '@/features/cliente/notificacoes/hooks/useMarcarLida'

interface NotificacaoItemProps {
  notificacao: Notificacao
}

const icones = {
  novo_conteudo: Megaphone,
  nova_publicacao: Megaphone,
  geracao_concluida: Image,
  creditos_baixos: CreditCard,
  aviso_geral: Info,
}

const coresIcone = {
  marketing: 'bg-violet-500/10 text-violet-400',
  sistema: 'bg-amber-500/10 text-amber-400',
}

export function NotificacaoItem({ notificacao: n }: NotificacaoItemProps) {
  const navigate = useNavigate()
  const { mutate: marcarLida } = useMarcarLida()

  const Icone = icones[n.categoria] ?? Zap

  function handleClick() {
    if (!n.lida) marcarLida(n.id)
    navigate(getNotificationDestination(n))
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-zinc-800/60',
        !n.lida && 'bg-zinc-800/30',
      )}
    >
      <div className={clsx('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', coresIcone[n.tipo])}>
        <Icone size={16} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={clsx('text-sm leading-snug', n.lida ? 'text-zinc-400' : 'font-medium text-zinc-100')}>
            {n.titulo}
          </p>
          <span className="shrink-0 text-[11px] text-zinc-600">{tempoRelativo(n.criadaEm)}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{n.descricao}</p>
      </div>

      {!n.lida && (
        <span className="mt-2 size-2 shrink-0 rounded-full bg-violet-500" />
      )}
    </button>
  )
}
