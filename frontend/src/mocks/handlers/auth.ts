import { http, HttpResponse } from 'msw'
import type { LoginInput, LoginResponse, SignUpInput, SignUpResponse } from '@/features/auth/types'
import { mockUsers } from '@/mocks/data/users'

const BASE_URL = import.meta.env.VITE_API_URL

const registeredEmails = new Set(mockUsers.map((u) => u.email))

function makeMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(
    JSON.stringify({
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    })
  )
  const sig = btoa('mock-signature')
  return `${header}.${body}.${sig}`
}

export const authHandlers = [
  http.post<never, LoginInput>(`${BASE_URL}/auth/login`, async ({ request }) => {
    const { email, password } = await request.json()

    const user = mockUsers.find((u) => u.email === email && u.password === password)

    if (!user) {
      return HttpResponse.json({ message: 'E-mail/CPF ou senha incorretos.' }, { status: 401 })
    }

    const token = makeMockJwt({ sub: user.id, email: user.email, role: user.role })

    return HttpResponse.json<LoginResponse>({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, credits: user.credits },
    })
  }),

  http.post<never, SignUpInput>(`${BASE_URL}/auth/sign-up`, async ({ request }) => {
    const { username, email } = await request.json()

    if (registeredEmails.has(email)) {
      return HttpResponse.json({ message: 'Este e-mail já está cadastrado.' }, { status: 409 })
    }

    registeredEmails.add(email)
    const id = crypto.randomUUID()
    const token = makeMockJwt({ sub: id, email, role: 'cliente' })

    return HttpResponse.json<SignUpResponse>(
      {
        token,
        user: { id, name: username, email, role: 'cliente', credits: 0 },
      },
      { status: 201 }
    )
  }),
]
