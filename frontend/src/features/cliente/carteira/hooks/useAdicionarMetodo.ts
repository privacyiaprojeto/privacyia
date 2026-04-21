import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adicionarMetodoPagamento } from '@/features/cliente/carteira/api/adicionarMetodoPagamento'

export function useAdicionarMetodo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adicionarMetodoPagamento,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteira', 'metodos-pagamento'] })
    },
  })
}
