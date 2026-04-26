import { useQuery } from '@tanstack/react-query'
import { getPerfil } from '@/features/cliente/perfil/api/getPerfil'

export function usePerfil() {
  return useQuery({
    queryKey: ['cliente', 'perfil'],
    queryFn: getPerfil,
  })
}
