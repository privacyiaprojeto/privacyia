import { useNavigate } from 'react-router'

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950">

      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-4 text-center">

        {/* Título */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="bg-gradient-to-br from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-7xl font-bold tracking-tight text-transparent">
            Privacy IA
          </h1>
          <p className="max-w-sm text-base text-zinc-400">
            Proteção de dados inteligente, simples e automatizada para o seu negócio.
          </p>
        </div>

        {/* Botões */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={() => navigate('/sign-up')}
            className="w-52 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95"
          >
            Criar conta grátis
          </button>
          <button
            onClick={() => navigate('/sign-in')}
            className="w-52 rounded-xl border border-violet-500/40 bg-violet-500/10 px-6 py-3 text-sm font-semibold text-violet-300 transition hover:border-violet-400/70 hover:bg-violet-500/20 hover:text-violet-200 active:scale-95"
          >
            Já tenho uma conta
          </button>
        </div>

      </div>
    </div>
  )
}
