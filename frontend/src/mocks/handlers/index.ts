import type { RequestHandler } from 'msw'
import { authHandlers } from '@/mocks/handlers/auth'
import { chatHandlers } from '@/mocks/handlers/chat'
import { feedHandlers } from '@/mocks/handlers/feed'
import { galeriaHandlers } from '@/mocks/handlers/galeria'
import { carteiraHandlers } from '@/mocks/handlers/carteira'
import { notificacoesHandlers } from '@/mocks/handlers/notificacoes'

export const handlers: RequestHandler[] = [...authHandlers, ...chatHandlers, ...feedHandlers, ...galeriaHandlers, ...carteiraHandlers, ...notificacoesHandlers]
