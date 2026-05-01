import axios from 'axios'
import { env } from '@/shared/lib/env'
import { useAuthStore } from '@/shared/stores/useAuthStore'

export const api = axios.create({
  baseURL: env.VITE_API_URL,
})

// Lógica solicitada por Lorenzo: preservar JWT em todas as chamadas reais da API.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})
