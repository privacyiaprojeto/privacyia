import { ApiError } from '../utils/apiError.js'

const ADMIN_ROLES = new Set([
  'adm',
  'admin',
  'dono',
  'owner',
  'superadmin',
  'super_admin',
])

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase()
}

function getAuthenticatedRole(req) {
  const candidates = [
    req.auth?.profile?.role,
    req.auth?.user?.app_metadata?.role,
    req.auth?.user?.user_metadata?.role,
  ]

  return candidates.map(normalizeRole).find(Boolean) || ''
}

export function adminMiddleware(req, _res, next) {
  try {
    if (!req.auth?.user?.id || !req.auth?.profile?.id) {
      throw new ApiError(401, 'Autenticação obrigatória para rota administrativa.')
    }

    const role = getAuthenticatedRole(req)

    if (!ADMIN_ROLES.has(role)) {
      throw new ApiError(403, 'Acesso restrito ao administrador.', {
        role: role || null,
      })
    }

    next()
  } catch (error) {
    next(error)
  }
}
