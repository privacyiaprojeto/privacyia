import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === 'boolean') return value
    return String(value || 'false').toLowerCase() === 'true'
  })

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_TEXT_MODEL: z.string().default('nvidia/nemotron-3-super-120b-a12b:free'),
  OPENROUTER_EMBEDDING_MODEL: z.string().default('nomic-ai/nomic-embed-text'),

  // RunPod base / endpoints
  RUNPOD_API_KEY: z.string().optional().default(''),
  RUNPOD_BASE_URL: z.string().url().default('https://api.runpod.ai/v2'),
  RUNPOD_GPU_COST_PER_SECOND_USD: z.coerce.number().nonnegative().default(0),
  RUNPOD_GPU_TYPE: z.string().optional().default(''),

  // RunPod Image
  RUNPOD_IMAGE_ENDPOINT_ID: z.string().optional().default(''),
  RUNPOD_IMAGE_TIMEOUT_MS: z.coerce.number().default(240000),
  RUNPOD_IMAGE_QUEUE_TIMEOUT_MS: z.coerce.number().default(120000),
  RUNPOD_IMAGE_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  RUNPOD_IMAGE_GPU_COST_PER_SECOND_USD: z.coerce.number().nonnegative().default(0),
  RUNPOD_IMAGE_GPU_TYPE: z.string().optional().default(''),
  MEDIA_IMAGE_JOB_KIND: z.string().optional().default('image'),
  MEDIA_IMAGE_COST_CREDITS: z.coerce.number().default(30),

  // RunPod Video / Wan-ComfyUI workflow
  RUNPOD_VIDEO_ENDPOINT_ID: z.string().optional().default(''),
  RUNPOD_VIDEO_TIMEOUT_MS: z.coerce.number().default(900000),
  RUNPOD_VIDEO_QUEUE_TIMEOUT_MS: z.coerce.number().default(180000),
  RUNPOD_VIDEO_SHORT_TIMEOUT_MS: z.coerce.number().default(1200000),
  RUNPOD_VIDEO_SHORT_QUEUE_TIMEOUT_MS: z.coerce.number().default(300000),
  RUNPOD_VIDEO_V2V_TIMEOUT_MS: z.coerce.number().default(3600000),
  RUNPOD_VIDEO_V2V_QUEUE_TIMEOUT_MS: z.coerce.number().default(900000),
  RUNPOD_VIDEO_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  RUNPOD_VIDEO_GPU_COST_PER_SECOND_USD: z.coerce.number().nonnegative().default(0),
  RUNPOD_VIDEO_GPU_TYPE: z.string().optional().default(''),
  RUNPOD_MEDIA_DOWNLOAD_MAX_BYTES: z.coerce.number().default(314572800),
  MEDIA_VIDEO_JOB_KIND: z.string().optional().default('video'),
  MEDIA_VIDEO_COST_CREDITS: z.coerce.number().default(80),

  // Endpoint antigo de áudio: Fish Speech
  RUNPOD_FISH_SPEECH_ENDPOINT_ID: z.string().optional().default(''),

  // Endpoint novo de áudio: Qwen3-TTS / CosyVoice
  RUNPOD_QWEN_TTS_ENDPOINT_ID: z.string().optional().default(''),

  // Endpoint legado/fallback de áudio
  RUNPOD_AUDIO_ENDPOINT_ID: z.string().optional().default(''),

  RUNPOD_AUDIO_TIMEOUT_MS: z.coerce.number().default(600000),
  RUNPOD_AUDIO_QUEUE_TIMEOUT_MS: z.coerce.number().default(180000),
  RUNPOD_AUDIO_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  RUNPOD_AUDIO_GPU_COST_PER_SECOND_USD: z.coerce.number().nonnegative().default(0),
  RUNPOD_AUDIO_GPU_TYPE: z.string().optional().default(''),

  // TTS Gateway
  TTS_MAX_CHARS: z.coerce.number().default(350),
  TTS_DEFAULT_LANGUAGE: z.string().default('pt'),
  TTS_OUTPUT_FORMAT: z.string().default('mp3'),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().optional().default(''),
  R2_PUBLIC_BASE_URL: z.string().optional().default(''),

  // Redis / BullMQ
  REDIS_URL: z.string().optional().default(''),
  REDIS_HOST: z.string().optional().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_USERNAME: z.string().optional().default(''),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_TLS: booleanFromString.default(false),
  REDIS_QUEUE_PREFIX: z.string().optional().default('privacy-ia'),
  WORKERS_ENABLED: booleanFromString.default(false),
  ALLOW_EXTERNAL_REDIS_WORKERS: booleanFromString.default(false),
  FACTORY_WORKER_CONCURRENCY: z.coerce.number().default(2),
  IMAGE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  VIDEO_SHORT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  VIDEO_V2V_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  AUDIO_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  RENDITION_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  IMAGE_WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(300000),
  VIDEO_SHORT_WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(1500000),
  VIDEO_V2V_WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(3900000),
  AUDIO_WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(720000),
  RENDITION_WORKER_JOB_TIMEOUT_MS: z.coerce.number().default(1800000),
  RENDITION_QUEUE_ENABLED: booleanFromString.default(false),

  // P3 — FFmpeg / renditions privadas / HLS
  FFMPEG_PATH: z.string().optional().default('ffmpeg'),
  FFPROBE_PATH: z.string().optional().default('ffprobe'),
  RENDITION_TEMP_ROOT: z.string().optional().default(''),
  RENDITION_PREVIEW_MAX_WIDTH: z.coerce.number().int().min(320).max(1920).default(960),
  RENDITION_PREVIEW_CRF: z.coerce.number().int().min(18).max(40).default(27),
  RENDITION_HLS_MAX_WIDTH: z.coerce.number().int().min(320).max(3840).default(1280),
  RENDITION_HLS_CRF: z.coerce.number().int().min(18).max(40).default(23),
  RENDITION_HLS_SEGMENT_SECONDS: z.coerce.number().int().min(2).max(15).default(6),
  RENDITION_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(180),
  RENDITION_MANIFEST_MAX_BYTES: z.coerce.number().int().min(16384).max(4194304).default(1048576),
  MEDIA_PROTECTED_IMAGE_MAX_BYTES: z.coerce.number().int().min(1048576).max(104857600).default(36700160),
  // Abertura de vídeo no Cliente exige homologação explícita; ausente/false permanece fail-closed.
  PROTECTED_VIDEO_RENDERER_ENABLED: booleanFromString.default(false),

  // P3 — limites distribuídos das rotas de mídia
  MEDIA_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(60000),
  MEDIA_RATE_LIMIT_DELIVERIES_MAX: z.coerce.number().int().min(1).max(10000).default(120),
  MEDIA_RATE_LIMIT_PROTECTED_VIEW_MAX: z.coerce.number().int().min(1).max(10000).default(60),
  RUNPOD_LEASE_TTL_MS: z.coerce.number().default(120000),
  RUNPOD_LEASE_HEARTBEAT_MS: z.coerce.number().default(30000),
  RUNPOD_LEASE_COOLDOWN_WAIT_TIMEOUT_MS: z.coerce.number().default(14400000),
  SCENE_DIRECTION_QUEUE_ENABLED: booleanFromString.default(false),
  ACTOR_PIPELINE_QUEUE_ENABLED: booleanFromString.default(false),
  ACTOR_PIPELINE_IMAGE_STAGE_MAX_PRODUCTS: z.coerce.number().int().min(1).max(500).default(48),
  ACTOR_PIPELINE_IMAGE_STAGE_MAX_OUTPUTS: z.coerce.number().int().min(1).max(5000).default(240),
  ACTOR_PIPELINE_IMAGE_REQUEST_MAX_PRODUCTS: z.coerce.number().int().min(1).max(50000).default(5000),
  ACTOR_PIPELINE_IMAGE_REQUEST_MAX_OUTPUTS: z.coerce.number().int().min(1).max(250000).default(25000),

  // Stage 2.2A — LoRA Gatekeeper / VACE Identity Training Readiness
  // O gate de vídeo é fail-closed. Nesta etapa, treino e injeção real permanecem desligados.
  IDENTITY_LORA_TRAINING_ENABLED: booleanFromString.default(false),
  IDENTITY_LORA_TRAINER_DRY_RUN_ONLY: booleanFromString.default(true),
  IDENTITY_LORA_INFERENCE_INJECTION_READY: booleanFromString.default(false),
  IDENTITY_LORA_BASE_MODEL: z.string().default('Wan-AI/Wan2.1-VACE-14B'),
  IDENTITY_LORA_BASE_MODEL_REVISION: z.string().optional().default(''),
  IDENTITY_LORA_BASE_MODEL_FINGERPRINT: z.string().optional().default(''),
  IDENTITY_LORA_BASE_MODEL_LOCK_PATH: z.string().optional().default('infra/identity-lora-trainer/base-model.lock.json'),
  IDENTITY_LORA_TRAINING_ENGINE_COMMIT: z.string().default('fb337fb'),
  IDENTITY_LORA_PRIVATE_BUCKET: z.string().optional().default(''),
  // Stage 2.2D3.5 — plano seguro anterior a qualquer execução real
  IDENTITY_LORA_TRAINING_PROVIDER: z.string().default('runpod_serverless'),
  IDENTITY_LORA_TRAINER_ENDPOINT_ID: z.string().optional().default(''),
  IDENTITY_LORA_TRAINING_OUTPUT_PREFIX: z.string().default('identity-adapters'),
  // Stage 2.2D3.6A — execução real controlada, fechada por padrão
  IDENTITY_LORA_TRAINER_CONTRACT_VERSION: z.string().default('privacy-identity-lora-training-v2'),
  IDENTITY_LORA_TRAINER_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  IDENTITY_LORA_TRAINING_PROFILE: z.string().default('wan_dit_identity_video_v1'),
  // Stage 2.2D3.6H4 — compatibilidade do alvo de treinamento, sempre fechada por padrão
  IDENTITY_LORA_TRAINING_TARGET_PROFILE: z.string().default('blocked_pending_d3_6h4'),
  IDENTITY_LORA_TRAINING_TARGET_AUDIT_APPROVED: booleanFromString.default(false),
  IDENTITY_LORA_PAID_TRAINING_AFTER_TARGET_AUDIT: booleanFromString.default(false),
  IDENTITY_LORA_MIN_APPROVED_IMAGES: z.coerce.number().int().min(1).max(100).default(15),
  IDENTITY_LORA_MIN_APPROVED_VIDEOS: z.coerce.number().int().min(1).max(100).default(6),
  // Stage 2.2D3.6B — primeiro treino real one-shot, limitado a um ator e um run
  IDENTITY_LORA_REAL_SMOKE_ENABLED: booleanFromString.default(false),
  IDENTITY_LORA_REAL_SMOKE_ACTOR_PROFILE_ID: z.string().optional().default(''),
  IDENTITY_LORA_REAL_SMOKE_TRAINING_RUN_ID: z.string().optional().default(''),
  IDENTITY_LORA_REAL_SMOKE_EXPIRES_AT: z.string().optional().default(''),
  IDENTITY_LORA_REAL_SMOKE_MAX_JOBS: z.coerce.number().int().min(1).max(1).default(1),
  // Stage 2.2D3.6H — prévia visual privada one-shot, independente do treino
  IDENTITY_LORA_PREVIEW_ENABLED: booleanFromString.default(false),
  IDENTITY_LORA_PREVIEW_DRY_RUN_ONLY: booleanFromString.default(true),
  IDENTITY_LORA_PREVIEW_SMOKE_ENABLED: booleanFromString.default(false),
  IDENTITY_LORA_PREVIEW_ACTOR_PROFILE_ID: z.string().optional().default(''),
  IDENTITY_LORA_PREVIEW_TRAINING_RUN_ID: z.string().optional().default(''),
  IDENTITY_LORA_PREVIEW_ADAPTER_ID: z.string().optional().default(''),
  IDENTITY_LORA_PREVIEW_EXPIRES_AT: z.string().optional().default(''),
  IDENTITY_LORA_PREVIEW_MAX_JOBS: z.coerce.number().int().min(1).max(1).default(1),
  IDENTITY_LORA_PREVIEW_CONTRACT_VERSION: z.string().default('privacy-identity-neutral-ab-v1'),
  IDENTITY_LORA_QA_VIDEO_ENDPOINT_ID: z.string().optional().default(''),
  IDENTITY_LORA_NEUTRAL_QA_BUCKET: z.string().default('privacy-media'),
  IDENTITY_LORA_NEUTRAL_QA_KEY: z.string().default('qa-assets/neutral-motion-01.mp4'),
  IDENTITY_LORA_NEUTRAL_QA_SHA256: z.string().optional().default(''),
  IDENTITY_LORA_PREVIEW_OUTPUT_PREFIX: z.string().default('identity-review-previews'),
  IDENTITY_LORA_PREVIEW_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),

  // Swagger / OpenAPI docs (desabilitado por padrão para evitar information disclosure)
  ENABLE_SWAGGER: booleanFromString.default(false),
})

export const env = envSchema.parse(process.env)
