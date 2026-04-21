import { useNavigate, useLocation } from 'react-router'
import clsx from 'clsx'

export function TabsGerarNsfw() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeTab = pathname.includes('gerar-video') ? 'video' : 'imagem'

  return (
    <div className="flex rounded-xl bg-zinc-800/60 p-1">
      <button
        onClick={() => navigate('/cliente/gerar-imagem')}
        className={clsx(
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition',
          activeTab === 'imagem'
            ? 'bg-violet-600 text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        Gerar imagem
      </button>
      <button
        onClick={() => navigate('/cliente/gerar-video')}
        className={clsx(
          'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition',
          activeTab === 'video'
            ? 'bg-violet-600 text-white shadow-sm'
            : 'text-zinc-400 hover:text-zinc-200',
        )}
      >
        Gerar vídeo
      </button>
    </div>
  )
}
