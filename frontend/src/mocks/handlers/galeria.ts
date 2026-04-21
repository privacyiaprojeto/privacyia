import { http, HttpResponse } from 'msw'
import { galeriaAtrizes } from '@/mocks/data/galeria'

const BASE = import.meta.env.VITE_API_URL

export const galeriaHandlers = [
  http.get(`${BASE}/galeria`, ({ request }) => {
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.toLowerCase() ?? ''
    const resultado = q
      ? galeriaAtrizes.filter((a) => a.nome.toLowerCase().includes(q))
      : galeriaAtrizes
    return HttpResponse.json(resultado)
  }),
]
