import {
  AlertTriangle,
  BadgeCheck,
  Coins,
  Eye,
  Headphones,
  Image,
  LockKeyhole,
  PackageCheck,
  PlaySquare,
  ShoppingBag,
} from 'lucide-react'
import { useCreatorProducts } from '@/features/atriz/creator/hooks'
import type { CreatorMediaType, CreatorProduct } from '@/features/atriz/creator/types'

function formatDate(value: string | null) {
  if (!value) return 'Sem atualização registrada'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function mediaConfig(mediaType: CreatorMediaType) {
  if (mediaType === 'audio') return { label: 'Áudio', icon: Headphones, className: 'bg-violet-500/10 text-violet-300' }
  if (mediaType === 'video') return { label: 'Vídeo', icon: PlaySquare, className: 'bg-blue-500/10 text-blue-300' }
  if (mediaType === 'liveAction') return { label: 'Live Action', icon: PlaySquare, className: 'bg-amber-500/10 text-amber-300' }
  return { label: 'Imagem', icon: Image, className: 'bg-pink-500/10 text-pink-300' }
}

function ProductCard({ product }: { product: CreatorProduct }) {
  const config = mediaConfig(product.mediaType)
  const Icon = config.icon

  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-zinc-700">
      <div className="flex items-start justify-between gap-4">
        <div className={`rounded-xl p-2.5 ${config.className}`}><Icon size={20} /></div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
          <Eye size={12} /> Publicado
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 min-h-12 text-base font-semibold leading-relaxed text-zinc-100">{product.title}</h3>
      <p className="mt-1 text-xs text-zinc-600">{config.label} · Atualizado em {formatDate(product.updatedAt)}</p>

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
          <p className="text-lg font-bold text-zinc-100">{product.priceCredits}</p>
          <p className="mt-1 text-[11px] text-zinc-600">Créditos</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
          <p className="text-lg font-bold text-zinc-100">{product.approvedVariants}</p>
          <p className="mt-1 text-[11px] text-zinc-600">Variações</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
          <p className="text-lg font-bold text-zinc-100">{product.totalDeliveries}</p>
          <p className="mt-1 text-[11px] text-zinc-600">Entregas</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        <LockKeyhole size={13} className="text-zinc-600" />
        Preços e publicação são cuidados pela equipe responsável.
      </div>
    </article>
  )
}

export function ProductsPage() {
  const { data, isLoading, isError, refetch } = useCreatorProducts()

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
        <AlertTriangle className="mx-auto text-red-300" size={30} />
        <h2 className="mt-4 text-lg font-semibold text-zinc-100">Não foi possível carregar seus produtos</h2>
        <button type="button" onClick={() => void refetch()} className="mt-5 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300">
              <BadgeCheck size={13} /> Minha vitrine
            </div>
            <h2 className="mt-4 text-2xl font-bold text-zinc-50">Meus Produtos de IA</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Acompanhe os produtos publicados com sua autorização, além de preços, versões aprovadas e entregas realizadas.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center gap-3">
              <LockKeyhole size={20} className="text-pink-300" />
              <div>
                <p className="text-sm font-semibold text-zinc-100">Conteúdo protegido</p>
                <p className="mt-1 text-xs text-zinc-500">A produção, os preços e a publicação são cuidados pela equipe responsável.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-blue-500/10 p-2.5 text-blue-300"><PackageCheck size={19} /></div>
          <p className="mt-4 text-3xl font-bold text-zinc-50">{data.summary.activeProducts}</p>
          <p className="mt-1 text-sm text-zinc-500">Produtos publicados</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-pink-500/10 p-2.5 text-pink-300"><Image size={19} /></div>
          <p className="mt-4 text-3xl font-bold text-zinc-50">{data.summary.totalApprovedVariants}</p>
          <p className="mt-1 text-sm text-zinc-500">Variações aprovadas</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300"><ShoppingBag size={19} /></div>
          <p className="mt-4 text-3xl font-bold text-zinc-50">{data.summary.totalDeliveries}</p>
          <p className="mt-1 text-sm text-zinc-500">Entregas registradas</p>
        </div>
      </section>

      {data.products.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {data.products.map((product) => <ProductCard key={product.id} product={product} />)}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Coins size={32} className="mx-auto text-zinc-700" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-300">Nenhum produto publicado ainda</h3>
          <p className="mt-2 text-sm text-zinc-600">Quando a equipe publicar um produto aprovado, ele aparecerá aqui automaticamente.</p>
        </section>
      )}
    </div>
  )
}
