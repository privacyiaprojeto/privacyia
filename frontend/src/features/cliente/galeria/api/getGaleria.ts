import { api } from '@/shared/lib/axios'
import type { GaleriaAtriz } from '@/features/cliente/galeria/types'

export async function getGaleria(q?: string): Promise<GaleriaAtriz[]> {
  const { data } = await api.get<GaleriaAtriz[]>('/galeria', { params: q ? { q } : undefined })
  return data
}
