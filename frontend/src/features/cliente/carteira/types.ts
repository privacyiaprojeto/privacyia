export interface CarteiraResumo {
  saldo: number
  creditos: number
}

export type TipoTransacaoCredito = 'entrada' | 'saida'

export interface TransacaoCredito {
  id: string
  tipo: TipoTransacaoCredito
  descricao: string
  valor: number
  criadaEm: string
}

export type StatusPagamento = 'aprovado' | 'pendente' | 'recusado'
export type TipoPagamento = 'compra' | 'recarga'

export interface HistoricoPagamento {
  id: string
  tipo: TipoPagamento
  descricao: string
  valor: number
  status: StatusPagamento
  criadaEm: string
}

export type TipoMetodo = 'cartao' | 'pix'

export interface MetodoPagamento {
  id: string
  tipo: TipoMetodo
  bandeira?: string
  ultimosDigitos?: string
  apelido?: string
  criadaEm: string
}

export interface AdicionarMetodoInput {
  tipo: TipoMetodo
  apelido?: string
  ultimosDigitos?: string
  bandeira?: string
}

export interface PacoteCreditos {
  id: string
  creditos: number
  preco: number
  destaque?: boolean
}

export interface ComprarCreditosInput {
  pacoteId: string
  metodoId: string
}
