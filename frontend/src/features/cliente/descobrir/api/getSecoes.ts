import { api } from '@/shared/lib/axios'
import type { Secao } from '@/features/cliente/descobrir/types'

function unwrapSections(raw: unknown): Secao[] {
  if (Array.isArray(raw)) return raw as Secao[]

  if (raw && typeof raw === 'object') {
    const envelope = raw as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as Secao[]
    if (Array.isArray(envelope.items)) return envelope.items as Secao[]
    if (Array.isArray(envelope.results)) return envelope.results as Secao[]
  }

  return []
}

export async function getSecoes(): Promise<Secao[]> {
  const { data } = await api.get<unknown>('/descobrir/secoes')
  return unwrapSections(data)
}
