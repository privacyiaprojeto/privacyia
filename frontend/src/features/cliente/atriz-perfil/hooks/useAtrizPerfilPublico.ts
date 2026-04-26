import { useQuery } from '@tanstack/react-query'
import { getAtrizPerfilPublico } from '@/features/cliente/atriz-perfil/api/getAtrizPerfilPublico'
import { enrichAtrizPublicProfile } from '@/shared/fallbacks/actresses'

export function useAtrizPerfilPublico(slug: string) {
  return useQuery({
    queryKey: ['atriz-perfil', slug],
    queryFn: async () => {
      try {
        return await getAtrizPerfilPublico(slug)
      } catch {
        return enrichAtrizPublicProfile({ slug })
      }
    },
    enabled: !!slug,
    select: (data) => enrichAtrizPublicProfile(data),
  })
}
