import { api } from '@/shared/lib/axios'

export interface ChangeCreatorPasswordInput {
  senhaAtual: string
  novaSenha: string
}

export async function changeCreatorPassword(input: ChangeCreatorPasswordInput): Promise<void> {
  await api.post('/auth/change-password', input)
}
