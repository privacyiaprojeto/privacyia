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
  OPENROUTER_TEXT_MODEL: z.string().default('openai/gpt-4.1-mini'),
  OPENROUTER_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  RUNPOD_API_KEY: z.string().optional().default(''),
  RUNPOD_BASE_URL: z.string().url().default('https://api.runpod.ai/v2'),
  RUNPOD_IMAGE_ENDPOINT_ID: z.string().optional().default(''),
  RUNPOD_AUDIO_ENDPOINT_ID: z.string().optional().default(''),
})

export const env = envSchema.parse(process.env)
