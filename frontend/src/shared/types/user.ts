export type UserRole = 'cliente' | 'atriz' | 'adm'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  credits: number
}
