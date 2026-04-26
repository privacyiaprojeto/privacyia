import { useState } from 'react'
import { useCarteira } from '@/features/cliente/carteira/hooks/useCarteira'
import { useHistoricoCreditos } from '@/features/cliente/carteira/hooks/useHistoricoCreditos'
import { useHistoricoPagamentos } from '@/features/cliente/carteira/hooks/useHistoricoPagamentos'
import { useMetodosPagamento } from '@/features/cliente/carteira/hooks/useMetodosPagamento'
import { usePacotes } from '@/features/cliente/carteira/hooks/usePacotes'
import { useComprarCreditos } from '@/features/cliente/carteira/hooks/useComprarCreditos'

type AbaHistorico = 'creditos' | 'pagamentos'

export function useCarteiraPage() {
  const [pacoteSelecionado, setPacoteSelecionado] = useState<string | null>(null)
  const [metodoSelecionado, setMetodoSelecionado] = useState<string | null>(null)
  const [abaHistorico, setAbaHistorico] = useState<AbaHistorico>('creditos')

  const { data: resumo, isLoading: loadingResumo } = useCarteira()
  const { data: transacoes = [], isLoading: loadingCreditos } = useHistoricoCreditos()
  const { data: pagamentos = [], isLoading: loadingPagamentos } = useHistoricoPagamentos()
  const { data: metodos = [] } = useMetodosPagamento()
  const { data: pacotes = [] } = usePacotes()
  const { mutate: comprar, isPending: comprando } = useComprarCreditos()

  function handleComprar() {
    if (!pacoteSelecionado || !metodoSelecionado) return
    comprar(
      { pacoteId: pacoteSelecionado, metodoId: metodoSelecionado },
      {
        onSuccess: () => {
          setPacoteSelecionado(null)
          setMetodoSelecionado(null)
        },
      },
    )
  }

  return {
    resumo,
    transacoes,
    pagamentos,
    metodos,
    pacotes,
    comprando,
    loadingResumo,
    loadingCreditos,
    loadingPagamentos,
    pacoteSelecionado,
    metodoSelecionado,
    abaHistorico,
    setPacoteSelecionado,
    setMetodoSelecionado,
    setAbaHistorico,
    handleComprar,
  }
}