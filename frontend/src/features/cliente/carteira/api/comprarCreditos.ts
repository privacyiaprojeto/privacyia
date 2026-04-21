import { api } from '@/shared/lib/axios'
import type { CarteiraResumo, ComprarCreditosInput } from '@/features/cliente/carteira/types'

export async function comprarCreditos(input: ComprarCreditosInput): Promise<CarteiraResumo> {
  const { data } = await api.post<CarteiraResumo>('/carteira/comprar', input)
  return data
}
