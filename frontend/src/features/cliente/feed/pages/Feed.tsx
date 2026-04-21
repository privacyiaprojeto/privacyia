import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { PostCard } from '@/features/cliente/feed/components/PostCard'
import { CarouselEntrePostsBlock } from '@/features/cliente/feed/components/CarouselEntrePostsBlock'
import { Top10Block } from '@/features/cliente/feed/components/Top10Block'
import { SugestoesColuna } from '@/features/cliente/feed/components/SugestoesColuna'
import { useFeedPosts } from '@/features/cliente/feed/hooks/useFeedPosts'
import { useSugestoes } from '@/features/cliente/feed/hooks/useSugestoes'
import { useTop10 } from '@/features/cliente/feed/hooks/useTop10'
import { parseApiError } from '@/shared/utils/parseApiError'

export function Feed() {
  const { data: posts = [], isLoading: loadingPosts, isError, error } = useFeedPosts()
  const { data: sugestoes = [] } = useSugestoes()
  const { data: top10 = [] } = useTop10()

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-5xl px-4 py-4">
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-8">

          {/* Coluna do feed */}
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 lg:mx-0">

            {loadingPosts && (
              <div className="flex justify-center py-16 text-sm text-zinc-500">
                Carregando feed…
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center gap-2 py-16 text-sm text-red-400">
                <span>Erro ao carregar feed</span>
                <span className="text-xs text-zinc-500">{parseApiError(error)}</span>
              </div>
            )}

            {!loadingPosts && !isError && posts.length === 0 && (
              <div className="flex justify-center py-16 text-sm text-zinc-500">
                Nenhum post encontrado.
              </div>
            )}

            {posts.map((post, i) => (
              <div key={post.id} className="flex flex-col gap-6">
                <PostCard post={post} />

                {sugestoes.length > 0 && (
                  <CarouselEntrePostsBlock atrizes={sugestoes} />
                )}

                {i === 1 && top10.length > 0 && (
                  <Top10Block items={top10} />
                )}
              </div>
            ))}
          </div>

          {/* Coluna de sugestões — só desktop */}
          {sugestoes.length > 0 && (
            <aside className="hidden lg:block">
              <SugestoesColuna atrizes={sugestoes} />
            </aside>
          )}

        </div>
      </div>
    </ClienteLayout>
  )
}
