import { api } from '@/shared/lib/axios'
import type { CarteiraResumo } from '@/features/cliente/carteira/types'

export async function getCarteira(): Promise<CarteiraResumo> {
  const { data } = await api.get<CarteiraResumo>('/carteira')
  return data
}
