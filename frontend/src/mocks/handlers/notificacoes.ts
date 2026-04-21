import { http, HttpResponse } from 'msw'
import { notificacoesMock, preferenciasNotificacoesMock } from '@/mocks/data/notificacoes'
import type { PreferenciasNotificacao } from '@/features/cliente/notificacoes/types'

const BASE = import.meta.env.VITE_API_URL

export const notificacoesHandlers = [
  http.get(`${BASE}/notificacoes`, () => {
    const umaSemanaAtras = Date.now() - 1000 * 60 * 60 * 24 * 7
    const recentes = notificacoesMock.filter(
      (n) => new Date(n.criadaEm).getTime() > umaSemanaAtras,
    )
    return HttpResponse.json(recentes)
  }),

  http.patch(`${BASE}/notificacoes/:id/lida`, ({ params }) => {
    const notif = notificacoesMock.find((n) => n.id === params.id)
    if (!notif) return HttpResponse.json({ message: 'Não encontrada.' }, { status: 404 })
    notif.lida = true
    return HttpResponse.json(notif)
  }),

  http.post(`${BASE}/notificacoes/ler-tudo`, () => {
    notificacoesMock.forEach((n) => { n.lida = true })
    return HttpResponse.json({ ok: true })
  }),

  http.get(`${BASE}/notificacoes/preferencias`, () => {
    return HttpResponse.json({ ...preferenciasNotificacoesMock })
  }),

  http.patch(`${BASE}/notificacoes/preferencias`, async ({ request }) => {
    const body = (await request.json()) as Partial<PreferenciasNotificacao>
    if (body.marketing !== undefined) preferenciasNotificacoesMock.marketing = body.marketing
    if (body.sistema !== undefined) preferenciasNotificacoesMock.sistema = body.sistema
    return HttpResponse.json({ ...preferenciasNotificacoesMock })
  }),
]
