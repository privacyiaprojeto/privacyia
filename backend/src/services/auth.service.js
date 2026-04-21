import { supabaseAdmin, supabaseAuth } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

function mapProfileToUser(profile, fallbackEmail) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email || fallbackEmail || '',
    role: profile.role,
    credits: profile.credits || 0,
  }
}

export async function ensureProfile({ userId, email, name, role = 'cliente' }) {
  const payload = {
    id: userId,
    email,
    name,
    role,
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('id, name, email, role, credits')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar perfil do usuário.', error)
  }

  return data
}

export async function signUp(input) {
  const { data, error } = await supabaseAuth.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${env.FRONTEND_URL}/sign-in?confirmed=1`,
      data: {
        name: input.username,
        role: 'cliente',
      },
    },
  })

  if (error) {
    if (error.message?.toLowerCase().includes('already')) {
      throw new ApiError(409, 'Este e-mail já está cadastrado.')
    }

    throw new ApiError(400, error.message || 'Falha ao criar conta.')
  }

  if (!data.user) {
    throw new ApiError(500, 'Supabase não retornou o usuário criado.')
  }

  if (!data.session) {
    return {
      success: true,
      requiresEmailConfirmation: true,
      email: input.email,
      message:
        'Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.',
    }
  }

  const profile = await ensureProfile({
    userId: data.user.id,
    email: data.user.email,
    name: input.username,
    role: 'cliente',
  })

  return {
    success: true,
    requiresEmailConfirmation: false,
    token: data.session.access_token,
    user: mapProfileToUser(profile, data.user.email),
  }
}

export async function login(input) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) {
    const message = error.message?.toLowerCase() || ''

    if (message.includes('email not confirmed')) {
      throw new ApiError(403, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.')
    }

    throw new ApiError(401, 'E-mail ou senha incorretos.')
  }

  if (!data.user || !data.session) {
    throw new ApiError(401, 'E-mail ou senha incorretos.')
  }

  const profile = await ensureProfile({
    userId: data.user.id,
    email: data.user.email,
    name:
      data.user.user_metadata?.name ||
      data.user.user_metadata?.full_name ||
      data.user.email?.split('@')[0] ||
      'Usuário',
    role: data.user.user_metadata?.role || 'cliente',
  })

  return {
    token: data.session.access_token,
    user: mapProfileToUser(profile, data.user.email),
  }
}

export async function getMeFromAccessToken(authUser) {
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, role, credits')
    .eq('id', authUser.id)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao carregar perfil autenticado.', error)
  }

  const ensuredProfile = profile || await ensureProfile({
    userId: authUser.id,
    email: authUser.email,
    name:
      authUser.user_metadata?.name ||
      authUser.user_metadata?.full_name ||
      authUser.email?.split('@')[0] ||
      'Usuário',
    role: authUser.user_metadata?.role || 'cliente',
  })

  return {
    token: null,
    user: mapProfileToUser(ensuredProfile, authUser.email),
  }
}

export async function changePassword({ profileId, email, senhaAtual, novaSenha }) {
  const { error: signInError } = await supabaseAuth.auth.signInWithPassword({
    email,
    password: senhaAtual,
  })

  if (signInError) {
    throw new ApiError(401, 'Senha atual incorreta.')
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
    password: novaSenha,
  })

  if (updateError) {
    throw new ApiError(500, 'Não foi possível alterar a senha.', updateError)
  }

  return {
    success: true,
    message: 'Senha alterada com sucesso.',
  }
}
