import { http, HttpResponse } from 'msw'
import type { Mensagem, AtrizPerfil, MediaGerada } from '@/features/cliente/chat/types'
import { conversas, mensagens } from '@/mocks/data/chat'
import { mockAtrizes } from '@/mocks/data/atrizes'

const BASE = import.meta.env.VITE_API_URL

export const chatHandlers = [
  /* ── Conversas ─────────────────────────────── */
  http.get(`${BASE}/chat/conversas`, () => {
    return HttpResponse.json(conversas)
  }),

  http.get(`${BASE}/chat/conversas/:id/mensagens`, ({ params }) => {
    const lista = mensagens.filter((m) => m.conversaId === params.id)
    return HttpResponse.json(lista)
  }),

  http.post(`${BASE}/chat/conversas/:id/mensagens`, async ({ params, request }) => {
    const body = await request.json() as { conteudo: string }
    const nova: Mensagem = {
      id: `m${Date.now()}`,
      conversaId: params.id as string,
      conteudo: body.conteudo,
      de: 'cliente',
      criadaEm: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    mensagens.push(nova)

    const conversa = conversas.find((c) => c.id === params.id)
    if (conversa) {
      conversa.ultimaMensagem = nova.conteudo
      conversa.ultimaHora = nova.criadaEm
    }

    return HttpResponse.json(nova, { status: 201 })
  }),

  /* ── Perfil da atriz ────────────────────────── */
  http.get(`${BASE}/atrizes/:atrizId/perfil`, ({ params }) => {
    const atriz = mockAtrizes.find((a) => a.id === params.atrizId)
    if (!atriz) return HttpResponse.json({ message: 'Não encontrada' }, { status: 404 })

    const perfil: AtrizPerfil = {
      id: atriz.id,
      nome: atriz.nome,
      avatar: null,
      online: true,
      descricao: atriz.descricao,
      idade: atriz.idade,
      altura: atriz.altura,
      fotos: atriz.fotos,
    }

    return HttpResponse.json(perfil)
  }),

  /* ── Timeline gerada ────────────────────────── */
  http.get(`${BASE}/atrizes/:atrizId/timeline`, ({ params }) => {
    const atriz = mockAtrizes.find((a) => a.id === params.atrizId)
    if (!atriz) return HttpResponse.json([])

    const timeline: MediaGerada[] = Array.from({ length: 12 }, (_, i) => ({
      id: `${params.atrizId}-media-${i + 1}`,
      atrizId: params.atrizId as string,
      tipo: i % 5 === 0 ? 'video' : 'foto',
      url: `https://picsum.photos/seed/${atriz.nome.replace(' ', '-').toLowerCase()}-tl-${i + 1}/400/400`,
      criadaEm: new Date(Date.now() - i * 86400000).toLocaleDateString('pt-BR'),
    }))

    return HttpResponse.json(timeline)
  }),
]
