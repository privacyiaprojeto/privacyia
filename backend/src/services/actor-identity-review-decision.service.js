import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { FUTURE_VALIDATION_PROFILE } from './actor-identity-video-forensic.service.js'

const RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const APPROVE_CONFIRMATION = 'APROVAR IDENTIDADE DE VIDEO DO ATOR'
const REJECT_CONFIRMATION = 'REJEITAR IDENTIDADE E SOLICITAR NOVO TREINAMENTO'

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }

async function loadLatestIdentity(actorProfileId) {
  const runResult = await supabaseAdmin
    .from(RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runResult.error) throw new ApiError(500, 'Erro ao carregar o treinamento da identidade.', runResult.error)
  if (!runResult.data) throw new ApiError(409, 'Nenhum treinamento de identidade foi encontrado para este ator.')

  const adapterResult = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('training_run_id', runResult.data.id)
    .order('adapter_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (adapterResult.error) throw new ApiError(500, 'Erro ao carregar o adapter da identidade.', adapterResult.error)
  if (!adapterResult.data) throw new ApiError(409, 'Nenhum adapter foi registrado para a identidade mais recente.')
  return { run: runResult.data, adapter: adapterResult.data }
}

function approvalBlockers(run, adapter) {
  const qaReport = safeObject(adapter.qa_report)
  const evidence = safeObject(qaReport.visualEvidence || qaReport.visual_evidence)
  const audit = safeObject(evidence.forensicAudit)
  const trainingTargetAudit = safeObject(qaReport.trainingTargetAudit)
  const targetCompatibility = safeObject(trainingTargetAudit.compatibility)
  const targetCandidate = safeObject(trainingTargetAudit.candidateContract)
  const futureValidation = safeObject(audit.futureValidation)
  const blockers = []
  if (!['training_completed', 'qa_pending'].includes(text(run.status))) blockers.push('TRAINING_NOT_READY_FOR_QA')
  if (text(trainingTargetAudit.status) !== 'passed') blockers.push('TRAINING_TARGET_AUDIT_NOT_PASSED')
  if (targetCompatibility.generalGeneratorIdentityBranchPresent !== true || targetCandidate.paidExecutionApproved !== true) blockers.push('IDENTITY_TARGET_COMPONENT_NOT_APPROVED')
  if (text(adapter.status) !== 'qa_pending' || text(adapter.qa_status) !== 'pending') blockers.push('ADAPTER_NOT_PENDING_REVIEW')
  if (text(evidence.status) !== 'ready' || evidence.ready !== true || evidence.reviewable !== true) blockers.push('VALID_VIDEO_EVIDENCE_NOT_READY')
  if (text(audit.status) !== 'passed') blockers.push('FORENSIC_AUDIT_NOT_PASSED')
  if (text(futureValidation.profile) !== FUTURE_VALIDATION_PROFILE) blockers.push('VIDEO_VALIDATION_PROFILE_NOT_APPROVED')
  if (futureValidation.randomBaseVideoUsed !== true) blockers.push('RANDOM_BASE_VIDEO_NOT_PROVEN')
  if (futureValidation.motionOnlyControlUsed !== true) blockers.push('MOTION_ONLY_CONTROL_NOT_PROVEN')
  if (futureValidation.actorMappingRawRgbControlUsed === true) blockers.push('ACTOR_MAPPING_RAW_RGB_CONTROL_FORBIDDEN')
  if (futureValidation.baselineWithoutLoraAvailable !== true) blockers.push('BASELINE_WITHOUT_LORA_MISSING')
  if (futureValidation.candidateWithLoraAvailable !== true) blockers.push('LORA_CANDIDATE_MISSING')
  if (safeObject(audit.adapter).safetensorsHeaderValid !== true || safeObject(audit.adapter).sha256Matched !== true) blockers.push('ADAPTER_STRUCTURE_NOT_VERIFIED')
  return blockers
}

export async function decideActorIdentityReview(actorProfileId, input = {}, { adminProfileId = null } = {}) {
  if (!adminProfileId) throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela decisão.')
  const action = text(input.action).toLowerCase()
  if (!['approve', 'reject'].includes(action)) throw new ApiError(422, 'Decisão de identidade inválida.')
  const expectedConfirmation = action === 'approve' ? APPROVE_CONFIRMATION : REJECT_CONFIRMATION
  if (text(input.confirmation) !== expectedConfirmation) throw new ApiError(422, 'A frase de confirmação da decisão não corresponde à ação solicitada.')

  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const qaReport = safeObject(adapter.qa_report)
  const previousDecision = safeObject(qaReport.finalDecision)
  const now = new Date().toISOString()

  if (action === 'approve') {
    if (text(adapter.status) === 'approved' && text(adapter.qa_status) === 'approved') {
      return {
        status: 'ACTOR_IDENTITY_ALREADY_APPROVED',
        actorProfileId,
        trainingRunId: run.id,
        adapterId: adapter.id,
        decision: 'approved',
        message: 'A identidade já estava aprovada. Nenhuma nova mutação foi realizada.',
        safety: { databaseMutationExecuted: false, runPodCalled: false, gpuStarted: false, productReleased: false, inferenceInjectionChanged: false, destructiveDelete: false },
      }
    }
    const blockers = approvalBlockers(run, adapter)
    if (blockers.length > 0) {
      throw new ApiError(409, 'A identidade ainda não pode ser aprovada. O teste final de vídeo com base aleatória e comparação A/B continua pendente.', { blockers })
    }

    const conflict = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .select('id')
      .eq('actor_profile_id', actorProfileId)
      .eq('base_model', adapter.base_model)
      .eq('status', 'approved')
      .eq('qa_status', 'approved')
      .is('revoked_at', null)
      .neq('id', adapter.id)
      .limit(1)
      .maybeSingle()
    if (conflict.error) throw new ApiError(500, 'Erro ao verificar adapters já aprovados.', conflict.error)
    if (conflict.data) throw new ApiError(409, 'Já existe outro adapter aprovado para este ator e modelo-base. A substituição precisa de um fluxo próprio.')

    const decision = {
      schemaVersion: 'privacy-identity-final-decision-v1',
      action: 'approved',
      decidedAt: now,
      decidedByProfileId: adminProfileId,
      notes: text(input.notes) || null,
      source: 'admin_actor_identity_review',
      noAutomaticApproval: true,
      videoValidationProfile: FUTURE_VALIDATION_PROFILE,
    }
    const adapterUpdate = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .update({
        status: 'approved',
        qa_status: 'approved',
        approved_at: now,
        approved_by_profile_id: adminProfileId,
        qa_report: { ...qaReport, finalDecision: decision },
        updated_at: now,
      })
      .eq('id', adapter.id)
      .eq('actor_profile_id', actorProfileId)
      .eq('training_run_id', run.id)
      .select('id')
      .single()
    if (adapterUpdate.error) throw new ApiError(500, 'Erro ao aprovar a identidade.', adapterUpdate.error)

    const runUpdate = await supabaseAdmin
      .from(RUNS_TABLE)
      .update({ status: 'approved', approved_by_profile_id: adminProfileId, updated_at: now })
      .eq('id', run.id)
      .eq('actor_profile_id', actorProfileId)
      .select('id')
      .single()
    if (runUpdate.error) {
      const rollback = await supabaseAdmin
        .from(ADAPTERS_TABLE)
        .update({
          status: adapter.status,
          qa_status: adapter.qa_status,
          approved_at: adapter.approved_at || null,
          approved_by_profile_id: adapter.approved_by_profile_id || null,
          qa_report: adapter.qa_report || {},
          updated_at: adapter.updated_at || now,
        })
        .eq('id', adapter.id)
        .eq('actor_profile_id', actorProfileId)
        .eq('training_run_id', run.id)
      if (rollback.error) throw new ApiError(500, 'A aprovação ficou em estado parcial e a compensação também falhou. Produção permanece bloqueada; revise o banco antes de qualquer ação.', { runError: runUpdate.error, rollbackError: rollback.error })
      throw new ApiError(500, 'O estado do treinamento não foi atualizado; a aprovação do adapter foi desfeita com segurança.', runUpdate.error)
    }

    return {
      status: 'ACTOR_IDENTITY_APPROVED_CONTROLLED',
      actorProfileId,
      trainingRunId: run.id,
      adapterId: adapter.id,
      decision: 'approved',
      message: 'Identidade aprovada para a próxima etapa. A integração de produção continua separada e não foi ativada.',
      safety: { databaseMutationExecuted: true, runPodCalled: false, gpuStarted: false, productReleased: false, inferenceInjectionChanged: false, automaticApproval: false, destructiveDelete: false },
    }
  }

  const reason = text(input.reason)
  if (reason.length < 10) throw new ApiError(422, 'Informe um motivo claro, com pelo menos 10 caracteres, para solicitar novo treinamento.')
  if (text(adapter.status) === 'rejected' || text(adapter.qa_status) === 'rejected') {
    return {
      status: 'ACTOR_IDENTITY_ALREADY_REJECTED',
      actorProfileId,
      trainingRunId: run.id,
      adapterId: adapter.id,
      decision: 'rejected',
      message: 'A identidade já estava rejeitada. Nenhuma nova mutação foi realizada.',
      safety: { databaseMutationExecuted: false, runPodCalled: false, gpuStarted: false, productReleased: false, destructiveDelete: false },
    }
  }
  if (text(adapter.status) === 'approved' || text(adapter.qa_status) === 'approved') throw new ApiError(409, 'Uma identidade aprovada não pode ser rejeitada por este atalho. Use o fluxo controlado de revogação.')

  const decision = {
    schemaVersion: 'privacy-identity-final-decision-v1',
    action: 'rejected',
    reason,
    notes: text(input.notes) || null,
    decidedAt: now,
    decidedByProfileId: adminProfileId,
    source: 'admin_actor_identity_review',
    previousDecision: Object.keys(previousDecision).length ? previousDecision : null,
    newTrainingRequired: true,
    noAutomaticRetry: true,
  }
  const adapterUpdate = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .update({
      status: 'rejected',
      qa_status: 'rejected',
      approved_at: null,
      approved_by_profile_id: null,
      qa_report: { ...qaReport, finalDecision: decision },
      updated_at: now,
    })
    .eq('id', adapter.id)
    .eq('actor_profile_id', actorProfileId)
    .eq('training_run_id', run.id)
    .select('id')
    .single()
  if (adapterUpdate.error) throw new ApiError(500, 'Erro ao registrar a rejeição da identidade.', adapterUpdate.error)

  const runUpdate = await supabaseAdmin
    .from(RUNS_TABLE)
    .update({
      status: 'revoked',
      approved_by_profile_id: null,
      failure_reason: `QA_REJECTED: ${reason}`.slice(0, 2000),
      updated_at: now,
    })
    .eq('id', run.id)
    .eq('actor_profile_id', actorProfileId)
    .select('id')
    .single()
  if (runUpdate.error) {
    const rollback = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .update({
        status: adapter.status,
        qa_status: adapter.qa_status,
        approved_at: adapter.approved_at || null,
        approved_by_profile_id: adapter.approved_by_profile_id || null,
        qa_report: adapter.qa_report || {},
        updated_at: adapter.updated_at || now,
      })
      .eq('id', adapter.id)
      .eq('actor_profile_id', actorProfileId)
      .eq('training_run_id', run.id)
    if (rollback.error) throw new ApiError(500, 'A rejeição ficou em estado parcial e a compensação também falhou. Nenhum novo treinamento deve ser iniciado antes da revisão do banco.', { runError: runUpdate.error, rollbackError: rollback.error })
    throw new ApiError(500, 'O run não foi encerrado; a rejeição do adapter foi desfeita com segurança.', runUpdate.error)
  }

  return {
    status: 'ACTOR_IDENTITY_REJECTED_CONTROLLED',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    decision: 'rejected',
    message: 'Identidade rejeitada com o motivo preservado. O run anterior foi encerrado para permitir uma preparação futura, mas nenhum novo treinamento foi iniciado automaticamente.',
    safety: { databaseMutationExecuted: true, runPodCalled: false, gpuStarted: false, trainingStarted: false, automaticRetryCreated: false, productReleased: false, destructiveDelete: false },
  }
}

export { APPROVE_CONFIRMATION as ACTOR_IDENTITY_APPROVE_CONFIRMATION, REJECT_CONFIRMATION as ACTOR_IDENTITY_REJECT_CONFIRMATION }
