import { useQuery } from '@tanstack/react-query'
import { getFeedPosts } from '@/features/cliente/feed/api/getFeedPosts'

export function useFeedPosts() {
  return useQuery({
    queryKey: ['feed', 'posts'],
    queryFn: getFeedPosts,
  })
}
