import type {
  CarteiraResumo,
  TransacaoCredito,
  HistoricoPagamento,
  MetodoPagamento,
  PacoteCreditos,
} from '@/features/cliente/carteira/types'

export const carteiraResumo: CarteiraResumo = {
  saldo: 47.5,
  creditos: 320,
}

export const historicoCreditos: TransacaoCredito[] = [
  {
    id: 'tc-001',
    tipo: 'entrada',
    descricao: 'Compra de pacote 500 créditos',
    valor: 500,
    criadaEm: '2026-04-18T14:22:00Z',
  },
  {
    id: 'tc-002',
    tipo: 'saida',
    descricao: 'Chat com Luna Soares',
    valor: 50,
    criadaEm: '2026-04-18T16:05:00Z',
  },
  {
    id: 'tc-003',
    tipo: 'saida',
    descricao: 'Geração de imagem',
    valor: 30,
    criadaEm: '2026-04-17T10:30:00Z',
  },
  {
    id: 'tc-004',
    tipo: 'saida',
    descricao: 'Chat com Isabela Cruz',
    valor: 50,
    criadaEm: '2026-04-17T08:12:00Z',
  },
  {
    id: 'tc-005',
    tipo: 'entrada',
    descricao: 'Compra de pacote 200 créditos',
    valor: 200,
    criadaEm: '2026-04-15T20:00:00Z',
  },
  {
    id: 'tc-006',
    tipo: 'saida',
    descricao: 'Geração de vídeo',
    valor: 100,
    criadaEm: '2026-04-14T11:45:00Z',
  },
  {
    id: 'tc-007',
    tipo: 'saida',
    descricao: 'Chat com Vitória Lima',
    valor: 50,
    criadaEm: '2026-04-13T09:30:00Z',
  },
  {
    id: 'tc-008',
    tipo: 'entrada',
    descricao: 'Bônus de boas-vindas',
    valor: 100,
    criadaEm: '2026-04-10T00:00:00Z',
  },
]

export const historicoPagamentos: HistoricoPagamento[] = [
  {
    id: 'hp-001',
    tipo: 'compra',
    descricao: 'Pacote 500 créditos',
    valor: 49.9,
    status: 'aprovado',
    criadaEm: '2026-04-18T14:20:00Z',
  },
  {
    id: 'hp-002',
    tipo: 'compra',
    descricao: 'Pacote 200 créditos',
    valor: 24.9,
    status: 'aprovado',
    criadaEm: '2026-04-15T19:58:00Z',
  },
  {
    id: 'hp-003',
    tipo: 'compra',
    descricao: 'Pacote 100 créditos',
    valor: 14.9,
    status: 'recusado',
    criadaEm: '2026-04-12T17:22:00Z',
  },
  {
    id: 'hp-004',
    tipo: 'recarga',
    descricao: 'Recarga manual — suporte',
    valor: 0,
    status: 'aprovado',
    criadaEm: '2026-04-10T00:00:00Z',
  },
]

export const metodosPagamento: MetodoPagamento[] = [
  {
    id: 'mp-001',
    tipo: 'cartao',
    bandeira: 'Visa',
    ultimosDigitos: '4242',
    criadaEm: '2026-04-10T00:00:00Z',
  },
  {
    id: 'mp-002',
    tipo: 'pix',
    apelido: 'Minha chave Pix',
    criadaEm: '2026-04-15T12:00:00Z',
  },
]

export const pacotesCreditos: PacoteCreditos[] = [
  { id: 'pc-001', creditos: 100, preco: 14.9 },
  { id: 'pc-002', creditos: 200, preco: 24.9 },
  { id: 'pc-003', creditos: 500, preco: 49.9, destaque: true },
  { id: 'pc-004', creditos: 1000, preco: 89.9 },
  { id: 'pc-005', creditos: 2000, preco: 159.9 },
]
