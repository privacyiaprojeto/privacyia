import clsx from 'clsx'
import type { Mensagem } from '@/features/cliente/chat/types'

interface Props {
  mensagem: Mensagem
}

export function MessageBubble({ mensagem }: Props) {
  const isCliente = mensagem.de === 'cliente'

  return (
    <div className={clsx('flex w-full', isCliente ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
          isCliente
            ? 'rounded-br-sm bg-violet-600 text-white'
            : 'rounded-bl-sm bg-zinc-800 text-zinc-100'
        )}
      >
        <p className="leading-relaxed">{mensagem.conteudo}</p>
        <span
          className={clsx(
            'mt-1 block text-right text-[10px]',
            isCliente ? 'text-violet-300' : 'text-zinc-500'
          )}
        >
          {mensagem.criadaEm}
        </span>
      </div>
    </div>
  )
}
