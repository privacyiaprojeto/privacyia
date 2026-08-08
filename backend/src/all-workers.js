import { env } from './config/env.js'
import { startWorkers } from './workers/index.js'
import { runStandaloneWorkerProcess } from './workers/standalone-runtime.js'

await runStandaloneWorkerProcess({
  name: 'privacy-all-workers',
  requireRendition: false,
  verifyMediaBinaries: env.RENDITION_QUEUE_ENABLED,
  start: ({ shutdownSignal }) => startWorkers({ shutdownSignal }),
})
