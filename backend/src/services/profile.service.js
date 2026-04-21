import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

function mapProfile(row) {
  return {
    id: row.id,
    nome: row.name || '',
    email: row.email || '',
    cpf: row.cpf || '',
    promptTom: row.prompt_tom || '',
  }
}

async function readProfile(profileId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, cpf, prompt_tom')
    .eq('id', profileId)
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao carregar perfil do cliente.', error)
  }

  return data
}

export async function getCustomerProfile(profileId) {
  const data = await readProfile(profileId)
  return mapProfile(data)
}

export async function updateCustomerProfile(profileId, input) {
  const current = await readProfile(profileId)

  if (input.email && input.email !== current.email) {
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
      email: input.email,
    })

    if (authUpdateError) {
      throw new ApiError(500, 'Não foi possível atualizar o e-mail de autenticação.', authUpdateError)
    }
  }

  const payload = {}

  if (input.nome !== undefined) {
    payload.name = input.nome
  }

  if (input.email !== undefined) {
    payload.email = input.email
  }

  if (input.promptTom !== undefined) {
    payload.prompt_tom = input.promptTom
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select('id, name, email, cpf, prompt_tom')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar perfil do cliente.', error)
  }

  return mapProfile(data)
}
