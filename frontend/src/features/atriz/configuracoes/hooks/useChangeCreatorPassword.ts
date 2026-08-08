import { useMutation } from '@tanstack/react-query'
import { changeCreatorPassword } from '@/features/atriz/configuracoes/api/changeCreatorPassword'

export function useChangeCreatorPassword() {
  return useMutation({ mutationFn: changeCreatorPassword })
}
