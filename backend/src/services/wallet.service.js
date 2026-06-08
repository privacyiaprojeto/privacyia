import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

function mapCreditLedger(item) {
  return {
    id: item.id,
    tipo: item.direction,
    descricao: item.reason,
    valor: item.amount,
    criadaEm: item.created_at,
  }
}

function mapPayment(item) {
  return {
    id: item.id,
    tipo: item.payment_type,
    descricao: item.description,
    valor: Number(item.amount_brl),
    status: item.status,
    criadaEm: item.created_at,
  }
}

function mapPaymentMethod(item) {
  return {
    id: item.id,
    tipo: item.method_type,
    bandeira: item.card_brand,
    ultimosDigitos: item.card_last4,
    apelido: item.nickname,
    criadaEm: item.created_at,
  }
}

export async function getWalletSummary(profileId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', profileId)
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao carregar carteira.', error)
  }

  return {
    saldo: data.credits || 0,
    creditos: data.credits || 0,
  }
}

export async function listCreditHistory(profileId) {
  const { data, error } = await supabaseAdmin
    .from('credit_ledger')
    .select('id, direction, reason, amount, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar histórico de créditos.', error)
  }

  return (data || []).map(mapCreditLedger)
}

export async function listPaymentHistory(profileId) {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, payment_type, description, amount_brl, status, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar histórico de pagamentos.', error)
  }

  return (data || []).map(mapPayment)
}

export async function listPaymentMethods(profileId) {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .select('id, method_type, card_brand, card_last4, nickname, created_at')
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar métodos de pagamento.', error)
  }

  return (data || []).map(mapPaymentMethod)
}

export async function addPaymentMethod(profileId, input) {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .insert({
      profile_id: profileId,
      method_type: input.tipo,
      card_brand: input.bandeira || null,
      card_last4: input.ultimosDigitos || null,
      nickname: input.apelido || null,
      is_active: true,
    })
    .select('id, method_type, card_brand, card_last4, nickname, created_at')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao adicionar método de pagamento.', error)
  }

  return mapPaymentMethod(data)
}

export async function listCreditPackages() {
  const { data, error } = await supabaseAdmin
    .from('credit_packages')
    .select('id, credits, price_brl, is_featured')
    .eq('is_active', true)
    .order('credits', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar pacotes de créditos.', error)
  }

  return (data || []).map((item) => ({
    id: item.id,
    creditos: item.credits,
    preco: Number(item.price_brl),
    destaque: item.is_featured || false,
  }))
}

export async function buyCredits(profileId, input) {
  const [{ data: pkg, error: pkgError }, { data: method, error: methodError }, { data: profile, error: profileError }] = await Promise.all([
    supabaseAdmin
      .from('credit_packages')
      .select('id, credits, price_brl')
      .eq('id', input.pacoteId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('payment_methods')
      .select('id')
      .eq('id', input.metodoId)
      .eq('profile_id', profileId)
      .eq('is_active', true)
      .maybeSingle(),
    supabaseAdmin
      .from('profiles')
      .select('id, credits')
      .eq('id', profileId)
      .single(),
  ])

  if (pkgError || methodError || profileError) {
    throw new ApiError(500, 'Erro ao validar compra de créditos.', { pkgError, methodError, profileError })
  }

  if (!pkg) {
    throw new ApiError(404, 'Pacote não encontrado.')
  }

  if (!method) {
    throw new ApiError(404, 'Método de pagamento não encontrado.')
  }

  const newCredits = (profile.credits || 0) + pkg.credits

  const { error: updateProfileError } = await supabaseAdmin
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', profileId)

  if (updateProfileError) {
    throw new ApiError(500, 'Erro ao atualizar saldo de créditos.', updateProfileError)
  }

  const { error: ledgerError } = await supabaseAdmin
    .from('credit_ledger')
    .insert({
      profile_id: profileId,
      direction: 'entrada',
      amount: pkg.credits,
      reason: `Compra de pacote ${pkg.credits} créditos`,
    })

  if (ledgerError) {
    throw new ApiError(500, 'Erro ao registrar entrada no ledger.', ledgerError)
  }

  const { error: paymentError } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      profile_id: profileId,
      payment_method_id: input.metodoId,
      payment_type: 'compra',
      description: `Pacote ${pkg.credits} créditos`,
      amount_brl: pkg.price_brl,
      status: 'aprovado',
    })

  if (paymentError) {
    throw new ApiError(500, 'Erro ao registrar pagamento.', paymentError)
  }

  return {
    saldo: newCredits,
    creditos: newCredits,
  }
}

function isMissingRpcError(error) {
  return error?.code === '42883' || /function .* does not exist/i.test(String(error?.message || ''))
}

async function debitCreditsWithOptimisticLock(profileId, amount, reason, reference = {}) {
  const maxAttempts = 3

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', profileId)
      .single()

    if (profileError) {
      throw new ApiError(500, 'Erro ao validar saldo de créditos.', profileError)
    }

    const currentCredits = Number(profile.credits || 0)

    if (currentCredits < amount) {
      throw new ApiError(409, 'Créditos insuficientes.')
    }

    const newCredits = currentCredits - amount

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ credits: newCredits })
      .eq('id', profileId)
      .eq('credits', currentCredits)
      .select('credits')
      .maybeSingle()

    if (updateError) {
      throw new ApiError(500, 'Erro ao debitar créditos.', updateError)
    }

    if (!updated) {
      continue
    }

    const { error: ledgerError } = await supabaseAdmin
      .from('credit_ledger')
      .insert({
        profile_id: profileId,
        direction: 'saida',
        amount,
        reason,
        reference_type: reference.referenceType || null,
        reference_id: reference.referenceId || null,
      })

    if (ledgerError) {
      throw new ApiError(500, 'Erro ao registrar débito de créditos.', ledgerError)
    }

    return {
      saldo: Number(updated.credits || 0),
      creditos: Number(updated.credits || 0),
      debited: amount,
    }
  }

  throw new ApiError(409, 'Saldo alterado durante a operação. Tente novamente.')
}

export async function debitCreditsAtomically(profileId, amount, reason, reference = {}) {
  const finalAmount = Number(amount || 0)

  if (!profileId) {
    throw new ApiError(400, 'profileId obrigatório para débito de créditos.')
  }

  if (!Number.isInteger(finalAmount) || finalAmount <= 0) {
    throw new ApiError(400, 'Quantidade de créditos inválida para débito.')
  }

  const { data, error } = await supabaseAdmin.rpc('debit_credits_atomic', {
    p_profile_id: profileId,
    p_amount: finalAmount,
    p_reason: reason,
    p_reference_type: reference.referenceType || null,
    p_reference_id: reference.referenceId || null,
  })

  if (!error) {
    const saldo = Number(data || 0)
    return {
      saldo,
      creditos: saldo,
      debited: finalAmount,
    }
  }

  if (!isMissingRpcError(error)) {
    if (/insuficientes/i.test(String(error.message || ''))) {
      throw new ApiError(409, 'Créditos insuficientes.', error)
    }

    throw new ApiError(500, 'Erro ao debitar créditos de forma atômica.', error)
  }

  console.warn('[Wallet] RPC debit_credits_atomic ausente. Usando fallback com lock otimista. Rode o SQL do patch para ativar débito 100% transacional.')
  return debitCreditsWithOptimisticLock(profileId, finalAmount, reason, reference)
}

export async function refundCredits(profileId, amount, reason, reference = {}) {
  const finalAmount = Number(amount || 0)

  if (!profileId || !Number.isInteger(finalAmount) || finalAmount <= 0) {
    return null
  }

  const { data, error } = await supabaseAdmin.rpc('refund_credits_atomic', {
    p_profile_id: profileId,
    p_amount: finalAmount,
    p_reason: reason,
    p_reference_type: reference.referenceType || null,
    p_reference_id: reference.referenceId || null,
  })

  if (!error) {
    const saldo = Number(data || 0)
    return {
      saldo,
      creditos: saldo,
      refunded: finalAmount,
    }
  }

  if (!isMissingRpcError(error)) {
    throw new ApiError(500, 'Erro ao estornar créditos.', error)
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', profileId)
    .single()

  if (profileError) {
    throw new ApiError(500, 'Erro ao buscar saldo para estorno.', profileError)
  }

  const newCredits = Number(profile.credits || 0) + finalAmount

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', profileId)

  if (updateError) {
    throw new ApiError(500, 'Erro ao estornar créditos.', updateError)
  }

  const { error: ledgerError } = await supabaseAdmin
    .from('credit_ledger')
    .insert({
      profile_id: profileId,
      direction: 'entrada',
      amount: finalAmount,
      reason,
      reference_type: reference.referenceType || null,
      reference_id: reference.referenceId || null,
    })

  if (ledgerError) {
    throw new ApiError(500, 'Erro ao registrar estorno no ledger.', ledgerError)
  }

  return {
    saldo: newCredits,
    creditos: newCredits,
    refunded: finalAmount,
  }
}
