import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Eye, EyeOff, CheckCircle } from 'lucide-react'
import {
  dadosPessoaisSchema,
  alterarSenhaSchema,
  type DadosPessoaisInput,
  type AlterarSenhaFormInput,
  type PerfilCliente,
} from '@/features/cliente/perfil/types'
import { useAtualizarPerfil } from '@/features/cliente/perfil/hooks/useAtualizarPerfil'
import { useAlterarSenha } from '@/features/cliente/perfil/hooks/useAlterarSenha'

interface ModalDadosPessoaisProps {
  perfil: PerfilCliente
  onClose: () => void
}

function Campo({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

export function ModalDadosPessoais({ perfil, onClose }: ModalDadosPessoaisProps) {
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showNovaSenha, setShowNovaSenha] = useState(false)
  const [dadosSalvos, setDadosSalvos] = useState(false)
  const [senhaSalva, setSenhaSalva] = useState(false)

  const atualizar = useAtualizarPerfil()
  const alterarSenha = useAlterarSenha()

  const dadosForm = useForm<DadosPessoaisInput>({
    resolver: zodResolver(dadosPessoaisSchema),
    defaultValues: { nome: perfil.nome, email: perfil.email },
  })

  const senhaForm = useForm<AlterarSenhaFormInput>({
    resolver: zodResolver(alterarSenhaSchema),
    defaultValues: { senhaAtual: '', novaSenha: '', confirmarSenha: '' },
  })

  async function onSalvarDados(data: DadosPessoaisInput) {
    await atualizar.mutateAsync(data)
    setDadosSalvos(true)
    setTimeout(() => setDadosSalvos(false), 2500)
  }

  async function onAlterarSenha(data: AlterarSenhaFormInput) {
    await alterarSenha.mutateAsync({ senhaAtual: data.senhaAtual, novaSenha: data.novaSenha })
    senhaForm.reset()
    setSenhaSalva(true)
    setTimeout(() => setSenhaSalva(false), 2500)
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-100">Dados pessoais</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 pb-6 space-y-6">
          {/* Seção: informações básicas */}
          <form onSubmit={dadosForm.handleSubmit(onSalvarDados)} className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Informações básicas
            </h3>

            <Campo label="Nome" error={dadosForm.formState.errors.nome?.message}>
              <input
                {...dadosForm.register('nome')}
                className={inputClass}
                placeholder="Seu nome"
              />
            </Campo>

            <Campo label="E-mail" error={dadosForm.formState.errors.email?.message}>
              <input
                {...dadosForm.register('email')}
                type="email"
                className={inputClass}
                placeholder="seu@email.com"
              />
            </Campo>

            <Campo label="CPF">
              <div className="flex items-center gap-2">
                <input
                  value={perfil.cpf}
                  readOnly
                  className={`${inputClass} cursor-not-allowed text-zinc-500`}
                />
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  Verificado
                </span>
              </div>
            </Campo>

            <div className="flex items-center justify-between">
              {dadosSalvos && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle size={13} />
                  Dados salvos
                </span>
              )}
              {!dadosSalvos && <span />}
              <button
                type="submit"
                disabled={atualizar.isPending}
                className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {atualizar.isPending ? 'Salvando…' : 'Salvar dados'}
              </button>
            </div>

            {atualizar.isError && (
              <p className="text-xs text-red-400">Erro ao salvar. Tente novamente.</p>
            )}
          </form>

          <div className="border-t border-zinc-800" />

          {/* Seção: alterar senha */}
          <form onSubmit={senhaForm.handleSubmit(onAlterarSenha)} className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Alterar senha
            </h3>

            <Campo label="Senha atual" error={senhaForm.formState.errors.senhaAtual?.message}>
              <div className="relative">
                <input
                  {...senhaForm.register('senhaAtual')}
                  type={showSenhaAtual ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSenhaAtual((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showSenhaAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Campo>

            <Campo label="Nova senha" error={senhaForm.formState.errors.novaSenha?.message}>
              <div className="relative">
                <input
                  {...senhaForm.register('novaSenha')}
                  type={showNovaSenha ? 'text' : 'password'}
                  className={`${inputClass} pr-10`}
                  placeholder="Mínimo 8 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowNovaSenha((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showNovaSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Campo>

            <Campo
              label="Confirmar nova senha"
              error={senhaForm.formState.errors.confirmarSenha?.message}
            >
              <input
                {...senhaForm.register('confirmarSenha')}
                type="password"
                className={inputClass}
                placeholder="Repita a nova senha"
              />
            </Campo>

            <div className="flex items-center justify-between">
              {senhaSalva && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle size={13} />
                  Senha alterada
                </span>
              )}
              {!senhaSalva && <span />}
              <button
                type="submit"
                disabled={alterarSenha.isPending}
                className="rounded-xl bg-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-600 disabled:opacity-50"
              >
                {alterarSenha.isPending ? 'Alterando…' : 'Alterar senha'}
              </button>
            </div>

            {alterarSenha.isError && (
              <p className="text-xs text-red-400">Senha atual incorreta ou erro no servidor.</p>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
