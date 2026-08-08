import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, FileText, Mic2, PlaySquare, Sparkles, X } from 'lucide-react'
import { useCreationAvatars } from '@/features/adm/hooks/useCreationAdmin'
import { useCreateNarrativeDraft, useNarrativeDrafts, useNarrativeStudioSpec, usePreviewNarrativeProduct } from '@/features/adm/hooks/useNarrativeStudio'
import type { NarrativeContentType, NarrativePublishDestination, NarrativeStudioPayload } from '@/features/adm/api/narrativeStudioApi'
import { parseApiError } from '@/shared/utils/parseApiError'

const CONTENT_TYPES: Array<{ value: NarrativeContentType; label: string; helper: string }> = [
  { value: 'live_audio', label: 'Audio Live', helper: 'Produto em áudio narrativo para compra dentro da experiência.' },
  { value: 'live_action', label: 'Live Action', helper: 'Produto em vídeo/cena narrativa para compra protegida.' },
]

const DESTINATIONS: Array<{ value: NarrativePublishDestination; label: string }> = [
  { value: 'chat_side_store', label: 'Ao lado do chat' },
  { value: 'avatar_feed', label: 'Feed do avatar' },
  { value: 'both', label: 'Chat + feed' },
  { value: 'admin_only', label: 'Somente Admin por enquanto' },
]

type StudioTab = 'vitrine' | 'roteiro' | 'producao'

const STUDIO_TABS: Array<{ id: StudioTab; label: string; helper: string }> = [
  { id: 'vitrine', label: '1. Avatar e produto', helper: 'Escolha avatar, tipo narrativo, vitrine, preço e destino.' },
  { id: 'roteiro', label: '2. Prompt / roteiro', helper: 'Defina evento, intenção, humor, local e briefing interno.' },
  { id: 'producao', label: '3. Configurar mídia', helper: 'Prepare prévia, rascunho e envio seguro para revisão.' },
]

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
      <strong className="block text-rose-50">Não foi possível concluir.</strong>
      <span className="mt-1 block text-rose-100/80">{parseApiError(error)}</span>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{children}</label>
}

function FieldHelp({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-zinc-500">{children}</p>
}

function formatDuration(seconds: number) {
  const value = Number(seconds || 0)
  if (value < 60) return `${value}s`
  const minutes = Math.floor(value / 60)
  const remaining = value % 60
  return remaining ? `${minutes}min ${remaining}s` : `${minutes}min`
}

function publishDestinationLabel(value: NarrativePublishDestination) {
  return DESTINATIONS.find((item) => item.value === value)?.label || 'Somente Admin por enquanto'
}

function statusLabel(value?: string | null) {
  if (!value) return 'Em preparação'
  const normalized = String(value).toLowerCase()
  const labels: Record<string, string> = {
    draft: 'Em preparação',
    pending: 'Aguardando revisão',
    qa_pending: 'Aguardando revisão',
    approved: 'Aprovado',
    available: 'Pronto para vender',
    rejected: 'Reprovado',
    published: 'Publicado',
    published_card_simulated: 'Card preparado',
    published_card_ready: 'Card pronto',
    published_card: 'Publicado na vitrine',
    completed: 'Concluído',
  }
  return labels[normalized] || normalized.replace(/_/g, ' ')
}

function statusHelp(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (normalized === 'published_card_simulated') return 'A vitrine foi montada, mas a mídia final ainda não foi liberada.'
  if (normalized === 'draft') return 'Item salvo para continuar depois.'
  if (normalized === 'qa_pending') return 'Item aguardando conferência antes de venda.'
  if (normalized === 'available') return 'Item pronto para entrar no fluxo comercial.'
  return 'Item acompanhado pelo Admin.'
}

function ShowcaseCard({
  contentType,
  selectedTypeLabel,
  publicTitle,
  publicDescription,
  durationLabel,
  priceLabel,
  avatarName,
  destinationLabel,
}: {
  contentType: NarrativeContentType
  selectedTypeLabel: string
  publicTitle: string
  publicDescription: string
  durationLabel: string
  priceLabel: string
  avatarName: string
  destinationLabel: string
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-fuchsia-400/15 via-white/[0.04] to-black/20 p-5 shadow-2xl shadow-black/30">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{selectedTypeLabel}</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          {contentType === 'live_audio' ? <Mic2 className="h-3 w-3" /> : <PlaySquare className="h-3 w-3" />}
          Produto narrativo
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-black leading-tight text-white">{publicTitle || 'Título do produto'}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{publicDescription || 'Descrição curta do card.'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1"><Clock3 className="h-3 w-3" /> {durationLabel}</span>
        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-amber-100">{priceLabel}</span>
      </div>
      <button type="button" className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950">Comprar</button>
      <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-500">
        <p>Avatar: <strong className="text-zinc-300">{avatarName}</strong></p>
        <p>Exibição: <strong className="text-zinc-300">{destinationLabel}</strong></p>
      </div>
    </div>
  )
}

export function NarrativeStudioPanel() {
  const avatarsQuery = useCreationAvatars()
  useNarrativeStudioSpec()
  const previewMutation = usePreviewNarrativeProduct()
  const createDraftMutation = useCreateNarrativeDraft()
  const draftsQuery = useNarrativeDrafts()

  const avatars = avatarsQuery.data?.items || []
  const firstAvatarId = avatars[0]?.id || ''

  const [activeTab, setActiveTab] = useState<StudioTab>('vitrine')
  const [showInternalDetails, setShowInternalDetails] = useState(false)
  const [showShowcasePreview, setShowShowcasePreview] = useState(false)
  const [companionId, setCompanionId] = useState('')
  const [contentType, setContentType] = useState<NarrativeContentType>('live_audio')
  const [publicTitle, setPublicTitle] = useState('Quero te contar uma coisa...')
  const [publicDescription, setPublicDescription] = useState('Uma experiência narrativa especial para desbloquear dentro da plataforma.')
  const [event, setEvent] = useState('A avatar relembra um momento especial no fim do dia.')
  const [mood, setMood] = useState('calmo, envolvente e próximo')
  const [location, setLocation] = useState('quarto, noite tranquila')
  const [narrativeIntent, setNarrativeIntent] = useState('Criar uma história curta, natural e vendável como produto de vitrine.')
  const [manualPrompt, setManualPrompt] = useState('Escreva um roteiro com começo, meio e fim, mantendo naturalidade e coerência com o avatar.')
  const [voiceStyle, setVoiceStyle] = useState('voz suave, pausada e expressiva')
  const [visualStyle, setVisualStyle] = useState('cinematográfico, luz natural, movimento suave')
  const [durationSeconds, setDurationSeconds] = useState(contentType === 'live_audio' ? 90 : 20)
  const [priceCredits, setPriceCredits] = useState(contentType === 'live_audio' ? 12 : 25)
  const [publishDestination, setPublishDestination] = useState<NarrativePublishDestination>('chat_side_store')

  const selectedCompanionId = companionId || firstAvatarId
  const selectedType = CONTENT_TYPES.find((item) => item.value === contentType) || CONTENT_TYPES[0]
  const selectedAvatar = avatars.find((avatar) => avatar.id === selectedCompanionId)

  const payload = useMemo<NarrativeStudioPayload>(() => ({
    companionId: selectedCompanionId,
    contentType,
    publicTitle,
    publicDescription,
    event,
    mood,
    location,
    narrativeIntent,
    manualPrompt,
    voiceStyle,
    visualStyle,
    durationSeconds: Number(durationSeconds || 0),
    priceCredits: Number(priceCredits || 0),
    publishDestination,
    isFreePreview: false,
    isExclusiveForSale: true,
    qaRequired: true,
    safeModeOnly: true,
    dryRunOnly: true,
  }), [selectedCompanionId, contentType, publicTitle, publicDescription, event, mood, location, narrativeIntent, manualPrompt, voiceStyle, visualStyle, durationSeconds, priceCredits, publishDestination])

  const canPreview = Boolean(selectedCompanionId && publicTitle.trim().length >= 3)
  const priceLabel = `${Number(priceCredits || 0)} créditos`
  const durationLabel = formatDuration(Number(durationSeconds || 0))
  const avatarName = selectedAvatar?.name || 'Selecione um avatar'
  const destinationLabel = publishDestinationLabel(publishDestination)

  async function handlePreview() {
    if (!canPreview) return
    await previewMutation.mutateAsync(payload)
  }

  async function handleDraft() {
    if (!canPreview) return
    await createDraftMutation.mutateAsync({ ...payload, dryRunOnly: true })
  }

  async function handleControlledDraft() {
    if (!canPreview) return
    await createDraftMutation.mutateAsync({ ...payload, dryRunOnly: false, safeModeOnly: true })
  }

  const draftItems = (draftsQuery.data?.items || []).slice(0, 5)

  return (
    <section className="space-y-5 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/30">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-100">
            <Sparkles className="h-3.5 w-3.5" /> Produto narrativo
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">Estúdio Narrativo</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Siga o fluxo seguro: 1. Selecionar Avatar → 2. Selecionar Prompt/Produto → 3. Configurar Mídia. A prévia do cliente fica em modal para manter a tela limpa.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
          <button
            type="button"
            onClick={() => setShowShowcasePreview(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"
          >
            <Eye className="h-4 w-4" /> Ver prévia da vitrine
          </button>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100">
            <strong className="block text-emerald-50">Proteções ativas</strong>
            <span className="mt-1 block text-emerald-100/80">Prévia e rascunho. Venda e entrega continuam separadas.</span>
          </div>
        </div>
      </div>

      {avatarsQuery.isError ? <ErrorBox error={avatarsQuery.error} /> : null}
      {previewMutation.isError ? <ErrorBox error={previewMutation.error} /> : null}
      {createDraftMutation.isError ? <ErrorBox error={createDraftMutation.error} /> : null}

      <div className="grid gap-2 md:grid-cols-3">
        {STUDIO_TABS.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl border p-4 text-left transition ${active ? 'border-fuchsia-300/40 bg-fuchsia-400/15 text-white' : 'border-white/10 bg-black/20 text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
            >
              <span className="block text-sm font-black">{tab.label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">{tab.helper}</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        {activeTab === 'vitrine' ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-black text-white">1. Selecionar Avatar e Produto</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">Escolha o avatar, o tipo narrativo e a vitrine do produto antes de avançar para o roteiro.</p>
              </div>
              <button type="button" onClick={() => setShowShowcasePreview(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-black text-white transition hover:border-fuchsia-300/40 hover:bg-fuchsia-400/10">
                <Eye className="h-4 w-4" /> Ver prévia
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Avatar</FieldLabel>
                <select value={selectedCompanionId} onChange={(event) => setCompanionId(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50">
                  {avatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name}</option>)}
                </select>
                <FieldHelp>Define qual avatar será associado ao produto narrativo.</FieldHelp>
              </div>
              <div className="space-y-2">
                <FieldLabel>Tipo de produto</FieldLabel>
                <select
                  value={contentType}
                  onChange={(event) => {
                    const next = event.target.value as NarrativeContentType
                    setContentType(next)
                    setDurationSeconds(next === 'live_audio' ? 90 : 20)
                    setPriceCredits(next === 'live_audio' ? 12 : 25)
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50"
                >
                  {CONTENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <FieldHelp>{selectedType.helper}</FieldHelp>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Título público</FieldLabel>
                <input value={publicTitle} onChange={(event) => setPublicTitle(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Onde aparecerá</FieldLabel>
                <select value={publishDestination} onChange={(event) => setPublishDestination(event.target.value as NarrativePublishDestination)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50">
                  {DESTINATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Descrição da vitrine</FieldLabel>
              <textarea value={publicDescription} onChange={(event) => setPublicDescription(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Duração</FieldLabel>
                <input type="number" min={10} max={360} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value || 0))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Preço em créditos</FieldLabel>
                <input type="number" min={0} value={priceCredits} onChange={(event) => setPriceCredits(Number(event.target.value || 0))} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'roteiro' ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white">2. Selecionar Prompt / Produto</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">Defina a cena, intenção e estilo. Essas informações são o prompt/briefing interno e não aparecem na vitrine do cliente.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel>Evento</FieldLabel>
                <input value={event} onChange={(event) => setEvent(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Humor</FieldLabel>
                <input value={mood} onChange={(event) => setMood(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Local</FieldLabel>
                <input value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
            </div>

            <div className="space-y-2">
              <FieldLabel>Objetivo da narrativa</FieldLabel>
              <textarea value={narrativeIntent} onChange={(event) => setNarrativeIntent(event.target.value)} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
            </div>

            <div className="space-y-2">
              <FieldLabel>Briefing interno</FieldLabel>
              <textarea value={manualPrompt} onChange={(event) => setManualPrompt(event.target.value)} rows={5} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              <FieldHelp>Este texto ajuda a preparar o roteiro. Ele não é exibido no card de venda.</FieldHelp>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Voz / estilo de fala</FieldLabel>
                <input value={voiceStyle} onChange={(event) => setVoiceStyle(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Estilo visual</FieldLabel>
                <input value={visualStyle} onChange={(event) => setVisualStyle(event.target.value)} disabled={contentType !== 'live_action'} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-fuchsia-300/50 disabled:opacity-45" />
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === 'producao' ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-black text-white">3. Configurar Mídia</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">Prepare o item de forma segura. Nada gera mídia final, cobra ou publica sem etapas próprias de revisão.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button type="button" onClick={handlePreview} disabled={!canPreview || previewMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                <FileText className="h-4 w-4" /> Pré-visualizar roteiro
              </button>
              <button type="button" onClick={handleDraft} disabled={!canPreview || createDraftMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-5 py-3 text-sm font-black text-fuchsia-50 transition hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                <Sparkles className="h-4 w-4" /> Salvar rascunho seguro
              </button>
              <button type="button" onClick={handleControlledDraft} disabled={!canPreview || createDraftMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> Preparar lote seguro
              </button>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              <strong className="block text-white">Fluxo atual</strong>
              <p className="mt-2 leading-relaxed text-zinc-400">Primeiro o Admin escolhe avatar/produto, depois prepara o prompt e só então configura a mídia. A ação final prepara para revisão; venda, entrega e geração final continuam em etapas próprias.</p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-sm font-black text-white">Itens em preparação</h3>
              <p className="mt-1 text-xs text-zinc-500">Produtos narrativos salvos no Admin e ainda sujeitos à revisão antes de venda.</p>
              <div className="mt-3 space-y-2">
                {draftItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-white">{item.publicTitle || item.title}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.contentTypeLabel} · {formatDuration(item.durationSeconds || 0)} · {item.priceCredits || 0} créditos</p>
                        <p className="mt-1 text-xs text-zinc-500">{statusHelp(item.status)}</p>
                      </div>
                      <span className="rounded-full border border-fuchsia-300/15 bg-fuchsia-400/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-fuchsia-100">{statusLabel(item.status)}</span>
                    </div>
                  </div>
                ))}
                {!draftsQuery.isLoading && !draftItems.length ? (
                  <p className="rounded-2xl border border-dashed border-white/10 p-3 text-xs text-zinc-500">Nenhum produto narrativo em preparação ainda.</p>
                ) : null}
              </div>
            </div>

            {previewMutation.data ? (
              <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="flex items-center gap-2 font-black text-emerald-50"><CheckCircle2 className="h-4 w-4" /> Prévia pronta</div>
                <p className="mt-2 text-emerald-100/80">A prévia foi preparada para conferência do Admin.</p>
                <button type="button" onClick={() => setShowInternalDetails((current) => !current)} className="mt-3 rounded-2xl border border-emerald-100/20 px-4 py-2 text-xs font-black text-emerald-50 transition hover:bg-emerald-100/10">
                  {showInternalDetails ? 'Ocultar detalhes internos' : 'Ver detalhes internos'}
                </button>
                {showInternalDetails ? (
                  <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/35 p-3 text-xs text-emerald-50/90">{previewMutation.data.narrative.internalPromptPreview}</pre>
                ) : null}
              </div>
            ) : null}

            {createDraftMutation.data ? (
              <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                <div className="flex items-center gap-2 font-black text-amber-50"><AlertTriangle className="h-4 w-4" /> Produto narrativo em preparação</div>
                <p className="mt-2 text-amber-100/80">Status: {statusLabel(createDraftMutation.data.status)}</p>
                {createDraftMutation.data.draft?.id ? <p className="mt-1 text-xs text-amber-100/70">Item salvo: {createDraftMutation.data.draft.title}</p> : null}
                {createDraftMutation.data.blockers?.length ? <p className="mt-1 text-xs text-amber-100/70">Pendências: {createDraftMutation.data.blockers.join(', ')}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showShowcasePreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Prévia da vitrine do cliente">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">Prévia da vitrine</p>
                <h3 className="mt-1 text-xl font-black text-white">Como o cliente poderá ver</h3>
                <p className="mt-1 text-sm text-zinc-500">Esta prévia é apenas visual. Ela não publica, não cobra e não libera mídia.</p>
              </div>
              <button type="button" onClick={() => setShowShowcasePreview(false)} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-zinc-300 transition hover:bg-white/10 hover:text-white" aria-label="Fechar prévia">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5">
              <ShowcaseCard
                contentType={contentType}
                selectedTypeLabel={selectedType.label}
                publicTitle={publicTitle}
                publicDescription={publicDescription}
                durationLabel={durationLabel}
                priceLabel={priceLabel}
                avatarName={avatarName}
                destinationLabel={destinationLabel}
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
