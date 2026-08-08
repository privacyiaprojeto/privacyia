function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return ''
  try {
    return JSON.stringify(value)
  } catch {
    return String(value).trim()
  }
}

function failureSource({ providerStatus = '', provider = null, storedError = '' } = {}) {
  const providerPayload = safeObject(provider)
  return [
    providerStatus,
    providerPayload.error,
    safeObject(providerPayload.output).error,
    safeObject(providerPayload.output).message,
    providerPayload.message,
    storedError,
  ].map(normalizeText).filter(Boolean).join('\n').slice(0, 12000)
}

export function classifyIdentityTrainingFailure({ providerStatus = '', provider = null, storedError = '' } = {}) {
  const raw = failureSource({ providerStatus, provider, storedError })
  const normalized = raw.toUpperCase()
  let failureCode = 'IDENTITY_TRAINING_PROVIDER_FAILED'
  let failureCategory = 'provider_runtime'
  let retryable = false
  let message = 'O servidor interrompeu a criação antes de produzir a identidade.'
  let operatorMessage = 'Audite o job e os logs técnicos antes de preparar uma nova tentativa controlada.'

  if (normalized.includes('R2_PRIVATE_CONFIG_MISSING')) {
    failureCode = 'R2_PRIVATE_CONFIG_MISSING'
    failureCategory = 'storage_configuration'
    retryable = false
    message = 'A criação foi interrompida antes do treinamento porque a configuração privada do R2 estava ausente.'
    operatorMessage = 'Valide o acesso privado com o preflight D3.6H11 e use somente a recuperação manual D3.6H12.'
  } else if (
    normalized.includes('TRAINING_MODEL_DETECTION_FAILED')
    || normalized.includes('TRAINING_MODEL_PREFLIGHT_FAILED')
    || normalized.includes('TRAINING_MODEL_LOADER_CONTRACT_INVALID')
    || normalized.includes('TRAINING_MODEL_REGISTRY_MISSING_VACE')
    || normalized.includes('MODEL_BINDING_REPOSITORY_MISMATCH')
    || normalized.includes('MODEL_BINDING_SHARDS_INVALID')
    || normalized.includes('MODEL_BINDING_COMPONENT_MISSING')
    || normalized.includes('MODEL_CACHE_MISS')
    || normalized.includes('CANNOT DETECT THE MODEL TYPE')
  ) {
    failureCode = normalized.includes('TRAINING_MODEL_PREFLIGHT_FAILED')
      || normalized.includes('LOADER_CONTRACT_INVALID')
      || normalized.includes('REGISTRY_MISSING_VACE')
        ? 'TRAINING_MODEL_PREFLIGHT_FAILED'
        : 'TRAINING_MODEL_DETECTION_FAILED'
    failureCategory = 'model_binding'
    retryable = true
    message = 'A criação não iniciou porque o loader não reconheceu o modelo-base no binding homologado.'
    operatorMessage = 'Publique e valide a imagem com shards agrupados e preflight do loader antes de preparar um novo run.'
  } else if (
    normalized.includes('TRAINING_RUNTIME_AUDIO_DEPENDENCY_MISSING')
    || normalized.includes("NO MODULE NAMED 'LIBROSA'")
    || normalized.includes("NO MODULE NAMED 'SOUNDFILE'")
    || normalized.includes("NO MODULE NAMED 'SOXR'")
    || normalized.includes("NO MODULE NAMED 'NUMBA'")
    || normalized.includes("NO MODULE NAMED 'SCIPY'")
  ) {
    failureCode = 'TRAINING_RUNTIME_AUDIO_DEPENDENCY_MISSING'
    failureCategory = 'runtime_audio_dependency'
    retryable = true
    message = 'A criação não iniciou porque o runtime interno de áudio exigido pelo trainer estava incompleto.'
    operatorMessage = 'Publique e valide a imagem com o preflight completo do entrypoint antes de preparar um novo run.'
  } else if (
    normalized.includes('TRAINING_RUNTIME_ENTRYPOINT_IMPORT_FAILED')
    || normalized.includes('TRAINING_RUNTIME_ENTRYPOINT_INVALID')
    || normalized.includes('TRAINING_RUNTIME_AUDIO_PROBE_FAILED')
  ) {
    failureCode = normalized.includes('AUDIO_PROBE_FAILED')
      ? 'TRAINING_RUNTIME_AUDIO_PROBE_FAILED'
      : normalized.includes('ENTRYPOINT_INVALID')
        ? 'TRAINING_RUNTIME_ENTRYPOINT_INVALID'
        : 'TRAINING_RUNTIME_ENTRYPOINT_IMPORT_FAILED'
    failureCategory = 'runtime_entrypoint'
    retryable = true
    message = 'A criação não iniciou porque o entrypoint real do trainer não passou no preflight completo.'
    operatorMessage = 'Corrija e valide a imagem do trainer antes de preparar um novo run.'
  } else if (
    normalized.includes('TRAINING_RUNTIME_IMPORT_FAILED')
    || normalized.includes('IS_OFFLINE_MODE')
    || normalized.includes('IMPORTERROR')
    || normalized.includes('MODULENOTFOUNDERROR')
  ) {
    failureCode = 'TRAINING_RUNTIME_IMPORT_FAILED'
    failureCategory = 'runtime_dependency'
    retryable = true
    message = 'A criação não iniciou porque o ambiente Python do trainer estava incompatível.'
    operatorMessage = 'Publique uma imagem do trainer com o lock de dependências validado e prepare um novo run.'
  } else if (
    normalized.includes('TRAINING_RUNTIME_VERSION_MISMATCH')
    || normalized.includes('TRAINING_RUNTIME_DEPENDENCY_MISSING')
    || normalized.includes('TRAINING_RUNTIME_ACCELERATE_INVALID')
    || normalized.includes('TRAINING_RUNTIME_TRANSFORMERS_INVALID')
    || normalized.includes('TRAINING_RUNTIME_SCRIPT_MISSING')
  ) {
    failureCode = normalized.includes('DEPENDENCY_MISSING')
      ? 'TRAINING_RUNTIME_DEPENDENCY_MISSING'
      : normalized.includes('SCRIPT_MISSING')
        ? 'TRAINING_RUNTIME_SCRIPT_MISSING'
        : 'TRAINING_RUNTIME_VERSION_MISMATCH'
    failureCategory = 'runtime_dependency'
    retryable = true
    message = 'A criação não iniciou porque o runtime não corresponde à versão homologada.'
    operatorMessage = 'Corrija e valide a imagem do trainer antes de preparar um novo run.'
  } else if (normalized.includes('TRAINING_GPU_OUT_OF_MEMORY') || normalized.includes('CUDA OUT OF MEMORY')) {
    failureCode = 'TRAINING_GPU_OUT_OF_MEMORY'
    failureCategory = 'gpu_capacity'
    retryable = true
    message = 'A criação foi interrompida por memória insuficiente na GPU.'
    operatorMessage = 'Revise a configuração operacional antes de preparar um novo run.'
  } else if (normalizeText(providerStatus).toUpperCase() === 'TIMED_OUT' || normalized.includes('TIMED_OUT')) {
    failureCode = 'IDENTITY_TRAINING_TIMED_OUT'
    failureCategory = 'provider_timeout'
    retryable = true
    message = 'A criação excedeu o tempo máximo e não produziu uma identidade.'
    operatorMessage = 'Confirme o timeout e os logs do trainer antes de preparar um novo run.'
  } else if (normalized.includes('SMOKE_ALREADY_CONSUMED')) {
    failureCode = 'SMOKE_ALREADY_CONSUMED'
    failureCategory = 'one_shot_guard'
    retryable = false
    message = 'A proteção de execução única bloqueou uma solicitação repetida.'
    operatorMessage = 'Não reenvie o mesmo run. Audite o job original.'
  } else if (normalized.includes('ADAPTER_NOT_FOUND')) {
    failureCode = 'ADAPTER_NOT_FOUND'
    failureCategory = 'training_output'
    retryable = true
    message = 'O treinamento terminou sem produzir o adapter esperado.'
    operatorMessage = 'Audite a saída do DiffSynth antes de preparar um novo run.'
  } else if (normalized.includes('DIFFSYNTH_TRAINING_FAILED')) {
    failureCode = 'DIFFSYNTH_TRAINING_FAILED'
    failureCategory = 'training_engine'
    retryable = true
    message = 'O motor de treinamento encerrou antes de produzir a identidade.'
    operatorMessage = 'Audite os logs técnicos e prepare um novo run somente após a correção.'
  }

  return { failureCode, failureCategory, retryable, message, operatorMessage }
}
