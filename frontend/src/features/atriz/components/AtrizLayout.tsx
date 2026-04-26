import { Outlet } from 'react-router'
import { AtrizSidebar } from '@/features/atriz/components/AtrizSidebar'
import { AtrizHeader } from '@/features/atriz/components/AtrizHeader'
import { useAtrizLayout } from '@/features/atriz/hooks/useAtrizLayout'

export function AtrizLayout() {
  const { pageTitle, user, logout } = useAtrizLayout()

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950">
      <AtrizSidebar user={user} onLogout={logout} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AtrizHeader pageTitle={pageTitle} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
