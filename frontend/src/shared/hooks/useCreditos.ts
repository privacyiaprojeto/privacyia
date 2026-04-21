import { useQuery } from '@tanstack/react-query'
import { api } from '@/shared/lib/axios'

interface CreditosResumo {
  creditos: number
}

async function getCreditos(): Promise<CreditosResumo> {
  const { data } = await api.get<CreditosResumo>('/carteira')
  return data
}

export function useCreditos() {
  return useQuery({
    queryKey: ['carteira', 'resumo'],
    queryFn: getCreditos,
  })
}