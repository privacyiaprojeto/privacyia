import { Settings } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useCreatorFinance, useCreatorMapping } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { creatorStatusLabel } from '@/features/atriz/creator/utils'
import { ContaSeguranca } from '@/features/atriz/configuracoes/pages/ContaSeguranca'
import { DadosRecebimento } from '@/features/atriz/configuracoes/pages/DadosRecebimento'
import { EnvioMateriais } from '@/features/atriz/configuracoes/pages/EnvioMateriais'
import { Suporte } from '@/features/atriz/configuracoes/pages/Suporte'

const SECTIONS = [
  { key: 'perfil', title: 'Perfil público', desc: 'Foto, banner, slug, bio e características físicas visíveis pelos clientes.' },
  { key: 'personalidade', title: 'Personalidade IA', desc: 'Tom de voz, palavras favoritas, limites e estilo de resposta da IA que fala como você.' },
  { key: 'live-actions', title: 'Live Actions', desc: 'Ações ao vivo disponíveis no seu perfil e preços de desbloqueio.' },
  { key: 'live-audios', title: 'Live Audios', desc: 'Áudios disponíveis no seu perfil e controle de acesso.' },
  { key: 'materiais', title: 'Envio de Materiais', desc: 'Documentos, fotos do rosto e áudios de voz enviados para análise.' },
  { key: 'conta', title: 'Dados da conta', desc: 'Nome artístico, e-mail de acesso e alteração de senha.' },
  { key: 'pagamentos', title: 'Dados bancários', desc: 'PIX e conta bancária para recebimento dos repasses.' },
] as const

export function Configuracoes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const section = searchParams.get('section') || ''
  const mappingQuery = useCreatorMapping()
  const financeQuery = useCreatorFinance()

  if (section === 'materiais') return <EnvioMateriais />
  if (section === 'suporte') return <Suporte />
  if (section === 'conta') return <ContaSeguranca />
  if (section === 'pagamentos') return <DadosRecebimento />

  function sectionStatus(key: typeof SECTIONS[number]['key']) {
    if (key === 'materiais') return creatorStatusLabel(mappingQuery.data?.mapping?.status)
    if (key === 'pagamentos') return creatorStatusLabel(financeQuery.data?.payoutMethod?.status)
    if (key === 'conta') return 'Abrir →'
    return 'Em breve →'
  }

  function openSection(key: typeof SECTIONS[number]['key']) {
    if (key === 'materiais' || key === 'conta' || key === 'pagamentos') {
      navigate(`/atriz/configuracoes?section=${key}`)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-3 pb-2">
        <Settings size={20} className="text-zinc-500" strokeWidth={1.75} />
        <p className="text-sm text-zinc-500">Selecione uma seção para configurar</p>
      </div>

      {SECTIONS.map(({ key, title, desc }) => (
        <button
          key={title}
          onClick={() => openSection(key)}
          className="flex w-full items-start gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-100">{title}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{desc}</p>
          </div>
          <span className="mt-0.5 flex-shrink-0 text-xs text-zinc-600">{sectionStatus(key)}</span>
        </button>
      ))}
    </div>
  )
}
