import { useMemo, useState } from 'react'
import type { Atriz } from '@/shared/types/atriz'
import { useAtrizes } from '@/features/cliente/descobrir/hooks/useAtrizes'
import { mockAtrizes } from '@/mocks/data/atrizes'
import { enrichAtriz } from '@/shared/fallbacks/actresses'

type Tab = 'descobrir' | 'buscar'

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

  if (id) keys.add(`id:${id}`)
  if (slug) keys.add(`slug:${slug}`)
  if (nome) keys.add(`nome:${nome}`)
  if (nomeSlug) keys.add(`slug:${nomeSlug}`)

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

function mergeApiAtrizesWithFallback(apiAtrizes: Atriz[]) {
  const merged: Atriz[] = []
  const usedKeys = new Set<string>()

  /**
   * Merge inteligente da vitrine:
   * 1. Atrizes reais vindas da API entram primeiro e SEMPRE vencem.
   * 2. Atrizes do actresses.ts/mock entram apenas como preenchimento visual premium.
   * 3. Se a Sofia real veio do Supabase, a Sofia fallback é removida por slug/nome.
   * 4. O ID real do Supabase é preservado para manter o botão de chat ativo.
   */
  for (const atriz of apiAtrizes) {
    const realAtriz = enrichAtriz(atriz)
    merged.push(realAtriz)
    addKeys(realAtriz, usedKeys)
  }

  for (const mock of mockAtrizes) {
    const fallbackAtriz = enrichAtriz(mock)

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

  return {
    tab,
    setTab,
    busca,
    setBusca,
    atrizesFiltradas,
    topCreators,
    bombandoNoChat,
    novosCriadores,
    rumoAoTopo,
    recentes,
  }
}
