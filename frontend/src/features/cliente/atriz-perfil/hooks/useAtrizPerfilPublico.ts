import { useQuery } from '@tanstack/react-query'
import { getAtrizPerfilPublico } from '@/features/cliente/atriz-perfil/api/getAtrizPerfilPublico'

export function useAtrizPerfilPublico(slug: string) {
  return useQuery({
    queryKey: ['atriz-perfil', slug],
    queryFn: () => getAtrizPerfilPublico(slug),
    enabled: !!slug,
  })
}
