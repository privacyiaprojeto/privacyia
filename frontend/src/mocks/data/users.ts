import type { UserRole } from '@/shared/types/user'

interface MockUser {
  id: string
  name: string
  email: string
  password: string
  role: UserRole
  credits: number
}

export const mockUsers: MockUser[] = [
  { id: '1', name: 'Cliente', email: 'cliente@privacy.com', password: '12345678', role: 'cliente', credits: 350 },
  { id: '2', name: 'Atriz', email: 'atriz@privacy.com', password: '12345678', role: 'atriz', credits: 0 },
  { id: '3', name: 'Administrador', email: 'adm@privacy.com', password: '12345678', role: 'adm', credits: 0 },
]
