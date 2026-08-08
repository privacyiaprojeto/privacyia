import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import sharp from 'sharp'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { downloadPrivateObjectToFile } from './storage.service.js'

const RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const FORENSIC_CONFIRMATION = 'EXECUTAR AUDITORIA FORENSE SEM GPU D3.6H3'
const AUDIT_SCHEMA_VERSION = 'privacy-identity-video-forensic-audit-v1'
const FUTURE_VALIDATION_PROFILE = 'video_random_base_ab_v1'
const IMAGE_SOURCE_SIMILARITY_LIMIT = 0.9
const IMAGE_DUPLICATE_SIMILARITY_LIMIT = 0.96
const VIDEO_SOURCE_SIMILARITY_LIMIT = 0.88

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function isSha256(value) { return /^[0-9a-f]{64}$/i.test(text(value)) }
function isPrivateReference(bucket, key) {
  return Boolean(text(bucket) && text(key) && !/^https?:\/\//i.test(text(bucket)) && !/^https?:\/\//i.test(text(key)) && !text(key).startsWith('/'))
}
function prefix(value, size = 12) { return text(value).slice(0, size) || null }
function round(value, places = 4) {
  const factor = 10 ** places
  return Math.round(Number(value || 0) * factor) / factor
}

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
  if (!adapterResult.data) throw new ApiError(409, 'Nenhum adapter foi registrado para o treinamento mais recente.')
  return { run: runResult.data, adapter: adapterResult.data }
}

function visualEvidence(adapter) {
  const qaReport = safeObject(adapter.qa_report)
  return safeObject(qaReport.visualEvidence || qaReport.visual_evidence)
}

function qaAssets(adapter) {
  const evidence = visualEvidence(adapter)
  return Array.isArray(safeObject(evidence.qaKit).assets) ? safeObject(evidence.qaKit).assets : []
}

function selectLegacyD36H2Inputs(run) {
  const manifest = safeObject(run.dataset_manifest)
  const assets = Array.isArray(manifest.assets) ? manifest.assets : []
  const images = assets.filter((item) => item.mediaType === 'image' && isPrivateReference(item.source?.bucket, item.source?.key) && isSha256(item.checksumSha256))
  const videos = assets.filter((item) => item.mediaType === 'video' && isPrivateReference(item.source?.bucket, item.source?.key) && isSha256(item.checksumSha256))
  const order = (left, right) => `${left.systemTag || ''}:${left.assetId || ''}`.localeCompare(`${right.systemTag || ''}:${right.assetId || ''}`)
  return {
    image: [...images].sort(order)[0] || null,
    video: [...videos].sort(order)[0] || null,
    preferredFaceFront: images.find((item) => text(item.systemTag) === 'face_front') || null,
    preferredWalkVideo: videos.find((item) => text(item.systemTag) === 'video_walk') || null,
  }
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function parseSafetensorsHeader(filePath) {
  const handle = await open(filePath, 'r')
  try {
    const lengthBuffer = Buffer.alloc(8)
    const lengthRead = await handle.read(lengthBuffer, 0, 8, 0)
    if (lengthRead.bytesRead !== 8) throw new Error('header_length_missing')
    const headerLengthBig = lengthBuffer.readBigUInt64LE(0)
    if (headerLengthBig <= 0n || headerLengthBig > 64n * 1024n * 1024n) throw new Error('header_length_invalid')
    const headerLength = Number(headerLengthBig)
    const headerBuffer = Buffer.alloc(headerLength)
    const headerRead = await handle.read(headerBuffer, 0, headerLength, 8)
    if (headerRead.bytesRead !== headerLength) throw new Error('header_incomplete')
    const parsed = JSON.parse(headerBuffer.toString('utf8'))
    const tensorKeys = Object.keys(parsed).filter((key) => key !== '__metadata__')
    const loraKeys = tensorKeys.filter((key) => /(?:lora|adapter)/i.test(key))
    const targetKeys = tensorKeys.filter((key) => /(?:vace|dit|transformer|blocks)/i.test(key))
    const metadata = safeObject(parsed.__metadata__)
    return {
      valid: tensorKeys.length > 0 && loraKeys.length > 0 && targetKeys.length > 0,
      tensorCount: tensorKeys.length,
      loraTensorCount: loraKeys.length,
      targetTensorCount: targetKeys.length,
      keySamples: tensorKeys.slice(0, 8),
      targetFamilies: [...new Set(targetKeys.map((key) => {
        const normalized = key.toLowerCase()
        if (normalized.includes('vace')) return 'vace'
        if (normalized.includes('dit')) return 'dit'
        if (normalized.includes('transformer')) return 'transformer'
        return 'blocks'
      }))],
      metadataKeys: Object.keys(metadata).slice(0, 20),
    }
  } catch (error) {
    return {
      valid: false,
      tensorCount: 0,
      loraTensorCount: 0,
      targetTensorCount: 0,
      keySamples: [],
      targetFamilies: [],
      metadataKeys: [],
      error: text(error?.message || error).slice(0, 160),
    }
  } finally {
    await handle.close()
  }
}

async function canonicalPixels(filePath) {
  return sharp(filePath)
    .rotate()
    .resize(64, 64, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer()
}

function pixelSimilarity(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length || left.length === 0) return null
  let diff = 0
  for (let index = 0; index < left.length; index += 1) diff += Math.abs(left[index] - right[index])
  return round(1 - diff / (left.length * 255), 4)
}

async function runProcess(command, args, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    const stdout = []
    const stderr = []
    child.stdout.on('data', (chunk) => stdout.push(chunk))
    child.stderr.on('data', (chunk) => stderr.push(chunk))
    child.on('error', (error) => {
      if (allowFailure) resolve({ ok: false, code: null, stdout: '', stderr: text(error.message) })
      else reject(error)
    })
    child.on('close', (code) => {
      const result = { ok: code === 0, code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }
      if (code === 0 || allowFailure) resolve(result)
      else reject(new Error(`${command} exited with ${code}: ${result.stderr.slice(-500)}`))
    })
  })
}

async function ffmpegAvailable() {
  const [ffmpeg, ffprobe] = await Promise.all([
    runProcess('ffmpeg', ['-version'], { allowFailure: true }),
    runProcess('ffprobe', ['-version'], { allowFailure: true }),
  ])
  return ffmpeg.ok && ffprobe.ok
}

async function probeDuration(videoPath) {
  const result = await runProcess('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath])
  const duration = Number(result.stdout.trim())
  return Number.isFinite(duration) && duration > 0 ? duration : null
}

async function extractFrame(videoPath, second, outputPath) {
  const result = await runProcess('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, second)), '-i', videoPath, '-frames:v', '1', '-vf', 'scale=640:-2', outputPath], { allowFailure: true })
  if (!result.ok) return false
  try { return (await stat(outputPath)).size > 0 } catch { return false }
}

async function compareVideos(sourcePath, outputPath, tempRoot) {
  if (!await ffmpegAvailable()) return { available: false, reason: 'FFMPEG_NOT_AVAILABLE', samples: [], averageSimilarity: null }
  const [sourceDuration, outputDuration] = await Promise.all([probeDuration(sourcePath), probeDuration(outputPath)])
  if (!sourceDuration || !outputDuration) return { available: false, reason: 'VIDEO_DURATION_UNAVAILABLE', samples: [], averageSimilarity: null }
  const positions = [0.1, 0.5, 0.9]
  const samples = []
  for (let index = 0; index < positions.length; index += 1) {
    const position = positions[index]
    const sourceFrame = path.join(tempRoot, `source-${index}.png`)
    const outputFrame = path.join(tempRoot, `output-${index}.png`)
    const [sourceOk, outputOk] = await Promise.all([
      extractFrame(sourcePath, Math.max(0, sourceDuration * position - 0.05), sourceFrame),
      extractFrame(outputPath, Math.max(0, outputDuration * position - 0.05), outputFrame),
    ])
    if (!sourceOk || !outputOk) continue
    const [sourcePixels, outputPixels] = await Promise.all([canonicalPixels(sourceFrame), canonicalPixels(outputFrame)])
    samples.push({ position, similarity: pixelSimilarity(sourcePixels, outputPixels) })
  }
  const comparable = samples.map((item) => item.similarity).filter((value) => typeof value === 'number')
  return {
    available: comparable.length > 0,
    sourceDuration: round(sourceDuration, 3),
    outputDuration: round(outputDuration, 3),
    samples,
    averageSimilarity: comparable.length ? round(comparable.reduce((sum, value) => sum + value, 0) / comparable.length, 4) : null,
  }
}

function blocker(code, message, severity = 'critical') { return { code, message, severity } }

function publicAuditSnapshot(audit) {
  const value = safeObject(audit)
  return {
    schemaVersion: text(value.schemaVersion) || AUDIT_SCHEMA_VERSION,
    status: text(value.status) || 'not_run',
    verdict: text(value.verdict) || 'not_evaluated',
    executedAt: value.executedAt || null,
    executedByProfileId: value.executedByProfileId || null,
    blockers: Array.isArray(value.blockers) ? value.blockers.map((item) => ({ code: text(item.code), message: text(item.message), severity: text(item.severity) || 'critical' })) : [],
    adapter: safeObject(value.adapter),
    sourceLineage: safeObject(value.sourceLineage),
    similarity: safeObject(value.similarity),
    futureValidation: safeObject(value.futureValidation),
    safety: safeObject(value.safety),
  }
}

export async function inspectActorIdentityVideoForensicReadiness(actorProfileId) {
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const evidence = visualEvidence(adapter)
  const audit = publicAuditSnapshot(evidence.forensicAudit)
  return {
    status: 'STAGE_2_2D3_6H3_VIDEO_FORENSIC_READINESS',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    previewStatus: text(evidence.status) || 'not_started',
    assetCount: qaAssets(adapter).length,
    forensicAudit: audit,
    nextPaidTestAllowed: audit.status === 'passed' && safeObject(audit.futureValidation).nextPaidTestAllowed === true,
    safety: { databaseReadExecuted: true, databaseMutationExecuted: false, r2ReadExecuted: false, runPodCalled: false, gpuStarted: false, destructiveDelete: false },
  }
}

export async function runActorIdentityVideoForensicAudit(actorProfileId, { requestedByProfileId = null, confirmation, persist = true } = {}) {
  if (text(confirmation) !== FORENSIC_CONFIRMATION) throw new ApiError(400, 'Confirmação inválida para executar a auditoria forense sem GPU.')
  if (!requestedByProfileId && persist) throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela auditoria.')

  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const evidence = visualEvidence(adapter)
  const assets = qaAssets(adapter)
  const inputs = selectLegacyD36H2Inputs(run)
  const blockers = []

  if (!inputs.image) blockers.push(blocker('REFERENCE_IMAGE_MISSING', 'Nenhuma imagem privada do mapeamento foi localizada para reconstruir a linhagem do D3.6H2.'))
  if (!inputs.video) blockers.push(blocker('CONTROL_VIDEO_MISSING', 'Nenhum vídeo privado do mapeamento foi localizado para reconstruir a linhagem do D3.6H2.'))
  if (text(inputs.image?.systemTag) !== 'face_front') blockers.push(blocker('REFERENCE_IMAGE_NOT_FACE_FRONT', `O D3.6H2 selecionou a imagem ${text(inputs.image?.systemTag) || 'sem categoria'} em vez da foto frontal do rosto.`))
  if (inputs.video) blockers.push(blocker('ACTOR_MAPPING_USED_AS_RAW_CONTROL_VIDEO', 'O vídeo do próprio mapeamento foi usado como controle RGB integral, impedindo provar a criação em um vídeo-base aleatório.'))
  blockers.push(blocker('RANDOM_BASE_VIDEO_NOT_USED', 'O kit atual não utilizou um vídeo-base aleatório e independente do mapeamento do ator.'))
  blockers.push(blocker('BASELINE_WITHOUT_LORA_MISSING', 'Não existe saída de comparação com a mesma seed e o adapter desligado.'))
  if (assets.length !== 4) blockers.push(blocker('QA_KIT_ASSET_SET_INCOMPLETE', `Foram encontradas ${assets.length} evidências; o kit D3.6H2 esperava quatro.`))

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'privacy-identity-forensic-'))
  let adapterAudit = { verified: false, sha256Matched: false, byteSizeMatched: false, safetensorsHeaderValid: false, tensorCount: 0, loraTensorCount: 0, targetTensorCount: 0, targetFamilies: [], sha256Prefix: prefix(adapter.sha256), byteSize: Number(adapter.byte_size || 0) }
  const imageComparisons = []
  let videoComparison = { available: false, reason: 'NOT_EXECUTED', samples: [], averageSimilarity: null }
  let r2ReadCount = 0

  try {
    const adapterPath = path.join(tempRoot, 'adapter.safetensors')
    await downloadPrivateObjectToFile({ bucket: adapter.r2_bucket, key: adapter.r2_key, filePath: adapterPath })
    r2ReadCount += 1
    const [actualSha256, adapterStat, header] = await Promise.all([sha256File(adapterPath), stat(adapterPath), parseSafetensorsHeader(adapterPath)])
    adapterAudit = {
      verified: true,
      sha256Matched: actualSha256 === text(adapter.sha256).toLowerCase(),
      byteSizeMatched: Number(adapterStat.size) === Number(adapter.byte_size),
      safetensorsHeaderValid: header.valid === true,
      tensorCount: Number(header.tensorCount || 0),
      loraTensorCount: Number(header.loraTensorCount || 0),
      targetTensorCount: Number(header.targetTensorCount || 0),
      targetFamilies: header.targetFamilies || [],
      keySamples: header.keySamples || [],
      metadataKeys: header.metadataKeys || [],
      sha256Prefix: actualSha256.slice(0, 12),
      byteSize: Number(adapterStat.size),
    }
    if (!adapterAudit.sha256Matched) blockers.push(blocker('ADAPTER_SHA256_MISMATCH', 'O checksum real do adapter privado não corresponde ao registro do banco.'))
    if (!adapterAudit.byteSizeMatched) blockers.push(blocker('ADAPTER_BYTE_SIZE_MISMATCH', 'O tamanho real do adapter privado não corresponde ao registro do banco.'))
    if (!adapterAudit.safetensorsHeaderValid) blockers.push(blocker('ADAPTER_SAFETENSORS_STRUCTURE_INVALID', 'O arquivo existe, mas o cabeçalho não comprovou tensores LoRA ligados ao runtime de vídeo.'))

    if (inputs.image) {
      const referencePath = path.join(tempRoot, 'legacy-reference-image')
      await downloadPrivateObjectToFile({ bucket: inputs.image.source.bucket, key: inputs.image.source.key, filePath: referencePath })
      r2ReadCount += 1
      const referencePixels = await canonicalPixels(referencePath)
      const imageAssets = assets.filter((item) => text(item.kind) === 'image')
      const outputPixels = new Map()
      for (const item of imageAssets) {
        const outputPath = path.join(tempRoot, `${text(item.assetKey) || 'image'}.bin`)
        await downloadPrivateObjectToFile({ bucket: item.r2Bucket, key: item.r2Key, filePath: outputPath })
        r2ReadCount += 1
        const pixels = await canonicalPixels(outputPath)
        outputPixels.set(text(item.assetKey), pixels)
        imageComparisons.push({ left: 'mapping_reference', right: text(item.assetKey), similarity: pixelSimilarity(referencePixels, pixels), relation: 'source_to_output' })
      }
      const entries = [...outputPixels.entries()]
      for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
          imageComparisons.push({ left: entries[leftIndex][0], right: entries[rightIndex][0], similarity: pixelSimilarity(entries[leftIndex][1], entries[rightIndex][1]), relation: 'output_to_output' })
        }
      }
    }

    if (inputs.video) {
      const outputVideo = assets.find((item) => text(item.kind) === 'video')
      if (outputVideo) {
        const sourceVideoPath = path.join(tempRoot, 'legacy-control-video.mp4')
        const outputVideoPath = path.join(tempRoot, 'qa-output-video.mp4')
        await Promise.all([
          downloadPrivateObjectToFile({ bucket: inputs.video.source.bucket, key: inputs.video.source.key, filePath: sourceVideoPath }),
          downloadPrivateObjectToFile({ bucket: outputVideo.r2Bucket, key: outputVideo.r2Key, filePath: outputVideoPath }),
        ])
        r2ReadCount += 2
        videoComparison = await compareVideos(sourceVideoPath, outputVideoPath, tempRoot)
      }
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }

  const sourceImageSimilarities = imageComparisons.filter((item) => item.relation === 'source_to_output' && typeof item.similarity === 'number').map((item) => item.similarity)
  const duplicateSimilarities = imageComparisons.filter((item) => item.relation === 'output_to_output' && typeof item.similarity === 'number').map((item) => item.similarity)
  const maxSourceSimilarity = sourceImageSimilarities.length ? Math.max(...sourceImageSimilarities) : null
  const maxOutputPairSimilarity = duplicateSimilarities.length ? Math.max(...duplicateSimilarities) : null
  if (maxSourceSimilarity != null && maxSourceSimilarity >= IMAGE_SOURCE_SIMILARITY_LIMIT) blockers.push(blocker('SOURCE_RECONSTRUCTION_DETECTED', `As imagens do kit ficaram excessivamente próximas da foto do mapeamento (${round(maxSourceSimilarity * 100, 1)}% de similaridade canônica).`))
  if (maxOutputPairSimilarity != null && maxOutputPairSimilarity >= IMAGE_DUPLICATE_SIMILARITY_LIMIT) blockers.push(blocker('DUPLICATE_QA_IMAGES_DETECTED', `As imagens apresentadas como cenas diferentes ficaram praticamente iguais (${round(maxOutputPairSimilarity * 100, 1)}% de similaridade canônica).`))
  if (videoComparison.available && Number(videoComparison.averageSimilarity) >= VIDEO_SOURCE_SIMILARITY_LIMIT) blockers.push(blocker('CONTROL_DOMINATED_VIDEO_DETECTED', `O vídeo gerado preservou excessivamente o vídeo do mapeamento (${round(Number(videoComparison.averageSimilarity) * 100, 1)}% de similaridade média entre quadros).`))

  const uniqueBlockers = [...new Map(blockers.map((item) => [item.code, item])).values()]
  const auditStatus = uniqueBlockers.some((item) => item.severity === 'critical') ? 'failed' : 'passed'
  const now = new Date().toISOString()
  const audit = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: auditStatus,
    verdict: auditStatus === 'passed' ? 'video_identity_evidence_valid' : 'invalid_evidence_adapter_unproven',
    executedAt: now,
    executedByProfileId: requestedByProfileId || null,
    mode: 'private_cpu_no_gpu',
    adapter: adapterAudit,
    sourceLineage: {
      referenceImageAssetId: inputs.image?.assetId || null,
      referenceImageSystemTag: text(inputs.image?.systemTag) || null,
      referenceImageChecksumPrefix: prefix(inputs.image?.checksumSha256),
      preferredFaceFrontAssetId: inputs.preferredFaceFront?.assetId || null,
      controlVideoAssetId: inputs.video?.assetId || null,
      controlVideoSystemTag: text(inputs.video?.systemTag) || null,
      controlVideoChecksumPrefix: prefix(inputs.video?.checksumSha256),
      preferredWalkVideoAssetId: inputs.preferredWalkVideo?.assetId || null,
      actorMappingUsedAsRawRgbControl: Boolean(inputs.video),
      randomBaseVideoUsed: false,
    },
    similarity: {
      imageComparisons,
      maxSourceSimilarity: maxSourceSimilarity == null ? null : round(maxSourceSimilarity, 4),
      maxOutputPairSimilarity: maxOutputPairSimilarity == null ? null : round(maxOutputPairSimilarity, 4),
      video: videoComparison,
      thresholds: {
        imageSourceSimilarityLimit: IMAGE_SOURCE_SIMILARITY_LIMIT,
        imageDuplicateSimilarityLimit: IMAGE_DUPLICATE_SIMILARITY_LIMIT,
        videoSourceSimilarityLimit: VIDEO_SOURCE_SIMILARITY_LIMIT,
      },
    },
    blockers: uniqueBlockers,
    futureValidation: {
      profile: FUTURE_VALIDATION_PROFILE,
      targetUseCases: ['prompt_to_video', 'random_base_video_v2v'],
      requiresRandomBaseVideo: true,
      requiresMotionOnlyControl: true,
      actorMappingRawRgbControlAllowed: false,
      requiresFaceFrontReference: true,
      requiresSameSeedBaselineWithoutLora: true,
      requiresCandidateWithLora: true,
      requiresSingleControlledJob: true,
      nextPaidTestAllowed: false,
      reason: 'O próximo teste pago permanece bloqueado até existir um contrato de vídeo A/B com vídeo-base aleatório, controle de movimento sem aparência e verificação estática completa.',
    },
    safety: {
      databaseReadExecuted: true,
      databaseMutationExecuted: Boolean(persist),
      r2ReadExecuted: r2ReadCount > 0,
      r2ReadCount,
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      automaticRetryCreated: false,
      adapterApproved: false,
      productReleased: false,
      publicUrlCreated: false,
      destructiveDelete: false,
      localTemporaryFilesRemoved: true,
    },
  }

  if (persist) {
    const qaReport = safeObject(adapter.qa_report)
    const nextEvidence = {
      ...evidence,
      forensicAudit: audit,
      ...(auditStatus === 'failed' ? {
        status: 'invalid',
        ready: false,
        reviewable: false,
        failureCode: 'CONTROL_DOMINATED_OUTPUT',
        operatorMessage: 'Kit D3.6H2 invalidado: ele reutilizou materiais do mapeamento como controle visual e não comprovou a identidade em vídeo-base aleatório.',
        invalidatedAt: now,
        invalidationReason: 'CONTROL_DOMINATED_OUTPUT',
      } : {}),
    }
    const update = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .update({ qa_report: { ...qaReport, visualEvidence: nextEvidence }, updated_at: now })
      .eq('id', adapter.id)
      .eq('actor_profile_id', actorProfileId)
      .eq('training_run_id', run.id)
      .select('id')
      .single()
    if (update.error) throw new ApiError(500, 'Erro ao registrar a auditoria forense da identidade.', update.error)
  }

  return {
    status: auditStatus === 'passed' ? 'STAGE_2_2D3_6H3_VIDEO_FORENSIC_AUDIT_PASSED' : 'STAGE_2_2D3_6H3_VIDEO_FORENSIC_AUDIT_FAILED_SAFE',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    forensicAudit: publicAuditSnapshot(audit),
    nextPaidTestAllowed: false,
    nextAction: auditStatus === 'passed'
      ? 'Manter a identidade em revisão e preparar o contrato final de vídeo A/B sem executar GPU.'
      : 'Preservar o adapter em qa_pending. Corrigir o contrato de validação antes de qualquer novo teste pago.',
    safety: audit.safety,
  }
}

export { FORENSIC_CONFIRMATION as IDENTITY_VIDEO_FORENSIC_CONFIRMATION, FUTURE_VALIDATION_PROFILE }
