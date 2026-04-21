export function notFoundMiddleware(req, res) {
  return res.status(404).json({
    message: `Rota não encontrada: ${req.method} ${req.originalUrl}`,
  })
}
