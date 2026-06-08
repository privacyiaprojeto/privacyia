import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

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

  // RunPod Image
  RUNPOD_IMAGE_ENDPOINT_ID: z.string().optional().default(''),
  RUNPOD_IMAGE_TIMEOUT_MS: z.coerce.number().default(240000),
  RUNPOD_IMAGE_QUEUE_TIMEOUT_MS: z.coerce.number().default(120000),
  RUNPOD_IMAGE_POLL_INTERVAL_MS: z.coerce.number().default(3000),
  MEDIA_IMAGE_JOB_KIND: z.string().optional().default('image'),
  MEDIA_IMAGE_COST_CREDITS: z.coerce.number().default(30),

  // RunPod Video / FaceSwap
  RUNPOD_VIDEO_ENDPOINT_ID: z.string().optional().default(''),
  RUNPOD_VIDEO_TIMEOUT_MS: z.coerce.number().default(900000),
  RUNPOD_VIDEO_QUEUE_TIMEOUT_MS: z.coerce.number().default(180000),
  RUNPOD_VIDEO_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  RUNPOD_MEDIA_DOWNLOAD_MAX_BYTES: z.coerce.number().default(314572800),
  MEDIA_VIDEO_JOB_KIND: z.string().optional().default('video'),
  MEDIA_VIDEO_COST_CREDITS: z.coerce.number().default(80),
  FACESWAP_BASE_VIDEO_URL: z.string().url().optional().or(z.literal('')).default(''),

  // Endpoint antigo de áudio: Fish Speech
  RUNPOD_FISH_SPEECH_ENDPOINT_ID: z.string().optional().default(''),

  // Endpoint novo de áudio: Qwen3-TTS / CosyVoice
  RUNPOD_QWEN_TTS_ENDPOINT_ID: z.string().optional().default(''),

  // Endpoint legado/fallback de áudio
  RUNPOD_AUDIO_ENDPOINT_ID: z.string().optional().default(''),

  RUNPOD_AUDIO_TIMEOUT_MS: z.coerce.number().default(600000),
  RUNPOD_AUDIO_POLL_INTERVAL_MS: z.coerce.number().default(3000),

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
})

export const env = envSchema.parse(process.env)
