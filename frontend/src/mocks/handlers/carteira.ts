import { http, HttpResponse } from 'msw'
import {
  carteiraResumo,
  historicoCreditos,
  historicoPagamentos,
  metodosPagamento,
  pacotesCreditos,
} from '@/mocks/data/carteira'
import type { AdicionarMetodoInput, MetodoPagamento } from '@/features/cliente/carteira/types'

const BASE = import.meta.env.VITE_API_URL

export const carteiraHandlers = [
  http.get(`${BASE}/carteira`, () => {
    return HttpResponse.json({ ...carteiraResumo })
  }),

  http.get(`${BASE}/carteira/historico-creditos`, () => {
    return HttpResponse.json([...historicoCreditos])
  }),

  http.get(`${BASE}/carteira/historico-pagamentos`, () => {
    return HttpResponse.json([...historicoPagamentos])
  }),

  http.get(`${BASE}/carteira/metodos-pagamento`, () => {
    return HttpResponse.json([...metodosPagamento])
  }),

  http.post(`${BASE}/carteira/metodos-pagamento`, async ({ request }) => {
    const body = (await request.json()) as AdicionarMetodoInput
    const novo: MetodoPagamento = {
      id: `mp-${Date.now()}`,
      tipo: body.tipo,
      bandeira: body.bandeira,
      ultimosDigitos: body.ultimosDigitos,
      apelido: body.apelido,
      criadaEm: new Date().toISOString(),
    }
    metodosPagamento.push(novo)
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.get(`${BASE}/carteira/pacotes`, () => {
    return HttpResponse.json([...pacotesCreditos])
  }),

  http.post(`${BASE}/carteira/comprar`, async ({ request }) => {
    const body = (await request.json()) as { pacoteId: string; metodoId: string }
    const pacote = pacotesCreditos.find((p) => p.id === body.pacoteId)
    if (!pacote) return HttpResponse.json({ message: 'Pacote não encontrado.' }, { status: 404 })
    carteiraResumo.creditos += pacote.creditos
    historicoCreditos.unshift({
      id: `tc-${Date.now()}`,
      tipo: 'entrada',
      descricao: `Compra de pacote ${pacote.creditos} créditos`,
      valor: pacote.creditos,
      criadaEm: new Date().toISOString(),
    })
    historicoPagamentos.unshift({
      id: `hp-${Date.now()}`,
      tipo: 'compra',
      descricao: `Pacote ${pacote.creditos} créditos`,
      valor: pacote.preco,
      status: 'aprovado',
      criadaEm: new Date().toISOString(),
    })
    return HttpResponse.json({ ...carteiraResumo })
  }),
]
