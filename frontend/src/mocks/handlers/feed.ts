import { http, HttpResponse } from 'msw'
import { feedPosts, sugestoesMock, top10Mock } from '@/mocks/data/feedPosts'

const BASE = import.meta.env.VITE_API_URL

export const feedHandlers = [
  http.get(`${BASE}/feed/posts`, () => {
    return HttpResponse.json(feedPosts)
  }),

  http.get(`${BASE}/feed/sugestoes`, () => {
    return HttpResponse.json(sugestoesMock)
  }),

  http.get(`${BASE}/feed/top10`, () => {
    return HttpResponse.json(top10Mock)
  }),

  http.post(`${BASE}/feed/posts/:id/curtir`, ({ params }) => {
    const post = feedPosts.find((p) => p.id === params.id)
    if (!post) return HttpResponse.json({ message: 'Post não encontrado' }, { status: 404 })
    post.curtido = !post.curtido
    post.curtidas += post.curtido ? 1 : -1
    return HttpResponse.json({ curtido: post.curtido, curtidas: post.curtidas })
  }),

  http.post(`${BASE}/feed/posts/:id/salvar`, ({ params }) => {
    const post = feedPosts.find((p) => p.id === params.id)
    if (!post) return HttpResponse.json({ message: 'Post não encontrado' }, { status: 404 })
    post.salvo = !post.salvo
    return HttpResponse.json({ salvo: post.salvo })
  }),
]
