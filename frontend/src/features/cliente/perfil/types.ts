import { z } from 'zod'

export interface PerfilCliente {
  id: string
  nome: string
  email: string
  cpf: string
  promptTom: string
}

export interface AtualizarPerfilInput {
  nome?: string
  email?: string
  promptTom?: string
}

export interface AlterarSenhaInput {
  senhaAtual: string
  novaSenha: string
}

export const dadosPessoaisSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('E-mail inválido'),
})
export type DadosPessoaisInput = z.infer<typeof dadosPessoaisSchema>

export const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe a senha atual'),
    novaSenha: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.novaSenha === d.confirmarSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmarSenha'],
  })
export type AlterarSenhaFormInput = z.infer<typeof alterarSenhaSchema>
