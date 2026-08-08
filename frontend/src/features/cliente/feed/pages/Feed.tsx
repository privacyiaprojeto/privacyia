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
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">

          <div className="mx-auto flex w-full max-w-[620px] flex-col gap-6 lg:mx-0">

            {loadingPosts && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/50 p-8 text-center text-sm text-zinc-500">
                Carregando feed…
              </div>
            )}

            {isError && (
              <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8 text-center text-sm text-red-300">
                <p className="font-semibold">Erro ao carregar feed</p>
                <p className="mt-2 text-xs text-red-200/70">{parseApiError(error)}</p>
              </div>
            )}

            {!loadingPosts && !isError && posts.length === 0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
                <p className="text-sm font-semibold text-zinc-300">Nenhum post encontrado.</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Enquanto novos conteúdos não são publicados no feed, explore as sugestões ao lado ou acesse Gerar NSFW.
                </p>
              </div>
            )}

            {posts.map((post, i) => (
              <div key={post.id} className="flex flex-col gap-6">
                <PostCard post={post} />

                {i === 0 && sugestoes.length > 0 && (
                  <CarouselEntrePostsBlock atrizes={sugestoes.slice(0, 8)} />
                )}

                {i === 1 && top10.length > 0 && (
                  <Top10Block items={top10} />
                )}
              </div>
            ))}
          </div>

          {sugestoes.length > 0 && (
            <aside className="mt-6 hidden lg:mt-0 lg:block">
              <SugestoesColuna atrizes={sugestoes} />
            </aside>
          )}

        </div>
      </div>
    </ClienteLayout>
  )
}
