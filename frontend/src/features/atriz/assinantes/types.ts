export type TipoPlano = 'mensal' | 'trimestral' | 'anual'

export interface PlanoResumo {
  tipo: TipoPlano
  quantidade: number
  valorMensal: number
  receitaMensal: number
  crescimento: number
}

export interface HistoricoMes {
  label: string
  total: number
}

export interface AssinantesResumo {
  totalAtivos: number
  totalInativos: number
  novosEsteMes: number
  planos: PlanoResumo[]
  historico: HistoricoMes[]
}
