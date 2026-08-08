import { createRenditionWorker } from './workers/rendition.worker.js'
import { enqueuePendingMediaRenditions } from './services/media-rendition.service.js'
import { runStandaloneWorkerProcess } from './workers/standalone-runtime.js'

await runStandaloneWorkerProcess({
  name: 'privacy-rendition-worker',
  requireRendition: true,
  verifyMediaBinaries: true,
  start: async ({ shutdownSignal }) => {
    const worker = createRenditionWorker({ shutdownSignal })
    const backlog = await enqueuePendingMediaRenditions()
    console.log('[rendition-worker] Backlog canônico reconciliado.', backlog)
    return [worker]
  },
})
