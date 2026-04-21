export function errorMiddleware(error, _req, res, _next) {
  const status = error.statusCode || 500
  const message = error.message || 'Erro interno do servidor.'

  if (status >= 500) {
    console.error('❌ Erro interno:', error)
  }

  return res.status(status).json({
    message,
    details: error.details || null,
  })
}
