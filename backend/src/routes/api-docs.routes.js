import { Router } from 'express'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const router = Router()
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const openApiPath = path.resolve(currentDir, '../docs/openapi.factory.json')

async function loadOpenApiDocument() {
  const raw = await readFile(openApiPath, 'utf8')
  return JSON.parse(raw)
}

function setSwaggerHeaders(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')

  // Helmet aplica uma Content-Security-Policy global restritiva.
  // Esta rota usa Swagger UI via CDN somente quando ENABLE_SWAGGER=true,
  // então liberamos estritamente os hosts necessários apenas para /api-docs.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "font-src 'self' https://unpkg.com data:",
      "img-src 'self' data:",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "connect-src 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  )
}

router.get('/api-docs.json', async (req, res, next) => {
  try {
    const document = await loadOpenApiDocument()
    return res.status(200).json(document)
  } catch (error) {
    return next(error)
  }
})

router.get('/api-docs', (req, res) => {
  setSwaggerHeaders(res)

  return res.status(200).send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Privacy IA — Factory API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .topbar { display: none; }
      .swagger-ui .info { margin: 32px 0; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api-docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout',
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        defaultModelsExpandDepth: 1
      })
    </script>
  </body>
</html>`)
})

export default router
