import { useMemo, useState } from 'react'
import type { Atriz } from '@/shared/types/atriz'
import { useAtrizes } from '@/features/cliente/descobrir/hooks/useAtrizes'
import * as mockData from '@/mocks/data/atrizes'

type Tab = 'descobrir' | 'buscar'

const mockAtrizes = ((mockData as { mockAtrizes?: Atriz[]; atrizes?: Atriz[] }).mockAtrizes
  ?? (mockData as { mockAtrizes?: Atriz[]; atrizes?: Atriz[] }).atrizes
  ?? [])

function normalizeKey(value?: string | number | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

function toSlug(value?: string | null) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getAtrizIdentityKeys(atriz: Atriz) {
  const keys = new Set<string>()
  const id = normalizeKey(atriz.id)
  const slug = toSlug(atriz.slug)
  const nome = normalizeKey(atriz.nome)
  const nomeSlug = toSlug(atriz.nome)
  const firstName = nome.split(/\s+/)[0]

  if (id) keys.add(`id:${id}`)
  if (slug) keys.add(`slug:${slug}`)
  if (nome) keys.add(`nome:${nome}`)
  if (nomeSlug) keys.add(`slug:${nomeSlug}`)

  // REGRA DE OURO: se a Sofia real veio da API, qualquer Sofia mock é duplicada.
  if (slug.includes('sofia') || nome.includes('sofia') || firstName === 'sofia') {
    keys.add('alias:sofia')
  }

  return keys
}

function hasAnyKey(atriz: Atriz, keys: Set<string>) {
  for (const key of getAtrizIdentityKeys(atriz)) {
    if (keys.has(key)) return true
  }

  return false
}

function addKeys(atriz: Atriz, keys: Set<string>) {
  for (const key of getAtrizIdentityKeys(atriz)) {
    keys.add(key)
  }
}

function rotateList<T>(list: T[], startIndex: number) {
  if (!list.length) return []
  const offset = startIndex % list.length
  return [...list.slice(offset), ...list.slice(0, offset)]
}

function normalizeRealAtriz(atriz: Atriz): Atriz {
  const avatar = atriz.avatar || atriz.thumbnailUrl || atriz.banner || ''
  const banner = atriz.banner || atriz.thumbnailUrl || avatar
  const videoUrl = atriz.videoUrl || banner || avatar

  return {
    ...atriz,
    // REGRA DE OURO: registros vindos da API/Supabase preservam o ID real.
    id: String(atriz.id),
    slug: atriz.slug || String(atriz.id),
    avatar,
    banner,
    videoUrl,
    fotos: atriz.fotos?.length ? atriz.fotos : [avatar, banner, videoUrl].filter(Boolean),
    isFallback: false,
  }
}

function normalizeFallbackAtriz(atriz: Atriz): Atriz {
  return {
    ...atriz,
    isFallback: true,
  }
}

function mergeApiAtrizesWithFallback(apiAtrizes: Atriz[]) {
  const merged: Atriz[] = []
  const usedKeys = new Set<string>()

  /**
   * Merge inteligente da vitrine:
   * 1. Atrizes reais vindas da API entram primeiro e SEMPRE vencem.
   * 2. Atrizes do mock entram apenas como preenchimento visual premium.
   * 3. Se a Sofia real veio do Supabase, a Sofia mock é removida por slug/nome/alias.
   * 4. O ID real do Supabase é preservado para manter o botão de chat ativo.
   * 5. isFallback=false é forçado para qualquer atriz real vinda da API.
   */
  for (const atriz of apiAtrizes) {
    const realAtriz = normalizeRealAtriz(atriz)
    merged.push(realAtriz)
    addKeys(realAtriz, usedKeys)
  }

  for (const mock of mockAtrizes) {
    const fallbackAtriz = normalizeFallbackAtriz(mock)

    if (hasAnyKey(fallbackAtriz, usedKeys)) {
      continue
    }

    merged.push(fallbackAtriz)
    addKeys(fallbackAtriz, usedKeys)
  }

  return merged
}

export function useDescobrir() {
  const [tab, setTab] = useState<Tab>('descobrir')
  const [busca, setBusca] = useState('')

  const { data: apiAtrizes = [] } = useAtrizes()

  const atrizes = useMemo(
    () => mergeApiAtrizesWithFallback(apiAtrizes),
    [apiAtrizes],
  )

  const atrizesFiltradas = busca.trim()
    ? atrizes.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()))
    : atrizes

  const topCreators = atrizes.slice(0, 10)
  const bombandoNoChat = rotateList(atrizes, 2).slice(0, 10)
  const novosCriadores = rotateList(atrizes, 5).slice(0, 12)
  const rumoAoTopo = rotateList(atrizes, 8).slice(0, 8)
  const recentes = atrizes.slice(0, 5)

  return { tab, setTab, busca, setBusca, atrizesFiltradas, topCreators, bombandoNoChat, novosCriadores, rumoAoTopo, recentes }
}
