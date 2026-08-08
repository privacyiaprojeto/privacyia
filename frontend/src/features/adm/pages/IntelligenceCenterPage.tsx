import { useState, type ElementType } from 'react'
import { BookOpenText, Database, Film, Fingerprint, Mic2, ShieldCheck } from 'lucide-react'
import { MappingRequirementsAdminPanel } from '@/features/adm/components/MappingRequirementsAdminPanel'
import { PromptDictionariesPanel } from '@/features/adm/components/PromptDictionariesPanel'
import { BaseSceneLibraryPanel } from '@/features/adm/components/BaseSceneLibraryPanel'
import { AudioStorylinesPanel } from '@/features/adm/components/AudioStorylinesPanel'

type IntelligenceTab = 'kyc' | 'dictionaries' | 'baseScenes' | 'audioStorylines'

const TABS: Array<{
  id: IntelligenceTab
  label: string
  helper: string
  icon: ElementType
}> = [
  { id: 'kyc', label: 'Cofre Biométrico (KYC)', helper: 'Requisitos globais de mapeamento', icon: Fingerprint },
  { id: 'dictionaries', label: 'Dicionários de Prompt', helper: 'Cenários, roupas, ações e variáveis', icon: BookOpenText },
  { id: 'baseScenes', label: 'Vídeos Base (V2V)', helper: 'Biblioteca privada e classificação', icon: Film },
  { id: 'audioStorylines', label: 'Enredos (Áudio)', helper: 'Roteiros e tons de voz TTS', icon: Mic2 },
]

export function IntelligenceCenterPage() {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>('kyc')

  return (
    <section className="space-y-6" data-admin-intelligence-center="true">
      <div className="overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-300/[0.12] via-white/[0.04] to-black/30 p-6 shadow-2xl shadow-black/25">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-black/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-violet-100"><Database size={14} /> Single Source of Truth</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">Central de Inteligência</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">Configuração global separada da operação. Tudo que define identidade, variáveis, cenas reutilizáveis e roteiros-base passa a ser administrado aqui.</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
            <div className="flex items-center gap-2 font-black"><ShieldCheck size={17} /> Escopo protegido</div>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-emerald-50/70">Esta fase não altera o Modal de Detalhes do Ator nem executa produção, publicação ou venda.</p>
          </div>
        </div>
      </div>

      <nav className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.045] p-3 sm:grid-cols-2 xl:grid-cols-4">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-[1.5rem] border p-4 text-left transition ${active ? 'border-white bg-white text-zinc-950 shadow-xl shadow-white/10' : 'border-transparent bg-black/20 text-zinc-400 hover:border-white/10 hover:bg-white/[0.055] hover:text-white'}`}>
              <div className="flex items-start gap-3">
                <span className={`rounded-2xl p-3 ${active ? 'bg-zinc-950 text-white' : 'bg-white/[0.06] text-zinc-400'}`}><Icon size={18} /></span>
                <span className="min-w-0"><span className="block text-sm font-black">{tab.label}</span><span className={`mt-1 block text-xs leading-relaxed ${active ? 'text-zinc-600' : 'text-zinc-600'}`}>{tab.helper}</span></span>
              </div>
            </button>
          )
        })}
      </nav>

      {activeTab === 'kyc' && <MappingRequirementsAdminPanel />}
      {activeTab === 'dictionaries' && <PromptDictionariesPanel />}
      {activeTab === 'baseScenes' && <BaseSceneLibraryPanel />}
      {activeTab === 'audioStorylines' && <AudioStorylinesPanel />}
    </section>
  )
}
