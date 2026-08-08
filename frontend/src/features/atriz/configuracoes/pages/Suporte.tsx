import { LifeBuoy, MessageCircle } from 'lucide-react'

export function Suporte() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-pink-500/10 p-2.5"><LifeBuoy size={20} className="text-pink-400" strokeWidth={1.75} /></div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Suporte e chamados</p>
            <p className="mt-1 text-sm text-zinc-500">Este espaço será usado para acompanhar solicitações enviadas à equipe do Privacy IA.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <MessageCircle size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Nenhum chamado aberto</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">Quando o atendimento estiver integrado, seus pedidos e respostas aparecerão aqui sem dados de demonstração.</p>
      </div>
    </div>
  )
}
