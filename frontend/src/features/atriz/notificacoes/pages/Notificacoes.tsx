import { Bell, UserPlus, DollarSign, ArrowDownCircle, XCircle, Info } from 'lucide-react'
import { useNotificacoesAtriz } from '@/features/atriz/notificacoes/hooks/useNotificacoesAtriz'
import type { TipoNotificacaoAtriz } from '@/features/atriz/notificacoes/types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TIPO_CONFIG: Record<
  TipoNotificacaoAtriz,
  { icon: React.ElementType; color: string; bg: string }
> = {
  novo_assinante: { icon: UserPlus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  pagamento_recebido: { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  saque_processado: { icon: ArrowDownCircle, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  saque_recusado: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10' },
  plataforma: { icon: Info, color: 'text-zinc-400', bg: 'bg-zinc-700/50' },
}

export function Notificacoes() {
  const { data: notificacoes, isLoading } = useNotificacoesAtriz()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
        ))}
      </div>
    )
  }

  if (!notificacoes || notificacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Bell size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Nenhuma notificação</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Tudo em dia por aqui.
        </p>
      </div>
    )
  }

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  return (
    <div className="space-y-4">
      {naoLidas > 0 && (
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-200">{naoLidas}</span> não{naoLidas === 1 ? ' lida' : ' lidas'}
        </p>
      )}

      <div className="space-y-2">
        {notificacoes.map((notif) => {
          const cfg = TIPO_CONFIG[notif.tipo]
          const Icon = cfg.icon
          return (
            <div
              key={notif.id}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition-colors ${
                notif.lida
                  ? 'border-zinc-800 bg-zinc-900/60'
                  : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <div className={`shrink-0 rounded-xl p-2 ${cfg.bg}`}>
                <Icon size={16} className={cfg.color} strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${notif.lida ? 'text-zinc-400' : 'text-zinc-200'}`}>
                    {notif.titulo}
                  </p>
                  {!notif.lida && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  )}
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">{notif.descricao}</p>
                <p className="mt-1.5 text-xs text-zinc-600">{formatDate(notif.criadaEm)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
