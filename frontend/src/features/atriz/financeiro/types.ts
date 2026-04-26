export interface SaldoAtriz {
  disponivel: number
  pendente: number
  totalRecebido: number
  creditosGastos: number
  ganhoCreditos: number
}

export interface GanhoItem {
  id: string
  descricao: string
  valor: number
  tipo: 'assinatura' | 'mensagem' | 'imagem_gerada' | 'conteudo' | 'credito'
  criadaEm: string
}

export interface SaqueItem {
  id: string
  valor: number
  status: 'pendente' | 'processado' | 'recusado'
  criadaEm: string
}

export interface MetodoRecebimento {
  id: string
  tipo: 'pix' | 'conta_bancaria'
  chave?: string
  banco?: string
  agencia?: string
  conta?: string
  principal: boolean
}

export interface SolicitarSaqueInput {
  valor: number
  metodoId: string
}
