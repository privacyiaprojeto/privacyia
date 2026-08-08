import { useState } from 'react'
import { CheckCircle, KeyRound, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import { useChangeCreatorPassword } from '@/features/atriz/configuracoes/hooks/useChangeCreatorPassword'
import { parseApiError } from '@/shared/utils/parseApiError'

export function ContaSeguranca() {
  const user = useAuthStore((state) => state.user)
  const mutation = useChangeCreatorPassword()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit() {
    setMessage('')
    setError('')
    if (novaSenha.length < 8) {
      setError('A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    if (novaSenha !== confirmacao) {
      setError('A confirmação não corresponde à nova senha.')
      return
    }

    try {
      await mutation.mutateAsync({ senhaAtual, novaSenha })
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmacao('')
      setMessage('Senha alterada com sucesso.')
    } catch (mutationError) {
      setError(parseApiError(mutationError))
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-3 pb-2">
        <KeyRound size={20} className="text-zinc-500" strokeWidth={1.75} />
        <p className="text-sm text-zinc-500">Proteja seus dados de acesso</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-semibold text-zinc-100">Dados da conta</p>
        <p className="mt-0.5 text-sm text-zinc-500">{user?.name || 'Atriz'} • {user?.email || 'E-mail não informado'}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-semibold text-zinc-100">Alterar senha</p>
        <div className="mt-4 space-y-3">
          <input type="password" value={senhaAtual} onChange={(event) => setSenhaAtual(event.target.value)} placeholder="Senha atual" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
          <input type="password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} placeholder="Nova senha" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
          <input type="password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} placeholder="Confirmar nova senha" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-500" />
        </div>
        {error && <p className="mt-3 text-sm text-amber-400">{error}</p>}
        {message && <p className="mt-3 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle size={15} />{message}</p>}
        <button type="button" onClick={handleSubmit} disabled={mutation.isPending || !senhaAtual || !novaSenha || !confirmacao} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-pink-500/20 transition-colors hover:bg-pink-400 active:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40">
          {mutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <KeyRound size={20} strokeWidth={2} />}
          {mutation.isPending ? 'Alterando…' : 'Alterar senha'}
        </button>
      </div>
    </div>
  )
}
