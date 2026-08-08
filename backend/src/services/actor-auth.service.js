import { createHash } from 'node:crypto'
import { supabaseAdmin, supabaseAuth } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { ensureProfile } from './auth.service.js'
import { getMappingRequirementOrThrow } from './mapping-requirements.service.js'

const ACTORS_TABLE = 'actor_profiles'
const INVITES_TABLE = 'actor_onboarding_invites'
const KYC_CASES_TABLE = 'actor_kyc_cases'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const MEDIA_COMBINATIONS_TABLE = 'media_combinations'
const MEDIA_ASSET_VARIANTS_TABLE = 'media_asset_variants'
const MEDIA_BATCHES_TABLE = 'media_generation_batches'
const MEDIA_BATCH_ITEMS_TABLE = 'media_generation_batch_items'

const ACTOR_ROLE = 'atriz'

function nowIso() {
  return new Date().toISOString()
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return email || null
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function hashInviteToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

async function tableMaybeCount(table, buildQuery = null) {
  try {
    let query = supabaseAdmin
      .from(table)
      .select('id', { count: 'exact', head: true })

    if (typeof buildQuery === 'function') {
      query = buildQuery(query)
    }

    const { count, error } = await query
    if (error) {
      return { ok: false, count: 0, error: error.message }
    }

    return { ok: true, count: count || 0, error: null }
  } catch (error) {
    return { ok: false, count: 0, error: error?.message || String(error) }
  }
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isActorProductPublished(row = {}) {
  const metadata = safeObject(row.metadata)
  const publication = safeObject(metadata.productPublication || metadata.publication || metadata.clientPublication)
  const publicationStatus = String(publication.status || '').trim().toLowerCase()

  if (publicationStatus === 'hidden') return false
  if (publicationStatus === 'published' || publication.published === true) return true

  return row.visible_to_client === true && row.admin_only !== true && row.is_active !== false
}

function mapActorPublicationProduct(row = {}) {
  const published = isActorProductPublished(row)
  return {
    id: row.id,
    title: row.title || row.combination_key || 'Produto de produção',
    mediaType: row.media_type || 'media',
    status: published ? 'published' : 'hidden',
    clientVisible: published,
    actorVisible: true,
    priceCredits: Number(row.price_credits || 0),
    updatedAt: row.updated_at || row.created_at || null,
  }
}

async function getActorPublicationVisibility(actorId) {
  try {
    const { data, error } = await supabaseAdmin
      .from(MEDIA_COMBINATIONS_TABLE)
      .select('id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, metadata, created_at, updated_at')
      .eq('actor_profile_id', actorId)
      .order('updated_at', { ascending: false })
      .limit(12)

    if (error) {
      return {
        ok: false,
        publishedProducts: 0,
        hiddenProducts: 0,
        pendingProducts: 0,
        products: [],
        error: error.message,
      }
    }

    const products = (data || []).map(mapActorPublicationProduct)
    const publishedProducts = products.filter((item) => item.clientVisible).length
    const hiddenProducts = products.filter((item) => !item.clientVisible).length

    return {
      ok: true,
      publishedProducts,
      hiddenProducts,
      pendingProducts: hiddenProducts,
      products: products.slice(0, 6),
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      publishedProducts: 0,
      hiddenProducts: 0,
      pendingProducts: 0,
      products: [],
      error: error?.message || String(error),
    }
  }
}

function mapProfileForActor(profile = {}, fallbackEmail = null) {
  return {
    id: profile.id,
    name: profile.name || null,
    email: profile.email || fallbackEmail || null,
    role: profile.role || ACTOR_ROLE,
  }
}

function mapSafeActor(row = {}) {
  return {
    id: row.id,
    profileId: row.profile_id || null,
    displayName: row.display_name || 'Ator/Atriz',
    email: row.email || null,
    phone: row.phone || null,
    countryCode: row.country_code || 'BR',
    status: row.status || 'draft',
    mappingStatus: row.kyc_status || 'not_started',
    productionStatus: row.production_status || 'not_authorized',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapSafeInvite(row = {}) {
  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    email: row.email || null,
    status: row.status || 'pending',
    expiresAt: row.expires_at || null,
    acceptedAt: row.accepted_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapSafeMappingCase(row = {}) {
  if (!row?.id) return null

  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    caseType: row.case_type || 'avatar_mapping',
    status: row.status || 'pending_review',
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    rejectionReason: row.rejection_reason || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapSafeMappingAsset(row = {}) {
  if (!row?.id) return null

  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    kycCaseId: row.kyc_case_id || null,
    mappingRequirementId: row.mapping_requirement_id || null,
    assetType: row.asset_type || null,
    status: row.status || 'received',
    originalFilename: row.original_filename || null,
    contentType: row.content_type || null,
    byteSize: row.byte_size || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function sanitizeFilename(value, fallback = 'material-mapeamento-simulado.txt') {
  const raw = normalizeText(value || fallback) || fallback
  const safe = raw
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return safe.slice(0, 160) || fallback
}

function sanitizeContentType(value, fallback = 'application/octet-stream') {
  const safe = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.+/-]/g, '')

  return safe.slice(0, 120) || fallback
}

function sanitizeAssetType(value, fallback = 'mapping_reference') {
  const safe = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')

  return safe.slice(0, 80) || fallback
}

function normalizePositiveByteSize(value, fallback = 0) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return fallback
  return Math.round(number)
}

function makeDryRunStorageKey({ actorId, caseId, idempotencyKey }) {
  const suffix = String(idempotencyKey || `${Date.now()}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 120)

  return `dry-run/actor-mapping/${actorId}/${caseId}/${suffix}.json`
}

async function listMappingCases(actorId, limit = 10) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { items: [], error: error.message }
  }

  return {
    items: (data || []).map(mapSafeMappingCase).filter(Boolean),
    error: null,
  }
}

async function listMappingAssets(actorId, limit = 20) {
  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('id, actor_profile_id, kyc_case_id, mapping_requirement_id, asset_type, status, original_filename, content_type, byte_size, created_at, updated_at')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return { items: [], error: error.message }
  }

  return {
    items: (data || []).map(mapSafeMappingAsset).filter(Boolean),
    error: null,
  }
}

function assertActorRole(profile = {}) {
  if (profile?.role !== ACTOR_ROLE) {
    throw new ApiError(403, 'Acesso permitido apenas ao Painel do Ator/Atriz.')
  }
}

function assertInviteUsableForAuth(invite = null) {
  if (!invite) {
    throw new ApiError(404, 'Convite inválido.')
  }

  if (invite.status === 'accepted') {
    throw new ApiError(409, 'Convite já utilizado para cadastro.')
  }

  if (invite.status === 'revoked') {
    throw new ApiError(409, 'Convite revogado pelo Admin.')
  }

  if (invite.status === 'expired') {
    throw new ApiError(410, 'Convite expirado.')
  }

  if (invite.status !== 'pending') {
    throw new ApiError(409, 'Convite indisponível para cadastro.')
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    throw new ApiError(410, 'Convite expirado.')
  }
}

function assertActorCanRegister(actor = null) {
  if (!actor) {
    throw new ApiError(404, 'Ator/Atriz não encontrado para este convite.')
  }

  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este cadastro está bloqueado. Fale com o suporte.')
  }

  if (actor.profile_id) {
    throw new ApiError(409, 'Este Ator/Atriz já está vinculado a uma conta.')
  }
}

async function getInviteAndActorForRegister(inviteToken) {
  const tokenHash = hashInviteToken(inviteToken)

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from(INVITES_TABLE)
    .select('*')
    .eq('invite_token_hash', tokenHash)
    .maybeSingle()

  if (inviteError) {
    throw new ApiError(500, 'Erro ao validar convite.', inviteError)
  }

  assertInviteUsableForAuth(invite)

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from(INVITES_TABLE)
      .update({ status: 'expired', updated_at: nowIso() })
      .eq('id', invite.id)

    throw new ApiError(410, 'Convite expirado.')
  }

  const { data: actor, error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('*')
    .eq('id', invite.actor_profile_id)
    .maybeSingle()

  if (actorError) {
    throw new ApiError(500, 'Erro ao carregar ator/atriz do convite.', actorError)
  }

  assertActorCanRegister(actor)

  return { invite, actor }
}

async function findAuthUserByEmail(email) {
  const target = normalizeEmail(email)
  if (!target) return null

  const perPage = 100
  const maxPages = 10

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })

    if (error) {
      throw new ApiError(500, 'Erro ao consultar usuários Auth.', error)
    }

    const user = (data?.users || []).find((item) => normalizeEmail(item.email) === target)
    if (user) return user

    if (!data?.users?.length || data.users.length < perPage) break
  }

  return null
}

async function signInActorByPassword(email, password, { existingUser = false } = {}) {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({ email, password })

  if (error || !data?.user) {
    if (existingUser) {
      throw new ApiError(401, 'Já existe uma conta com este e-mail. Informe a senha correta para vincular ao convite.')
    }

    return { session: null, user: null }
  }

  return {
    session: data.session || null,
    user: data.user,
  }
}

async function createOrVerifyActorAuthUser({ email, password, name }) {
  const existingUser = await findAuthUserByEmail(email)

  if (existingUser) {
    const signed = await signInActorByPassword(email, password, { existingUser: true })
    return {
      user: signed.user || existingUser,
      session: signed.session || null,
      reusedExistingAuthUser: true,
      authUserCreated: false,
    }
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: ACTOR_ROLE,
    },
    user_metadata: {
      name,
      role: ACTOR_ROLE,
      onboardingRole: 'actor',
    },
  })

  if (error) {
    const message = String(error.message || '').toLowerCase()
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
      const retryUser = await findAuthUserByEmail(email)
      if (retryUser) {
        const signed = await signInActorByPassword(email, password, { existingUser: true })
        return {
          user: signed.user || retryUser,
          session: signed.session || null,
          reusedExistingAuthUser: true,
          authUserCreated: false,
        }
      }
    }

    throw new ApiError(400, error.message || 'Falha ao criar conta do ator/atriz.')
  }

  if (!data?.user) {
    throw new ApiError(500, 'Supabase não retornou o usuário Auth criado.')
  }

  const signed = await signInActorByPassword(email, password, { existingUser: false })

  return {
    user: signed.user || data.user,
    session: signed.session || null,
    reusedExistingAuthUser: false,
    authUserCreated: true,
  }
}

function resolveRegistrationEmail({ inputEmail, invite, actor }) {
  const requestedEmail = normalizeEmail(inputEmail)
  const inviteEmail = normalizeEmail(invite.email)
  const actorEmail = normalizeEmail(actor.email)
  const expectedEmail = inviteEmail || actorEmail || requestedEmail

  if (!expectedEmail) {
    throw new ApiError(400, 'Informe um e-mail para criar a conta do ator/atriz.')
  }

  if (requestedEmail && inviteEmail && requestedEmail !== inviteEmail) {
    throw new ApiError(409, 'O e-mail informado não corresponde ao convite enviado pelo Admin.')
  }

  if (requestedEmail && !inviteEmail && actorEmail && requestedEmail !== actorEmail) {
    throw new ApiError(409, 'O e-mail informado não corresponde ao cadastro do ator/atriz.')
  }

  return expectedEmail
}

export async function registerActorAuthByInvite(inviteToken, input = {}) {
  const { invite, actor } = await getInviteAndActorForRegister(inviteToken)
  const email = resolveRegistrationEmail({ inputEmail: input.email, invite, actor })
  const displayName = normalizeText(input.displayName || input.name || actor.display_name || email.split('@')[0] || 'Ator/Atriz')
  const now = nowIso()

  const auth = await createOrVerifyActorAuthUser({
    email,
    password: input.password,
    name: displayName,
  })

  const profile = await ensureProfile({
    userId: auth.user.id,
    email: auth.user.email || email,
    name: displayName,
    role: ACTOR_ROLE,
    authUser: auth.user,
  })

  if (profile.role !== ACTOR_ROLE) {
    throw new ApiError(500, 'Perfil criado sem role técnica de ator/atriz.')
  }

  const nextActorStatus = actor.kyc_status === 'approved'
    ? 'approved'
    : 'onboarding'

  const { data: updatedActor, error: actorUpdateError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      profile_id: profile.id,
      display_name: displayName,
      email,
      phone: input.phone || actor.phone || null,
      status: nextActorStatus,
      metadata: {
        ...(actor.metadata || {}),
        authLinkedAt: now,
        authProfileId: profile.id,
        authUserCreatedByM42B: auth.authUserCreated,
        authRegistrationSource: 'm4_2b_actor_invite_register_auth',
      },
      updated_at: now,
    })
    .eq('id', actor.id)
    .is('profile_id', null)
    .select('*')
    .single()

  if (actorUpdateError) {
    throw new ApiError(500, 'Erro ao vincular conta Auth ao ator/atriz.', actorUpdateError)
  }

  const { data: updatedInvite, error: inviteUpdateError } = await supabaseAdmin
    .from(INVITES_TABLE)
    .update({
      status: 'accepted',
      accepted_at: now,
      metadata: {
        ...(invite.metadata || {}),
        acceptedByAuthProfileId: profile.id,
        acceptedByAuthUserId: auth.user.id,
        acceptedByM42B: true,
      },
      updated_at: now,
    })
    .eq('id', invite.id)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (inviteUpdateError) {
    throw new ApiError(500, 'Erro ao marcar convite como aceito após vínculo Auth/Profile/Actor.', inviteUpdateError)
  }

  return {
    token: auth.session?.access_token || null,
    requiresLogin: !auth.session?.access_token,
    authUserCreated: auth.authUserCreated,
    reusedExistingAuthUser: auth.reusedExistingAuthUser,
    user: mapProfileForActor(profile, email),
    actor: mapSafeActor(updatedActor),
    invite: mapSafeInvite(updatedInvite),
    message: auth.session?.access_token
      ? 'Cadastro do ator/atriz concluído e login liberado.'
      : 'Cadastro do ator/atriz concluído. Faça login para acessar o Painel do Ator.',
  }
}

export async function getActorProfileByAuthenticatedProfile(profileId) {
  const { data: actor, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao carregar Painel do Ator/Atriz.', error)
  }

  if (!actor) {
    throw new ApiError(403, 'Conta ainda não vinculada a um cadastro de Ator/Atriz.')
  }

  if (actor.status === 'blocked') {
    throw new ApiError(403, 'Cadastro de Ator/Atriz bloqueado pelo Admin.')
  }

  return actor
}

export async function getActorMe({ profile }) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)

  return {
    user: mapProfileForActor(profile, profile.email),
    actor: mapSafeActor(actor),
    finance: null,
    message: 'Painel do Ator/Atriz carregado sem dados financeiros.',
  }
}

export async function getActorMapping({ profile }) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)

  const [cases, assets] = await Promise.all([
    listMappingCases(actor.id, 10),
    listMappingAssets(actor.id, 20),
  ])

  const latestCase = cases.items[0] || null
  const pendingMapping = actor.kyc_status !== 'approved'

  return {
    actor: mapSafeActor(actor),
    mapping: {
      status: actor.kyc_status || 'not_started',
      pendingMapping,
      latestCase,
      cases: cases.items,
      assets: assets.items,
      uploadEnabled: false,
      uploadMode: 'simulated_material_m4_3d',
      nextStep: pendingMapping
        ? 'Enviar material de mapeamento em modo simulado, sem upload R2 real.'
        : 'Mapeamento aprovado. Acompanhe produções e publicações no painel.',
    },
    warnings: [cases.error, assets.error].filter(Boolean),
    message: 'Mapeamento do Ator/Atriz carregado em modo leitura, sem upload real e sem dados privados de storage.',
  }
}

async function getLatestMappingCase(actorId) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { item: null, error: error.message }
  }

  return { item: data ? mapSafeMappingCase(data) : null, error: null }
}


async function getOpenMappingCaseForActor(actorId) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
    .eq('actor_profile_id', actorId)
    .in('status', ['draft', 'pending_review', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao verificar mapeamento existente do ator/atriz.', error)
  }

  return data ? mapSafeMappingCase(data) : null
}

export async function createActorMappingCase({ profile, input = {} }) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)
  const existingCase = await getOpenMappingCaseForActor(actor.id)

  if (existingCase) {
    const [cases, assets] = await Promise.all([
      listMappingCases(actor.id, 10),
      listMappingAssets(actor.id, 20),
    ])

    return {
      actor: mapSafeActor(actor),
      mappingCase: existingCase,
      mapping: {
        status: actor.kyc_status || existingCase.status || 'pending_review',
        cases: cases.items,
        assets: assets.items,
        uploadEnabled: false,
        uploadMode: 'simulated_material_m4_3d',
      },
      mappingCaseCreated: false,
      alreadyOpen: true,
      message: existingCase.status === 'approved'
        ? 'Mapeamento já aprovado pelo Admin.'
        : 'Mapeamento já aberto. Continue o envio quando o upload controlado for habilitado.',
    }
  }

  const now = nowIso()
  const safeNotes = normalizeText(input.notes || input.note || '') || 'Mapeamento iniciado pelo Painel do Ator/Atriz.'
  const safeCaseType = normalizeText(input.caseType || input.case_type || 'avatar_mapping') || 'avatar_mapping'

  const { data: createdCase, error: caseError } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .insert({
      actor_profile_id: actor.id,
      case_type: safeCaseType,
      status: 'pending_review',
      submitted_at: now,
      notes: safeNotes,
      metadata: {
        source: 'actor_panel_mapping_case_m4_3b',
        actorInitiated: true,
        uploadEnabledAtCreation: false,
      },
      created_by_profile_id: profile.id,
      created_at: now,
      updated_at: now,
    })
    .select('id, actor_profile_id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
    .single()

  if (caseError) {
    throw new ApiError(500, 'Erro ao criar caso de mapeamento do ator/atriz.', caseError)
  }

  const nextActorStatus = actor.status === 'approved' ? 'approved' : 'kyc_pending'

  const { data: updatedActor, error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: nextActorStatus,
      kyc_status: 'pending_review',
      updated_by_profile_id: profile.id,
      updated_at: now,
    })
    .eq('id', actor.id)
    .select('*')
    .single()

  if (actorError) {
    throw new ApiError(500, 'Caso de mapeamento criado, mas houve erro ao atualizar status do ator/atriz.', actorError)
  }

  const [cases, assets] = await Promise.all([
    listMappingCases(actor.id, 10),
    listMappingAssets(actor.id, 20),
  ])

  return {
    actor: mapSafeActor(updatedActor),
    mappingCase: mapSafeMappingCase(createdCase),
    mapping: {
      status: updatedActor.kyc_status || 'pending_review',
      cases: cases.items,
      assets: assets.items,
      uploadEnabled: false,
      uploadMode: 'simulated_material_m4_3d',
    },
    mappingCaseCreated: true,
    alreadyOpen: false,
    message: 'Caso de mapeamento criado. O upload controlado será habilitado no próximo sprint.',
  }
}


async function getMappingCaseForAssetRegistration(actorId, requestedCaseId = null) {
  let query = supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
    .eq('actor_profile_id', actorId)

  if (requestedCaseId) {
    query = query.eq('id', requestedCaseId)
  } else {
    query = query.in('status', ['draft', 'pending_review'])
      .order('created_at', { ascending: false })
      .limit(1)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao localizar caso de mapeamento para registrar material.', error)
  }

  if (!data) {
    throw new ApiError(409, 'Nenhum caso de mapeamento aberto para envio de material. Inicie o mapeamento antes de enviar material.')
  }

  if (!['draft', 'pending_review'].includes(data.status)) {
    throw new ApiError(409, 'Este caso de mapeamento não aceita novos materiais no status atual.')
  }

  return mapSafeMappingCase(data)
}

async function findExistingDryRunMappingAsset({ actorId, caseId, mappingRequirementId, idempotencyKey }) {
  const key = normalizeText(idempotencyKey)
  if (!key) return null

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('id, actor_profile_id, kyc_case_id, mapping_requirement_id, asset_type, status, original_filename, content_type, byte_size, metadata, created_at, updated_at')
    .eq('actor_profile_id', actorId)
    .eq('kyc_case_id', caseId)
    .eq('mapping_requirement_id', mappingRequirementId)
    .eq('status', 'registered_dry_run')
    .contains('metadata', { idempotencyKey: key })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao verificar material simulado já registrado.', error)
  }

  return data ? mapSafeMappingAsset(data) : null
}

export async function createActorMappingAsset({ profile, input = {} }) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)
  const mappingCase = await getMappingCaseForAssetRegistration(actor.id, input.kycCaseId || input.kyc_case_id || null)

  const requirement = await getMappingRequirementOrThrow(input.mappingRequirementId || input.mapping_requirement_id, { activeOnly: true })
  const idempotencyKey = normalizeText(input.idempotencyKey || input.idempotency_key || `m4_3d_actor_mapping_asset_${requirement.id}`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 120) || `m4_3d_actor_mapping_asset_${requirement.id}`

  const existingAsset = await findExistingDryRunMappingAsset({
    actorId: actor.id,
    caseId: mappingCase.id,
    mappingRequirementId: requirement.id,
    idempotencyKey,
  })

  if (existingAsset) {
    const [cases, assets] = await Promise.all([
      listMappingCases(actor.id, 10),
      listMappingAssets(actor.id, 20),
    ])

    return {
      actor: mapSafeActor(actor),
      mappingCase,
      mappingAsset: existingAsset,
      mapping: {
        status: actor.kyc_status || 'pending_review',
        cases: cases.items,
        assets: assets.items,
        uploadEnabled: false,
        uploadMode: 'simulated_material_m4_3d',
      },
      mappingAssetCreated: false,
      resumedExistingMappingAsset: true,
      storageUploadExecuted: false,
      message: 'Material de mapeamento simulado já estava registrado. Nenhum upload real foi executado.',
    }
  }

  const now = nowIso()
  const originalFilename = sanitizeFilename(input.originalFilename || input.original_filename || 'material-mapeamento-simulado.jpg')
  const contentType = sanitizeContentType(input.contentType || input.content_type || 'image/jpeg')
  const byteSize = normalizePositiveByteSize(input.byteSize || input.byte_size || 0)
  const dryRunBucket = 'dry-run-actor-mapping'
  const dryRunKey = makeDryRunStorageKey({ actorId: actor.id, caseId: mappingCase.id, idempotencyKey })

  const { data: createdAsset, error: assetError } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .insert({
      kyc_case_id: mappingCase.id,
      actor_profile_id: actor.id,
      mapping_requirement_id: requirement.id,
      asset_type: null,
      r2_bucket: dryRunBucket,
      r2_key: dryRunKey,
      original_filename: originalFilename,
      content_type: contentType,
      byte_size: byteSize,
      status: 'registered_dry_run',
      metadata: {
        source: 'actor_panel_mapping_asset_m4_3d',
        simulatedAsset: true,
        dryRun: true,
        storageUploadExecuted: false,
        r2RealUpload: false,
        idempotencyKey,
        publicUrlCreated: false,
        notes: normalizeText(input.notes || input.note || '') || null,
        mappingRequirement: { id: requirement.id, title: requirement.title, mediaType: requirement.mediaType },
      },
      created_by_profile_id: profile.id,
      created_at: now,
      updated_at: now,
    })
    .select('id, actor_profile_id, kyc_case_id, asset_type, status, original_filename, content_type, byte_size, created_at, updated_at')
    .single()

  if (assetError) {
    throw new ApiError(500, 'Erro ao registrar material simulado de mapeamento.', assetError)
  }

  await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({ updated_at: now })
    .eq('id', mappingCase.id)

  if (actor.kyc_status !== 'pending_review') {
    await supabaseAdmin
      .from(ACTORS_TABLE)
      .update({
        status: actor.status === 'approved' ? 'approved' : 'kyc_pending',
        kyc_status: 'pending_review',
        updated_by_profile_id: profile.id,
        updated_at: now,
      })
      .eq('id', actor.id)
  }

  const [cases, assets] = await Promise.all([
    listMappingCases(actor.id, 10),
    listMappingAssets(actor.id, 20),
  ])

  return {
    actor: mapSafeActor({ ...actor, kyc_status: 'pending_review' }),
    mappingCase,
    mappingAsset: mapSafeMappingAsset(createdAsset),
    mapping: {
      status: 'pending_review',
      cases: cases.items,
      assets: assets.items,
      uploadEnabled: false,
      uploadMode: 'simulated_material_m4_3d',
    },
    mappingAssetCreated: true,
    resumedExistingMappingAsset: false,
    storageUploadExecuted: false,
    message: 'Material de mapeamento registrado em modo simulado. Nenhum upload real foi executado.',
  }
}


export async function getActorDashboard({ profile }) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)
  const latestMapping = await getLatestMappingCase(actor.id)

  const [
    mappingCases,
    mappingAssets,
    activeAuthorizations,
    mediaCombinations,
    mediaAssets,
    batches,
    batchItems,
    publicationVisibility,
  ] = await Promise.all([
    tableMaybeCount(KYC_CASES_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    tableMaybeCount(KYC_ASSETS_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    tableMaybeCount(AUTHORIZATIONS_TABLE, (query) => query.eq('actor_profile_id', actor.id).eq('status', 'active')),
    tableMaybeCount(MEDIA_COMBINATIONS_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    tableMaybeCount(MEDIA_ASSET_VARIANTS_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    tableMaybeCount(MEDIA_BATCHES_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    tableMaybeCount(MEDIA_BATCH_ITEMS_TABLE, (query) => query.eq('actor_profile_id', actor.id)),
    getActorPublicationVisibility(actor.id),
  ])

  const pendingMapping = actor.kyc_status !== 'approved'
  const productionAuthorized = actor.production_status === 'authorized' || activeAuthorizations.count > 0

  return {
    actor: mapSafeActor(actor),
    onboarding: {
      status: actor.status || 'draft',
      mappingStatus: actor.kyc_status || 'not_started',
      productionStatus: actor.production_status || 'not_authorized',
      pendingMapping,
      productionAuthorized,
      latestMappingCase: latestMapping.item,
      mappingDataAvailable: !latestMapping.error,
    },
    counts: {
      mappingCases: mappingCases.count,
      mappingAssets: mappingAssets.count,
      activeProductionAuthorizations: activeAuthorizations.count,
      mediaCombinations: mediaCombinations.count,
      mediaAssets: mediaAssets.count,
      productionBatches: batches.count,
      productionBatchItems: batchItems.count,
    },
    publication: {
      ok: publicationVisibility.ok,
      publishedProducts: publicationVisibility.publishedProducts,
      hiddenProducts: publicationVisibility.hiddenProducts,
      pendingProducts: publicationVisibility.pendingProducts,
      products: publicationVisibility.products,
      clientMediaVisibleBeforePurchase: false,
      protectedDeliveryOnly: true,
      error: publicationVisibility.error,
    },
    message: 'Resumo do Painel do Ator/Atriz carregado com visibilidade de produtos, sem financeiro e sem mídia privada.',
  }
}
