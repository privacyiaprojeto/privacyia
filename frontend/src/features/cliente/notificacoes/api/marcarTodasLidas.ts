import { api } from '@/shared/lib/axios'

export async function marcarTodasLidas(): Promise<void> {
  await api.post('/notificacoes/ler-tudo')
}
