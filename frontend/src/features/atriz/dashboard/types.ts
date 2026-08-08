export interface DashboardResumo {
  ganhosMes: number
  totalAssinantes: number
  mensagensIA: number
  imagensGeradas: number
  creditosGastos: number
}

export type PeriodoDashboard = 'diario' | 'semanal' | 'mensal' | 'personalizado'

export interface GraficoPonto {
  label: string
  valor: number
}

export type TipoAtividade = 'assinante' | 'ganho' | 'imagem_gerada' | 'mensagem'

export interface AtividadeItem {
  id: string
  tipo: TipoAtividade
  descricao: string
  valor?: number
  criadaEm: string
}


export interface DashboardPublicationProduct {
  id: string
  title: string
  mediaType: string
  status: string
  clientVisible: boolean
  actorVisible: boolean
  priceCredits: number
  updatedAt?: string | null
}

export interface DashboardPublicationSummary {
  ok: boolean
  publishedProducts: number
  hiddenProducts: number
  pendingProducts: number
  products: DashboardPublicationProduct[]
  clientMediaVisibleBeforePurchase: boolean
  protectedDeliveryOnly: boolean
  error?: string | null
}

export interface DashboardData {
  resumo: DashboardResumo
  grafico: GraficoPonto[]
  atividades: AtividadeItem[]
  publication?: DashboardPublicationSummary
}
