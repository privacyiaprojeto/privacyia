import axios from 'axios'

export function parseApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Sem conexão com o servidor. Verifique sua internet.'
    }

    const message = error.response.data?.message
    if (typeof message === 'string') return message

    switch (error.response.status) {
      case 400: return 'Dados inválidos. Verifique as informações e tente novamente.'
      case 401: return 'E-mail/CPF ou senha incorretos.'
      case 409: return 'Este e-mail já está cadastrado.'
      case 422: return 'Dados inválidos. Verifique as informações.'
      case 429: return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
      case 500: return 'Erro interno do servidor. Tente novamente mais tarde.'
      default:  return 'Ocorreu um erro inesperado. Tente novamente.'
    }
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
