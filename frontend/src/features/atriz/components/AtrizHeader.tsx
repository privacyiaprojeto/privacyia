import { Bell } from 'lucide-react'

interface AtrizHeaderProps {
  pageTitle: string
  notificationCount?: number
}

export function AtrizHeader({ pageTitle, notificationCount = 0 }: AtrizHeaderProps) {
  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-950 px-6">
      <h1 className="text-lg font-semibold text-zinc-100">{pageTitle}</h1>

      <div className="flex items-center gap-2">
        <button className="relative rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100">
          <Bell size={20} strokeWidth={1.75} />
          {notificationCount > 0 && (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-pink-500" />
          )}
        </button>
      </div>
    </header>
  )
}
