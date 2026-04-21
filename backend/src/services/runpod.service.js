import axios from 'axios'
import { env } from '../config/env.js'

const runpod = axios.create({
  baseURL: env.RUNPOD_BASE_URL,
  headers: {
    Authorization: env.RUNPOD_API_KEY ? `Bearer ${env.RUNPOD_API_KEY}` : undefined,
    'Content-Type': 'application/json',
  },
})

export async function submitImageJob(payload) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_IMAGE_ENDPOINT_ID) {
    throw new Error('RunPod de imagem não configurado.')
  }

  const response = await runpod.post(`/${env.RUNPOD_IMAGE_ENDPOINT_ID}/run`, {
    input: payload,
  })

  return response.data
}

export async function submitAudioJob(payload) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_AUDIO_ENDPOINT_ID) {
    throw new Error('RunPod de áudio não configurado.')
  }

  const response = await runpod.post(`/${env.RUNPOD_AUDIO_ENDPOINT_ID}/run`, {
    input: payload,
  })

  return response.data
}

export async function getJobStatus(endpointId, jobId) {
  if (!env.RUNPOD_API_KEY || !endpointId) {
    throw new Error('RunPod não configurado.')
  }

  const response = await runpod.get(`/${endpointId}/status/${jobId}`)
  return response.data
}
