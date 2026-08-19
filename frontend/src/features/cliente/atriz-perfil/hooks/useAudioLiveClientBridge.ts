import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getLiveAudioDeliveries,
  isExplicitLiveAudioDelivery,
  type MediaDeliveryListItem,
} from '@/features/cliente/atriz-perfil/api/liveAudioClientApi'
import { getMediaPurchasePreview } from '@/features/cliente/media-purchase'
import type { AtrizPerfilPublico, LiveAudioItem } from '@/features/cliente/atriz-perfil/types'

type BridgeStatus = 'idle' | 'loading' | 'playing' | 'error'

export interface AudioLivePlayerState {
  status: BridgeStatus
  item: LiveAudioItem | null
  audioUrl: string | null
  error: string | null
}

function normalizeKey(value: unknown) {
  return String(value || '').trim()
}

function isSameId(a: unknown, b: unknown) {
  const left = normalizeKey(a).toLowerCase()
  const right = normalizeKey(b).toLowerCase()
  return Boolean(left && right && left === right)
}

function deliveryBelongsToAtriz(delivery: MediaDeliveryListItem, atriz: AtrizPerfilPublico | undefined) {
  const targetId = normalizeKey(atriz?.id)
  if (!targetId) return false

  return [
    delivery.companionId,
    delivery.companion?.id,
  ].some((value) => isSameId(value, targetId))
}

function filterDeliveriesForAtriz(deliveries: MediaDeliveryListItem[], atriz: AtrizPerfilPublico | undefined) {
  return (deliveries || []).filter((delivery) => deliveryBelongsToAtriz(delivery, atriz))
}

function itemBelongsToAtriz(item: LiveAudioItem, atriz: AtrizPerfilPublico | undefined) {
  const raw = item as LiveAudioItem & { companionId?: string | null }
  if (!raw.companionId) return true
  return isSameId(raw.companionId, atriz?.id)
}

function isExplicitLiveAudioItem(item: LiveAudioItem) {
  const mediaType = String(item.mediaContract?.mediaType || item.mediaType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  return mediaType === 'audio_live' || mediaType === 'live_audio'
}

function getDeliveryKeys(delivery: MediaDeliveryListItem) {
  return [
    delivery.id,
    delivery.variantId,
    delivery.combinationId,
    delivery.companionId,
    delivery.asset?.id,
    delivery.asset?.variantId,
    delivery.combination?.id,
  ]
    .map(normalizeKey)
    .filter(Boolean)
}

function getItemKeys(item: LiveAudioItem) {
  const raw = item as LiveAudioItem & {
    outputVariantId?: string | null
    variantId?: string | null
    combinationId?: string | null
    deliveryId?: string | null
  }

  return [
    raw.id,
    raw.outputVariantId,
    raw.variantId,
    raw.combinationId,
    raw.deliveryId,
  ]
    .map(normalizeKey)
    .filter(Boolean)
}

function itemHasStrongDeliveryKey(item: LiveAudioItem) {
  const raw = item as LiveAudioItem & {
    outputVariantId?: string | null
    variantId?: string | null
    combinationId?: string | null
    deliveryId?: string | null
  }

  return Boolean(raw.outputVariantId || raw.variantId || raw.combinationId || raw.deliveryId)
}

function buildDeliveryIndex(deliveries: MediaDeliveryListItem[]) {
  const index = new Map<string, MediaDeliveryListItem>()

  for (const delivery of deliveries) {
    for (const key of getDeliveryKeys(delivery)) {
      if (!index.has(key)) {
        index.set(key, delivery)
      }
    }
  }

  return index
}

function isPlayableAudioLiveDelivery(delivery: MediaDeliveryListItem) {
  return Boolean(delivery.protectedViewUrl)
    && isExplicitLiveAudioDelivery(delivery)
    && delivery.mediaContract?.clientOpenable === true
}

function firstName(value: unknown) {
  return String(value || 'Avatar').split(' ')[0] || 'Avatar'
}

function makeUnlockedItemFromDelivery(atriz: AtrizPerfilPublico, delivery: MediaDeliveryListItem, index: number): LiveAudioItem {
  const title = delivery.combination?.title || `Audio Live liberado ${index + 1}`
  const price = delivery.pricing?.totalPriceCredits ?? delivery.combination?.priceCredits ?? null

  return {
    id: delivery.variantId || delivery.combinationId || delivery.id,
    titulo: title,
    descricao: `Áudio narrativo liberado de ${firstName(atriz.nome)}.`,
    duracao: 'Audio Live',
    priceCredits: price,
    bloqueado: false,
    purchased: true,
    protectedViewUrl: delivery.protectedViewUrl,
    companionId: delivery.companionId || delivery.companion?.id || atriz.id,
    outputVariantId: delivery.variantId,
    variantId: delivery.variantId,
    combinationId: delivery.combinationId,
    deliveryId: delivery.id,
    mediaType: delivery.mediaContract?.mediaType || delivery.asset?.mediaType || delivery.combination?.mediaType || 'audio_live',
    mediaContract: delivery.mediaContract || null,
  }
}

function enrichItemWithDelivery(item: LiveAudioItem, delivery?: MediaDeliveryListItem | null): LiveAudioItem {
  if (!delivery || !isPlayableAudioLiveDelivery(delivery)) return item

  return {
    ...item,
    purchased: true,
    bloqueado: false,
    protectedViewUrl: delivery.protectedViewUrl,
    companionId: (item as LiveAudioItem & { companionId?: string | null }).companionId || delivery.companionId || delivery.companion?.id || null,
    deliveryId: delivery.id,
    outputVariantId: item.outputVariantId || delivery.variantId,
    variantId: item.variantId || delivery.variantId,
    combinationId: item.combinationId || delivery.combinationId,
    priceCredits: item.priceCredits ?? delivery.pricing?.totalPriceCredits ?? delivery.combination?.priceCredits ?? null,
    mediaType: item.mediaType || delivery.mediaContract?.mediaType || delivery.asset?.mediaType || delivery.combination?.mediaType || null,
    mediaContract: delivery.mediaContract || item.mediaContract || null,
  }
}

function findDirectDeliveryForItem(item: LiveAudioItem, index: Map<string, MediaDeliveryListItem>) {
  return getItemKeys(item)
    .map((key) => index.get(key))
    .find((delivery): delivery is MediaDeliveryListItem => Boolean(delivery && isPlayableAudioLiveDelivery(delivery)))
}

function resolveFallbackDeliveryForUnlockedStaticCard(item: LiveAudioItem, deliveries: MediaDeliveryListItem[]) {
  // O layout antigo pode trazer cards estáticos marcados como "Liberado" sem variantId/deliveryId.
  // Nesses casos, se o cliente possuir exatamente um Audio Live protegido dessa avatar,
  // abrimos esse delivery em vez de deixar o clique morrer em erro falso.
  if (itemHasStrongDeliveryKey(item)) return null

  const playableDeliveries = deliveries.filter(isPlayableAudioLiveDelivery)
  if (playableDeliveries.length === 1) return playableDeliveries[0]

  return null
}

function resolveDeliveryForItem(
  item: LiveAudioItem,
  index: Map<string, MediaDeliveryListItem>,
  deliveries: MediaDeliveryListItem[],
) {
  return findDirectDeliveryForItem(item, index) || resolveFallbackDeliveryForUnlockedStaticCard(item, deliveries)
}

function mergeLiveAudioDeliveries(atriz: AtrizPerfilPublico | undefined, deliveries: MediaDeliveryListItem[]): AtrizPerfilPublico | undefined {
  if (!atriz) return atriz

  const scopedDeliveries = filterDeliveriesForAtriz(deliveries, atriz).filter(isExplicitLiveAudioDelivery)
  const deliveryIndex = buildDeliveryIndex(scopedDeliveries)
  const consumedDeliveryIds = new Set<string>()
  const injectedUnlockedItems: LiveAudioItem[] = []

  scopedDeliveries
    .filter((delivery) => isPlayableAudioLiveDelivery(delivery))
    .forEach((delivery, index) => {
      injectedUnlockedItems.push(makeUnlockedItemFromDelivery(atriz, delivery, index))
      consumedDeliveryIds.add(delivery.id)
    })

  const existingItems = (atriz.liveAudios || [])
    .filter(isExplicitLiveAudioItem)
    .filter((item) => itemBelongsToAtriz(item, atriz))
    .map((item) => {
      const matchedDelivery = resolveDeliveryForItem(item, deliveryIndex, scopedDeliveries)
      if (matchedDelivery?.id) consumedDeliveryIds.add(matchedDelivery.id)
      return enrichItemWithDelivery(item, matchedDelivery)
    })

  // Prioriza o card real liberado vindo de delivery do MESMO avatar. Os cards antigos continuam
  // na vitrine, mas não devem fingir liberação com entrega de outra personagem.
  const liveAudios = [
    ...injectedUnlockedItems,
    ...existingItems.filter((item) => !item.protectedViewUrl || !injectedUnlockedItems.some((unlocked) => unlocked.deliveryId && unlocked.deliveryId === item.deliveryId)),
  ]

  return {
    ...atriz,
    liveAudios,
  }
}

export function useAudioLiveClientBridge(atriz: AtrizPerfilPublico | undefined) {
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [player, setPlayer] = useState<AudioLivePlayerState>({
    status: 'idle',
    item: null,
    audioUrl: null,
    error: null,
  })

  const deliveriesQuery = useQuery({
    queryKey: ['cliente', 'audio-live-deliveries', atriz?.id],
    queryFn: () => getLiveAudioDeliveries(String(atriz?.id || '')),
    enabled: Boolean(atriz?.id),
    staleTime: 10_000,
  })

  const rawDeliveries = deliveriesQuery.data?.items || []
  const deliveries = useMemo(() => filterDeliveriesForAtriz(rawDeliveries, atriz), [rawDeliveries, atriz?.id])
  const deliveryIndex = useMemo(() => buildDeliveryIndex(deliveries), [deliveries])
  const atrizComAudioLive = useMemo(() => mergeLiveAudioDeliveries(atriz, deliveries), [atriz, deliveries])

  const fecharPlayer = useCallback(() => {
    setPlayer({ status: 'idle', item: null, audioUrl: null, error: null })
  }, [])

  const resolveItemFromCurrentDeliveries = useCallback((item: LiveAudioItem, index = deliveryIndex, currentDeliveries = deliveries) => {
    const matchedDelivery = resolveDeliveryForItem(item, index, currentDeliveries)
    return enrichItemWithDelivery(item, matchedDelivery)
  }, [deliveries, deliveryIndex])

  const tocarAudioLive = useCallback(async (item: LiveAudioItem) => {
    let playableItem = resolveItemFromCurrentDeliveries(item)

    setPlayer({ status: 'loading', item: playableItem, audioUrl: null, error: null })

    if (!playableItem.protectedViewUrl) {
      try {
        const refreshed = await deliveriesQuery.refetch()
        const refreshedDeliveries = filterDeliveriesForAtriz(refreshed.data?.items || [], atriz)
        const refreshedIndex = buildDeliveryIndex(refreshedDeliveries)
        playableItem = resolveItemFromCurrentDeliveries(item, refreshedIndex, refreshedDeliveries)
      } catch (error) {
        console.error('Erro ao atualizar entregas do Audio Live:', error)
      }
    }

    if (!playableItem.protectedViewUrl) {
      setPlayer({
        status: 'error',
        item: playableItem,
        audioUrl: null,
        error: 'Audio Live ainda não liberado para este usuário. Entre com o cliente que comprou esse item ou crie a entrega para este perfil.',
      })
      return
    }

    // O componente ProtectedMedia troca esta rota autenticada por um token curto
    // e reproduz por streaming, sem baixar o arquivo inteiro como Blob.
    setPlayer({ status: 'playing', item: playableItem, audioUrl: playableItem.protectedViewUrl, error: null })
  }, [atriz, deliveriesQuery, resolveItemFromCurrentDeliveries])

  const comprarAudioLive = useCallback(async (item: LiveAudioItem) => {
    const playableItem = resolveItemFromCurrentDeliveries(item)

    if (playableItem.protectedViewUrl) {
      await tocarAudioLive(playableItem)
      return
    }

    const assetId = playableItem.outputVariantId || playableItem.variantId || item.outputVariantId || item.variantId || null

    setPurchasingId(item.id)

    if (!assetId) {
      setPlayer({
        status: 'error',
        item,
        audioUrl: null,
        error: 'Compra protegida ainda não está disponível para este Audio Live.',
      })
      setPurchasingId(null)
      return
    }

    try {
      const preview = await getMediaPurchasePreview(assetId)
      const contract = preview.purchaseContract

      if (contract.alreadyDelivered && preview.protectedViewUrl) {
        await tocarAudioLive({
          ...playableItem,
          protectedViewUrl: preview.protectedViewUrl,
          deliveryId: preview.existingDeliveryId || playableItem.deliveryId || null,
        })
        setPurchasingId(null)
        return
      }

      if (contract.clientPurchasable && contract.canCharge) {
        const creditsLabel = contract.priceCredits > 0 ? `${contract.priceCredits} créditos` : 'créditos configurados'
        setPlayer({
          status: 'error',
          item,
          audioUrl: null,
          error: `Compra protegida pronta (${creditsLabel}). A cobrança real ainda está bloqueada nesta etapa de validação.`,
        })
        setPurchasingId(null)
        return
      }

      setPlayer({
        status: 'error',
        item,
        audioUrl: null,
        error: contract.userMessage || 'Esta mídia ainda não está disponível para compra protegida.',
      })
    } catch (error) {
      console.error('Erro ao consultar preview de compra do Audio Live:', error)
      setPlayer({
        status: 'error',
        item,
        audioUrl: null,
        error: 'Não foi possível consultar a compra protegida agora.',
      })
    } finally {
      setPurchasingId(null)
    }
  }, [resolveItemFromCurrentDeliveries, tocarAudioLive])


  return {
    atriz: atrizComAudioLive,
    deliveries,
    isLoadingDeliveries: deliveriesQuery.isLoading,
    playingId: player.status !== 'idle' ? player.item?.id || null : null,
    purchasingId,
    player,
    tocarAudioLive,
    comprarAudioLive,
    fecharPlayer,
    refetchDeliveries: deliveriesQuery.refetch,
  }
}
