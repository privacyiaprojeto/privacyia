interface PostMediaProps {
  tipo: 'foto' | 'video'
  url: string
  nome: string
}

export function PostMedia({ tipo, url, nome }: PostMediaProps) {
  return (
    <div className="aspect-[4/5] w-full overflow-hidden bg-zinc-950">
      {tipo === 'video' ? (
        <video
          src={url}
          className="h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <img
          src={url}
          alt={`Post de ${nome}`}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}
