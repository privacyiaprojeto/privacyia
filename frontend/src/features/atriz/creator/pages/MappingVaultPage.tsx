import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ElementType } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  FileAudio,
  FileImage,
  FileLock2,
  Loader2,
  ShieldCheck,
  UploadCloud,
  Video,
} from 'lucide-react'
import {
  useCreatorMapping,
  useCreatorMappingRequirements,
  useUploadCreatorMappingAsset,
} from '@/features/atriz/creator/hooks'
import type {
  CreatorMappingAsset,
  CreatorMappingMediaType,
  CreatorMappingRequirement,
} from '@/features/atriz/creator/types'

function formatBytes(bytes: number) {
  if (!bytes) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[unitIndex]}`
}

function formatDate(value: string | null) {
  if (!value) return 'Data não informada'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mediaLabel(value: CreatorMappingMediaType) {
  if (value === 'audio') return 'Áudio'
  if (value === 'video') return 'Vídeo'
  return 'Imagem'
}

function iconForMediaType(value: CreatorMappingMediaType): ElementType {
  if (value === 'audio') return FileAudio
  if (value === 'video') return Video
  return FileImage
}

function statusLabel(value: string) {
  const normalized = String(value || '').trim().toLowerCase()
  const labels: Record<string, string> = {
    pending: 'Aguardando envio',
    not_started: 'Aguardando envio',
    uploaded: 'Em Análise pela Direção',
    pending_review: 'Em Análise pela Direção',
    approved: 'Aprovado e Protegido',
    rejected: 'Requer Nova Gravação',
    registered_dry_run: 'Em Análise pela Direção',
  }
  return labels[normalized] ?? 'Em Análise pela Direção'
}

function statusClass(value: string) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'approved') return 'bg-emerald-500/10 text-emerald-300'
  if (normalized === 'rejected') return 'bg-red-500/10 text-red-300'
  if (normalized === 'pending' || normalized === 'not_started') return 'bg-zinc-800 text-zinc-400'
  return 'bg-blue-500/10 text-blue-300'
}

type MappingTabId = 'visual' | 'audio' | 'premium'

type RequirementWithCategoryFallback = CreatorMappingRequirement & {
  mappingCategory?: 'premium' | 'standard' | null
  systemTag?: string | null
  system_tag?: string | null
}

const MAPPING_TABS: Array<{
  id: MappingTabId
  label: string
  helper: string
  emptyTitle: string
  emptyDescription: string
  icon: ElementType
}> = [
  {
    id: 'visual',
    label: 'Visual',
    helper: 'Fotos e vídeos solicitados',
    emptyTitle: 'Nenhum material visual solicitado no momento',
    emptyDescription: 'Quando a Direção solicitar novas fotos ou vídeos, eles aparecerão aqui.',
    icon: FileImage,
  },
  {
    id: 'audio',
    label: 'Áudio',
    helper: 'Gravações de voz',
    emptyTitle: 'Nenhum material de áudio solicitado no momento',
    emptyDescription: 'Quando a Direção solicitar uma gravação, ela aparecerá nesta aba.',
    icon: FileAudio,
  },
  {
    id: 'premium',
    label: 'Premium 18+',
    helper: 'Materiais de acesso restrito',
    emptyTitle: 'Nenhum material Premium 18+ solicitado no momento',
    emptyDescription: 'A Direção não solicitou materiais desta categoria para você agora.',
    icon: ShieldCheck,
  },
]

function requirementMappingCategory(requirement: CreatorMappingRequirement) {
  const categorizedRequirement = requirement as RequirementWithCategoryFallback
  const explicitCategory = String(
    categorizedRequirement.mapping_category
      ?? categorizedRequirement.mappingCategory
      ?? '',
  ).trim().toLowerCase()

  if (explicitCategory === 'premium' || explicitCategory === 'standard') {
    return explicitCategory
  }

  // Compatibilidade segura durante a transição entre versões da plataforma.
  const legacySystemTag = String(
    categorizedRequirement.systemTag
      ?? categorizedRequirement.system_tag
      ?? '',
  ).trim().toLowerCase()

  return legacySystemTag.includes('nsfw') ? 'premium' : 'standard'
}

function requirementMatchesTab(requirement: CreatorMappingRequirement, tab: MappingTabId) {
  const isPremium = requirementMappingCategory(requirement) === 'premium'

  if (tab === 'premium') return isPremium
  if (tab === 'audio') return requirement.mediaType === 'audio' && !isPremium
  return (requirement.mediaType === 'image' || requirement.mediaType === 'video') && !isPremium
}

function MaterialRow({
  item,
  requirement,
}: {
  item: CreatorMappingAsset
  requirement: CreatorMappingRequirement | null
}) {
  const mediaType = requirement?.mediaType || (item.contentType?.startsWith('audio/') ? 'audio' : item.contentType?.startsWith('video/') ? 'video' : 'image')
  const Icon = iconForMediaType(mediaType)
  const title = requirement?.title || 'Material do Estúdio'

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="rounded-xl bg-zinc-800 p-2.5 text-zinc-400"><Icon size={18} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-100">{item.originalFilename || title}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {title} · {formatBytes(item.byteSize)} · {formatDate(item.createdAt)}
          </p>
        </div>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
          {statusLabel(item.status)}
        </span>
      </div>
      {item.status === 'rejected' && item.rejectionReason && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-200">
          <strong>Motivo para nova gravação:</strong> {item.rejectionReason}
        </div>
      )}
    </div>
  )
}

export function MappingVaultPage() {
  const mappingQuery = useCreatorMapping()
  const requirementsQuery = useCreatorMappingRequirements()
  const uploadMutation = useUploadCreatorMappingAsset()
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingRequirementId, setUploadingRequirementId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<MappingTabId>('visual')

  const allRequirements = useMemo(() => {
    const merged = new Map<string, CreatorMappingRequirement>()

    for (const requirement of mappingQuery.data?.mapping.requirements || []) {
      merged.set(requirement.id, requirement)
    }

    for (const requirement of requirementsQuery.data?.requirements || []) {
      merged.set(requirement.id, {
        ...(merged.get(requirement.id) || {}),
        ...requirement,
      })
    }

    return Array.from(merged.values())
  }, [mappingQuery.data?.mapping.requirements, requirementsQuery.data?.requirements])
  const requirementById = useMemo(
    () => new Map(allRequirements.map((requirement) => [requirement.id, requirement])),
    [allRequirements],
  )
  const activeRequirements = useMemo(
    () => allRequirements.filter((requirement) => requirement.isActive !== false),
    [allRequirements],
  )
  const requirementGroups = useMemo<Record<MappingTabId, CreatorMappingRequirement[]>>(
    () => ({
      visual: activeRequirements.filter((requirement) => requirementMatchesTab(requirement, 'visual')),
      audio: activeRequirements.filter((requirement) => requirementMatchesTab(requirement, 'audio')),
      premium: activeRequirements.filter((requirement) => requirementMatchesTab(requirement, 'premium')),
    }),
    [activeRequirements],
  )
  const requirements = requirementGroups[activeTab]
  const activeTabDefinition = MAPPING_TABS.find((tab) => tab.id === activeTab) || MAPPING_TABS[0]
  const ActiveTabIcon = activeTabDefinition.icon

  async function handleFileChange(requirement: CreatorMappingRequirement, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const maxUploadBytes = mappingQuery.data?.mapping.maxUploadBytes || 25 * 1024 * 1024
    if (file.size > maxUploadBytes) {
      window.alert(`Este arquivo é maior que o permitido. Escolha outro com até ${formatBytes(maxUploadBytes)}.`)
      return
    }

    if (file.type && !requirement.acceptedMimeTypes.includes(file.type)) {
      window.alert(`Escolha um arquivo de ${mediaLabel(requirement.mediaType).toLowerCase()} em um formato aceito para esta solicitação.`)
      return
    }

    setUploadingRequirementId(requirement.id)

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Não foi possível preparar o arquivo selecionado.'))
        reader.readAsDataURL(file)
      })

      await uploadMutation.mutateAsync({
        mappingRequirementId: requirement.id,
        base64,
        originalFilename: file.name,
        contentType: file.type || requirement.acceptedMimeTypes[0] || 'application/octet-stream',
        byteSize: file.size,
      })

      window.alert('Material enviado com sucesso. A Direção receberá o arquivo para análise.')
    } catch {
      window.alert('Não conseguimos enviar seu material agora. Confira sua conexão e tente novamente. Se continuar, fale com a equipe de suporte.')
    } finally {
      setUploadingRequirementId(null)
    }
  }

  const isLoading = mappingQuery.isLoading || requirementsQuery.isLoading
  const isError = mappingQuery.isError || requirementsQuery.isError

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="h-36 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !mappingQuery.data) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertTriangle className="mx-auto text-red-300" size={30} />
        <h2 className="mt-4 text-lg font-semibold text-zinc-100">Não conseguimos abrir seu Estúdio de Mapeamento</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          Confira sua conexão e tente novamente. Seus materiais continuam protegidos.
        </p>
        <button
          type="button"
          onClick={() => void Promise.all([mappingQuery.refetch(), requirementsQuery.refetch()])}
          className="mt-5 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const mapping = mappingQuery.data.mapping
  const approved = mapping.status === 'approved'

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
              <FileLock2 size={13} /> Cofre Biométrico
            </div>
            <h2 className="mt-4 text-2xl font-bold text-zinc-50">Estúdio de Mapeamento</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Envie os materiais solicitados pela Direção. Cada solicitação aparece organizada por categoria para deixar esta etapa mais simples.
            </p>
          </div>

          <div className={approved ? 'rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4' : 'rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4'}>
            <div className="flex items-center gap-3">
              {approved ? <BadgeCheck size={22} className="text-emerald-300" /> : <ShieldCheck size={22} className="text-amber-300" />}
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">Status atual</p>
                <p className="mt-1 text-sm font-semibold text-zinc-100">{statusLabel(mapping.status)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Categorias dos materiais" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-2">
        <div role="tablist" aria-label="Categorias dos materiais solicitados" className="grid gap-2 md:grid-cols-3">
          {MAPPING_TABS.map((tab) => {
            const Icon = tab.icon
            const selected = activeTab === tab.id
            const count = requirementGroups[tab.id].length

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`mapping-panel-${tab.id}`}
                id={`mapping-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={selected
                  ? 'flex min-w-0 items-center gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-3 text-left shadow-sm transition'
                  : 'flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-left transition hover:border-zinc-700 hover:bg-zinc-800/70'}
              >
                <span className={selected ? 'rounded-xl bg-violet-400/15 p-2 text-violet-200' : 'rounded-xl bg-zinc-800 p-2 text-zinc-500'}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={selected ? 'block text-sm font-semibold text-zinc-50' : 'block text-sm font-semibold text-zinc-300'}>{tab.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-600">{tab.helper}</span>
                </span>
                <span className={selected ? 'rounded-full bg-violet-300/15 px-2.5 py-1 text-xs font-bold text-violet-200' : 'rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-500'}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section
        role="tabpanel"
        id={`mapping-panel-${activeTab}`}
        aria-labelledby={`mapping-tab-${activeTab}`}
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Materiais Solicitados — {activeTabDefinition.label}</h3>
            <p className="mt-1 text-sm text-zinc-500">{activeTabDefinition.helper}. Limite de {formatBytes(mapping.maxUploadBytes)} por arquivo.</p>
          </div>
          {mapping.checklist && (
            <p className="text-sm text-zinc-500">
              Obrigatórios: <strong className="text-zinc-200">{mapping.checklist.completedRequired}/{mapping.checklist.totalRequired}</strong>
            </p>
          )}
        </div>

        {activeRequirements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
            <FileLock2 size={30} className="mx-auto text-zinc-700" />
            <p className="mt-4 text-sm font-semibold text-zinc-300">Nenhum material solicitado no momento</p>
            <p className="mt-1 text-sm text-zinc-600">A Direção ainda não solicitou materiais para esta etapa.</p>
          </div>
        ) : requirements.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/50 p-10 text-center">
            <ActiveTabIcon size={30} className="mx-auto text-zinc-700" />
            <p className="mt-4 text-sm font-semibold text-zinc-300">{activeTabDefinition.emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-zinc-600">{activeTabDefinition.emptyDescription}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {requirements.map((requirement) => {
              const Icon = iconForMediaType(requirement.mediaType)
              const uploading = uploadMutation.isPending && uploadingRequirementId === requirement.id

              return (
                <article key={requirement.id} className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="rounded-xl bg-pink-500/10 p-2.5 text-pink-300"><Icon size={20} /></div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(requirement.status)}`}>{statusLabel(requirement.status)}</span>
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-400">{requirement.isRequired ? 'Obrigatório' : 'Opcional'}</span>
                    </div>
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-zinc-100">{requirement.title}</h4>
                  <p className="mt-2 min-h-12 text-sm leading-relaxed text-zinc-500">{requirement.description || `Envie um arquivo de ${mediaLabel(requirement.mediaType).toLowerCase()}.`}</p>

                  {requirement.status === 'rejected' && requirement.rejectionReason && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs leading-relaxed text-red-200">
                      <strong>Motivo para nova gravação:</strong> {requirement.rejectionReason}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-xs text-zinc-600">
                    <span>{mediaLabel(requirement.mediaType)}</span>
                    <span>{requirement.uploadedCount} envio{requirement.uploadedCount === 1 ? '' : 's'}</span>
                  </div>

                  <input
                    ref={(element) => { fileInputs.current[requirement.id] = element }}
                    type="file"
                    accept={requirement.accept}
                    className="hidden"
                    onChange={(event) => void handleFileChange(requirement, event)}
                  />
                  <button
                    type="button"
                    disabled={uploadMutation.isPending || !mapping.uploadEnabled}
                    onClick={() => fileInputs.current[requirement.id]?.click()}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploading ? 'Enviando material...' : requirement.uploadedCount > 0 ? 'Enviar outra versão' : 'Escolher arquivo'}
                  </button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 lg:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">Meus Envios</h3>
            <p className="mt-1 text-sm text-zinc-500">Acompanhe a análise e as orientações da Direção para cada material.</p>
          </div>
          <span className="text-sm font-semibold text-zinc-400">{mapping.assets.length} envio{mapping.assets.length === 1 ? '' : 's'}</span>
        </div>

        <div className="mt-5 space-y-3">
          {mapping.assets.length > 0 ? mapping.assets.map((item) => (
            <MaterialRow key={item.id} item={item} requirement={item.mappingRequirementId ? requirementById.get(item.mappingRequirementId) || null : null} />
          )) : (
            <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
              <FileLock2 size={28} className="mx-auto text-zinc-700" />
              <p className="mt-3 text-sm font-semibold text-zinc-300">Nenhum material enviado</p>
              <p className="mt-1 text-sm text-zinc-600">Escolha um dos materiais solicitados acima para começar.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
