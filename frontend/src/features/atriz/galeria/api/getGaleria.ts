import { api } from '@/shared/lib/axios'
import type { GaleriaItem } from '@/features/atriz/galeria/types'

export async function getGaleria(): Promise<GaleriaItem[]> {
  const { data } = await api.get<GaleriaItem[]>('/atriz/painel/galeria')
  return data
}
