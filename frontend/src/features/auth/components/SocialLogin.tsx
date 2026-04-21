import { useState } from 'react'
import { FaGoogle, FaApple, FaXTwitter } from 'react-icons/fa6'
import { supabaseBrowser } from '@/shared/lib/supabaseBrowser'

export function SocialLogin() {
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleGoogleLogin() {
    try {
      setLoading(true)
      setErrorMessage(null)

      const redirectTo = `${window.location.origin}/sign-in?oauth=google`

      const { error } = await supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (error) {
        throw error
      }
    } catch (error) {
      setLoading(false)
      setErrorMessage(
        error instanceof Error ? error.message : 'Não foi possível iniciar o login com Google.',
      )
    }
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs text-zinc-600">ou</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex flex-1 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-500 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:scale-95 disabled:opacity-50"
          title="Entrar com Google"
        >
          <FaGoogle size={16} />
        </button>

        <button
          type="button"
          disabled
          title="Login Apple em preparação"
          className="flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-600 opacity-60"
        >
          <FaApple size={17} />
        </button>

        <button
          type="button"
          disabled
          title="Login X/Twitter em preparação"
          className="flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-600 opacity-60"
        >
          <FaXTwitter size={15} />
        </button>
      </div>

      {errorMessage && (
        <p className="-mt-1 text-center text-[11px] text-red-400">{errorMessage}</p>
      )}
    </>
  )
}
