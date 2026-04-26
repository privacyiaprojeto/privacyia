import { Settings } from 'lucide-react'

const SECTIONS = [
  { title: 'Perfil público',   desc: 'Foto, banner, slug, bio e características físicas visíveis pelos clientes.' },
  { title: 'Personalidade IA', desc: 'Tom de voz, palavras favoritas, limites e estilo de resposta da IA que fala como você.' },
  { title: 'Live Actions',     desc: 'Ações ao vivo disponíveis no seu perfil e preços de desbloqueio.' },
  { title: 'Live Audios',      desc: 'Áudios disponíveis no seu perfil e controle de acesso.' },
  { title: 'Dados da conta',   desc: 'Nome artístico, e-mail de acesso e alteração de senha.' },
  { title: 'Dados bancários',  desc: 'PIX e conta bancária para recebimento dos saques.' },
] as const

export function Configuracoes() {
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-3 pb-2">
        <Settings size={20} className="text-zinc-500" strokeWidth={1.75} />
        <p className="text-sm text-zinc-500">Selecione uma seção para configurar</p>
      </div>

      {SECTIONS.map(({ title, desc }) => (
        <button
          key={title}
          className="flex w-full items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-100">{title}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>
          </div>
          <span className="mt-0.5 flex-shrink-0 text-xs text-zinc-600">Em breve →</span>
        </button>
      ))}
    </div>
  )
}
