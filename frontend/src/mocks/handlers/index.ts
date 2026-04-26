import type { RequestHandler } from 'msw'
import { authHandlers } from '@/mocks/handlers/auth'
import { chatHandlers } from '@/mocks/handlers/chat'
import { feedHandlers } from '@/mocks/handlers/feed'
import { galeriaHandlers } from '@/mocks/handlers/galeria'
import { carteiraHandlers } from '@/mocks/handlers/carteira'
import { notificacoesHandlers } from '@/mocks/handlers/notificacoes'
import { nsfwHandlers } from '@/mocks/handlers/nsfw'
import { perfilHandlers } from '@/mocks/handlers/perfil'
import { atrizPerfilHandlers } from '@/mocks/handlers/atrizPerfil'
import { descobrirHandlers } from '@/mocks/handlers/descobrir'
import { atrizPainelHandlers } from '@/mocks/handlers/atrizPainel'

export const handlers: RequestHandler[] = [
  ...authHandlers,
  ...chatHandlers,
  ...feedHandlers,
  ...galeriaHandlers,
  ...carteiraHandlers,
  ...notificacoesHandlers,
  ...nsfwHandlers,
  ...perfilHandlers,
  ...atrizPerfilHandlers,
  ...descobrirHandlers,
  ...atrizPainelHandlers,
]