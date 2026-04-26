import type { DashboardResumo, GraficoPonto, AtividadeItem } from '@/features/atriz/dashboard/types'
import type { AssinantesResumo } from '@/features/atriz/assinantes/types'
import type { GaleriaItem } from '@/features/atriz/galeria/types'
import type {
  SaldoAtriz,
  GanhoItem,
  SaqueItem,
  MetodoRecebimento,
} from '@/features/atriz/financeiro/types'
import type { NotificacaoAtriz } from '@/features/atriz/notificacoes/types'

export const dashboardResumo: DashboardResumo = {
  ganhosMes: 4870.5,
  totalAssinantes: 312,
  mensagensIA: 1847,
  imagensGeradas: 634,
  creditosGastos: 28340,
}

// Generates earnings data for the last N days relative to 2025-04-24
const BASE_DATE = new Date('2025-04-24T00:00:00Z')

function daysAgo(n: number): Date {
  const d = new Date(BASE_DATE)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

function fmt(d: Date, mode: 'day' | 'hour' = 'day'): string {
  if (mode === 'hour') {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

// 30-day earnings series with realistic variance
const DAILY_VALUES_30: number[] = [
  142, 89, 205, 178, 310, 98, 267, 189, 340, 156,
  220, 134, 290, 167, 198, 312, 88, 245, 321, 176,
  203, 158, 287, 199, 334, 112, 263, 188, 410, 278,
]

export function gerarGraficoMensal(): GraficoPonto[] {
  return DAILY_VALUES_30.map((valor, i) => ({
    label: fmt(daysAgo(29 - i)),
    valor,
  }))
}

export function gerarGraficoSemanal(): GraficoPonto[] {
  return DAILY_VALUES_30.slice(23).map((valor, i) => ({
    label: fmt(daysAgo(6 - i)),
    valor,
  }))
}

export function gerarGraficoDiario(): GraficoPonto[] {
  // Simulate today's earnings hour by hour (0h–23h)
  const hourlyValues = [
    0, 0, 0, 0, 0, 12, 49.9, 29, 0, 8.5,
    49.9, 0, 22, 0, 15, 49.9, 0, 8.5, 29, 0,
    49.9, 0, 15, 22,
  ]
  return hourlyValues.map((valor, h) => ({
    label: `${String(h).padStart(2, '0')}h`,
    valor,
  }))
}

export function gerarGraficoPersonalizado(de: string, ate: string): GraficoPonto[] {
  const start = new Date(de)
  const end = new Date(ate)
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000)
  const days = Math.min(Math.max(diff, 1), 90)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    return {
      label: fmt(d),
      valor: Math.round(50 + Math.random() * 350),
    }
  })
}

export function resumoPorPeriodo(periodo: string): DashboardResumo {
  switch (periodo) {
    case 'diario':
      return { ganhosMes: 278, totalAssinantes: 312, mensagensIA: 63, imagensGeradas: 21, creditosGastos: 940 }
    case 'semanal':
      return { ganhosMes: 1340, totalAssinantes: 312, mensagensIA: 412, imagensGeradas: 148, creditosGastos: 6580 }
    default:
      return { ...dashboardResumo }
  }
}

// Recent activity feed — no client identifiers exposed
export const atividadesRecentes: AtividadeItem[] = [
  {
    id: 'at-1',
    tipo: 'assinante',
    descricao: 'Novo assinante mensal',
    criadaEm: '2025-04-23T08:00:00Z',
  },
  {
    id: 'at-2',
    tipo: 'ganho',
    descricao: 'Assinatura mensal recebida',
    valor: 49.9,
    criadaEm: '2025-04-23T07:45:00Z',
  },
  {
    id: 'at-3',
    tipo: 'imagem_gerada',
    descricao: 'Imagem gerada por assinante',
    valor: 15.0,
    criadaEm: '2025-04-22T21:05:00Z',
  },
  {
    id: 'at-4',
    tipo: 'mensagem',
    descricao: 'Sessão de mensagens via IA',
    valor: 8.5,
    criadaEm: '2025-04-22T17:33:00Z',
  },
  {
    id: 'at-5',
    tipo: 'ganho',
    descricao: 'Assinatura mensal recebida',
    valor: 49.9,
    criadaEm: '2025-04-22T09:00:00Z',
  },
  {
    id: 'at-6',
    tipo: 'imagem_gerada',
    descricao: 'Vídeo gerado por assinante',
    valor: 22.0,
    criadaEm: '2025-04-21T20:15:00Z',
  },
  {
    id: 'at-7',
    tipo: 'ganho',
    descricao: 'Assinatura mensal recebida',
    valor: 49.9,
    criadaEm: '2025-04-21T08:00:00Z',
  },
  {
    id: 'at-8',
    tipo: 'assinante',
    descricao: 'Novo assinante mensal',
    criadaEm: '2025-04-03T09:30:00Z',
  },
]

export const assinantesResumo: AssinantesResumo = {
  totalAtivos: 312,
  totalInativos: 27,
  novosEsteMes: 34,
  planos: [
    {
      tipo: 'mensal',
      quantidade: 286,
      valorMensal: 49.9,
      receitaMensal: 14271.4,
      crescimento: 12,
    },
    {
      tipo: 'trimestral',
      quantidade: 18,
      valorMensal: 39.9,
      receitaMensal: 718.2,
      crescimento: 5,
    },
    {
      tipo: 'anual',
      quantidade: 8,
      valorMensal: 29.9,
      receitaMensal: 239.2,
      crescimento: 25,
    },
  ],
  historico: [
    { label: 'Nov', total: 198 },
    { label: 'Dez', total: 224 },
    { label: 'Jan', total: 251 },
    { label: 'Fev', total: 270 },
    { label: 'Mar', total: 289 },
    { label: 'Abr', total: 312 },
  ],
}

export const galeriaItems: GaleriaItem[] = [
  // Admin-generated
  { id: 'ga-1', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth1.jpg',  origem: 'admin',   criadaEm: '2025-04-24T10:00:00Z' },
  { id: 'ga-2', tipo: 'video',  url: 'https://d131ub0fee2g3p.cloudfront.net/videos/actions/action1.mp4', origem: 'admin',   criadaEm: '2025-04-23T15:30:00Z' },
  { id: 'ga-3', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth2.jpg',  origem: 'admin',   criadaEm: '2025-04-22T18:00:00Z' },
  { id: 'ga-4', tipo: 'video',  url: 'https://d131ub0fee2g3p.cloudfront.net/videos/actions/action2.mp4', origem: 'admin',   criadaEm: '2025-04-20T21:00:00Z' },
  { id: 'ga-5', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth3.jpg',  origem: 'admin',   criadaEm: '2025-04-18T09:15:00Z' },
  { id: 'ga-6', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth4.jpg',  origem: 'admin',   criadaEm: '2025-04-16T14:45:00Z' },
  // Cliente-generated
  { id: 'gc-1', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth5.jpg',  origem: 'cliente', criadaEm: '2025-04-23T08:12:00Z' },
  { id: 'gc-2', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth6.jpg',  origem: 'cliente', criadaEm: '2025-04-22T21:05:00Z' },
  { id: 'gc-3', tipo: 'video',  url: 'https://d131ub0fee2g3p.cloudfront.net/videos/actions/action3.mp4', origem: 'cliente', criadaEm: '2025-04-22T17:33:00Z' },
  { id: 'gc-4', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth7.jpg',  origem: 'cliente', criadaEm: '2025-04-21T14:20:00Z' },
  { id: 'gc-5', tipo: 'video',  url: 'https://d131ub0fee2g3p.cloudfront.net/videos/actions/action4.mp4', origem: 'cliente', criadaEm: '2025-04-20T09:55:00Z' },
  { id: 'gc-6', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth8.jpg',  origem: 'cliente', criadaEm: '2025-04-19T22:41:00Z' },
  { id: 'gc-7', tipo: 'imagem', url: 'https://d131ub0fee2g3p.cloudfront.net/images/cloths/cloth9.jpg',  origem: 'cliente', criadaEm: '2025-04-18T16:07:00Z' },
  { id: 'gc-8', tipo: 'video',  url: 'https://d131ub0fee2g3p.cloudfront.net/videos/actions/action5.mp4', origem: 'cliente', criadaEm: '2025-04-17T11:30:00Z' },
]

export const saldoAtriz: SaldoAtriz = {
  disponivel: 2340.0,
  pendente: 890.5,
  totalRecebido: 18740.0,
  creditosGastos: 28340,
  ganhoCreditos: 2834.0, // 28340 × R$0,10
}

export const ganhosAtriz: GanhoItem[] = [
  {
    id: 'g-1',
    descricao: 'Assinatura mensal',
    valor: 49.9,
    tipo: 'assinatura',
    criadaEm: '2025-04-23T10:00:00Z',
  },
  {
    id: 'g-2',
    descricao: 'Imagem gerada por assinante',
    valor: 15.0,
    tipo: 'imagem_gerada',
    criadaEm: '2025-04-22T17:33:00Z',
  },
  {
    id: 'g-3',
    descricao: 'Assinatura mensal',
    valor: 49.9,
    tipo: 'assinatura',
    criadaEm: '2025-04-22T09:00:00Z',
  },
  {
    id: 'g-4',
    descricao: 'Sessão de mensagens IA',
    valor: 8.5,
    tipo: 'mensagem',
    criadaEm: '2025-04-21T20:15:00Z',
  },
  {
    id: 'g-5',
    descricao: 'Assinatura mensal',
    valor: 49.9,
    tipo: 'assinatura',
    criadaEm: '2025-04-21T08:00:00Z',
  },
  {
    id: 'g-6',
    descricao: 'Conteúdo exclusivo vendido',
    valor: 29.9,
    tipo: 'conteudo',
    criadaEm: '2025-04-20T14:00:00Z',
  },
  {
    id: 'g-7',
    descricao: 'Vídeo gerado por assinante',
    valor: 22.0,
    tipo: 'imagem_gerada',
    criadaEm: '2025-04-19T11:00:00Z',
  },
  {
    id: 'g-8',
    descricao: 'Assinatura mensal',
    valor: 49.9,
    tipo: 'assinatura',
    criadaEm: '2025-04-18T08:00:00Z',
  },
  {
    id: 'g-9',
    descricao: 'Créditos gastos por assinante',
    valor: 8.3, // 83 créditos × R$0,10
    tipo: 'credito',
    criadaEm: '2025-04-22T14:10:00Z',
  },
  {
    id: 'g-10',
    descricao: 'Créditos gastos por assinante',
    valor: 15.0, // 150 créditos × R$0,10
    tipo: 'credito',
    criadaEm: '2025-04-21T11:30:00Z',
  },
  {
    id: 'g-11',
    descricao: 'Créditos gastos por assinante',
    valor: 22.5, // 225 créditos × R$0,10
    tipo: 'credito',
    criadaEm: '2025-04-19T16:45:00Z',
  },
]

export const saquesAtriz: SaqueItem[] = [
  {
    id: 'sq-1',
    valor: 1500.0,
    status: 'processado',
    criadaEm: '2025-04-10T10:00:00Z',
  },
  {
    id: 'sq-2',
    valor: 800.0,
    status: 'processado',
    criadaEm: '2025-03-15T09:00:00Z',
  },
  {
    id: 'sq-3',
    valor: 600.0,
    status: 'pendente',
    criadaEm: '2025-04-22T11:30:00Z',
  },
  {
    id: 'sq-4',
    valor: 300.0,
    status: 'recusado',
    criadaEm: '2025-03-01T14:00:00Z',
  },
]

export const metodosRecebimento: MetodoRecebimento[] = [
  {
    id: 'mr-1',
    tipo: 'pix',
    chave: 'sophiedee@privacyia.com',
    principal: true,
  },
  {
    id: 'mr-2',
    tipo: 'conta_bancaria',
    banco: 'Nubank',
    agencia: '0001',
    conta: '12345-6',
    principal: false,
  },
]

export const notificacoesAtriz: NotificacaoAtriz[] = [
  {
    id: 'nf-1',
    tipo: 'novo_assinante',
    titulo: 'Novo assinante!',
    descricao: 'Você tem um novo assinante no plano mensal.',
    lida: false,
    criadaEm: '2025-04-23T08:00:00Z',
  },
  {
    id: 'nf-2',
    tipo: 'pagamento_recebido',
    titulo: 'Pagamento recebido',
    descricao: 'Você recebeu R$ 49,90 referente a uma assinatura mensal.',
    lida: false,
    criadaEm: '2025-04-23T07:45:00Z',
  },
  {
    id: 'nf-3',
    tipo: 'saque_processado',
    titulo: 'Saque aprovado',
    descricao: 'Seu saque de R$ 1.500,00 foi processado com sucesso.',
    lida: true,
    criadaEm: '2025-04-10T12:00:00Z',
  },
  {
    id: 'nf-4',
    tipo: 'novo_assinante',
    titulo: 'Novo assinante!',
    descricao: 'Você tem um novo assinante no plano mensal.',
    lida: true,
    criadaEm: '2025-04-03T09:30:00Z',
  },
  {
    id: 'nf-5',
    tipo: 'saque_recusado',
    titulo: 'Saque recusado',
    descricao: 'Seu saque de R$ 300,00 foi recusado. Verifique seus dados bancários.',
    lida: true,
    criadaEm: '2025-03-01T16:00:00Z',
  },
  {
    id: 'nf-6',
    tipo: 'plataforma',
    titulo: 'Atualização na plataforma',
    descricao: 'Novos recursos de IA disponíveis para personalizar sua experiência.',
    lida: true,
    criadaEm: '2025-02-20T10:00:00Z',
  },
]
