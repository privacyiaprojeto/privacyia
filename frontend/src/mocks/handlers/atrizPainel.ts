import { http, HttpResponse } from 'msw'
import {
  atividadesRecentes,
  resumoPorPeriodo,
  gerarGraficoDiario,
  gerarGraficoSemanal,
  gerarGraficoMensal,
  gerarGraficoPersonalizado,
  assinantesResumo,
  galeriaItems,
  saldoAtriz,
  ganhosAtriz,
  saquesAtriz,
  metodosRecebimento,
  notificacoesAtriz,
} from '@/mocks/data/atrizPainel'
import type { DashboardData } from '@/features/atriz/dashboard/types'
import type { SaqueItem } from '@/features/atriz/financeiro/types'

const BASE = import.meta.env.VITE_API_URL

export const atrizPainelHandlers = [
  http.get(`${BASE}/atriz/painel/dashboard`, ({ request }) => {
    const url = new URL(request.url)
    const periodo = url.searchParams.get('periodo') ?? 'mensal'
    const de = url.searchParams.get('de') ?? ''
    const ate = url.searchParams.get('ate') ?? ''

    let grafico
    switch (periodo) {
      case 'diario':
        grafico = gerarGraficoDiario()
        break
      case 'semanal':
        grafico = gerarGraficoSemanal()
        break
      case 'personalizado':
        grafico = de && ate ? gerarGraficoPersonalizado(de, ate) : gerarGraficoMensal()
        break
      default:
        grafico = gerarGraficoMensal()
    }

    const response: DashboardData = {
      resumo: resumoPorPeriodo(periodo),
      grafico,
      atividades: [...atividadesRecentes],
    }

    return HttpResponse.json(response)
  }),

  http.get(`${BASE}/atriz/painel/assinantes`, () => {
    return HttpResponse.json({ ...assinantesResumo })
  }),

  http.get(`${BASE}/atriz/painel/galeria`, () => {
    return HttpResponse.json([...galeriaItems])
  }),

  http.get(`${BASE}/atriz/painel/financeiro`, () => {
    return HttpResponse.json({
      saldo: { ...saldoAtriz },
      ganhos: [...ganhosAtriz],
      saques: [...saquesAtriz],
      metodos: [...metodosRecebimento],
    })
  }),

  http.post(`${BASE}/atriz/painel/financeiro/saque`, async ({ request }) => {
    const body = (await request.json()) as { valor: number }
    const total = body.valor
    const novo: SaqueItem = {
      id: `sq-${Date.now()}`,
      valor: total,
      status: 'pendente',
      criadaEm: new Date().toISOString(),
    }
    saquesAtriz.unshift(novo)
    saldoAtriz.pendente += total
    saldoAtriz.disponivel = 0
    saldoAtriz.creditosGastos = 0
    saldoAtriz.ganhoCreditos = 0
    return HttpResponse.json(novo, { status: 201 })
  }),

  http.get(`${BASE}/atriz/painel/notificacoes`, () => {
    return HttpResponse.json([...notificacoesAtriz])
  }),

  http.patch(`${BASE}/atriz/painel/notificacoes/:id/lida`, ({ params }) => {
    const notif = notificacoesAtriz.find((n) => n.id === params['id'])
    if (!notif) return HttpResponse.json({ message: 'Não encontrada.' }, { status: 404 })
    notif.lida = true
    return HttpResponse.json({ ...notif })
  }),
]
