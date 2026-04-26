import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

function normalizeRole(role) {
  return ['cliente', 'atriz', 'adm'].includes(role) ? role : null
}

export async function authMiddleware(req, _res, next) {
  try {
    const authorization = req.headers.authorization || ''

    if (!authorization.startsWith('Bearer ')) {
      throw new ApiError(401, 'Token Bearer não enviado.')
    }

    const token = authorization.replace('Bearer ', '').trim()
    if (!token) {
      throw new ApiError(401, 'Token Bearer vazio.')
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user) {
      throw new ApiError(401, 'Token inválido ou expirado.')
    }

    const authUser = userData.user

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, credits')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileError) {
      throw new ApiError(500, 'Erro ao carregar perfil autenticado.', profileError)
    }

    const fallbackRole =
      normalizeRole(profile?.role) ||
      normalizeRole(authUser.app_metadata?.role) ||
      normalizeRole(authUser.user_metadata?.role) ||
      'cliente'

    req.auth = {
      token,
      user: authUser,
      profile: profile || {
        id: authUser.id,
        name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
        email: authUser.email,
        role: fallbackRole,
        credits: 0,
      },
    }

    next()
  } catch (error) {
    next(error)
  }
}
