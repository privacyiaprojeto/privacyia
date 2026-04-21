import { FaGoogle, FaApple, FaXTwitter } from 'react-icons/fa6'

export function SocialLogin() {
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
          disabled
          title="Login social em preparação"
          className="flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-600 opacity-60"
        >
          <FaGoogle size={16} />
        </button>

        <button
          type="button"
          disabled
          title="Login social em preparação"
          className="flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-600 opacity-60"
        >
          <FaApple size={17} />
        </button>

        <button
          type="button"
          disabled
          title="Login social em preparação"
          className="flex flex-1 cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 py-2.5 text-zinc-600 opacity-60"
        >
          <FaXTwitter size={15} />
        </button>
      </div>

      <p className="-mt-1 text-center text-[11px] text-zinc-600">Login social será liberado em breve.</p>
    </>
  )
}
