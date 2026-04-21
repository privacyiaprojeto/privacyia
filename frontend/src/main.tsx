import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/index.css'
import { App } from '@/app/index'

async function bootstrap() {
  const shouldEnableMsw =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_MSW === 'true'

  if (shouldEnableMsw) {
    const { worker } = await import('@/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()