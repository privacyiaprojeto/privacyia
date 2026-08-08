import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export interface PromptDictionaryItemDto {
  id: string
  category: string
  label: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface AudioStorylineDto {
  id: string
  title: string
  script: string
  voiceTone: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface PromptDictionaryPayload {
  category: string
  label: string
  isActive?: boolean
}

export interface AudioStorylinePayload {
  title: string
  script: string
  voiceTone: string
  isActive?: boolean
}

export async function listPromptDictionaries(category?: string): Promise<{ items: PromptDictionaryItemDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: PromptDictionaryItemDto[] }>>('/api/admin/intelligence/prompt-dictionaries', {
    params: { category: category || undefined, includeInactive: true },
  })
  return data.data
}

export async function createPromptDictionary(payload: PromptDictionaryPayload): Promise<{ item: PromptDictionaryItemDto; message: string }> {
  const { data } = await api.post<ApiEnvelope<{ item: PromptDictionaryItemDto; message: string }>>('/api/admin/intelligence/prompt-dictionaries', payload)
  return data.data
}

export async function updatePromptDictionary(itemId: string, payload: Partial<PromptDictionaryPayload>): Promise<{ item: PromptDictionaryItemDto; message: string }> {
  const { data } = await api.patch<ApiEnvelope<{ item: PromptDictionaryItemDto; message: string }>>(`/api/admin/intelligence/prompt-dictionaries/${itemId}`, payload)
  return data.data
}

export async function listAudioStorylines(): Promise<{ items: AudioStorylineDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: AudioStorylineDto[] }>>('/api/admin/intelligence/audio-storylines', {
    params: { includeInactive: true },
  })
  return data.data
}

export async function createAudioStoryline(payload: AudioStorylinePayload): Promise<{ item: AudioStorylineDto; message: string }> {
  const { data } = await api.post<ApiEnvelope<{ item: AudioStorylineDto; message: string }>>('/api/admin/intelligence/audio-storylines', payload)
  return data.data
}

export async function updateAudioStoryline(itemId: string, payload: Partial<AudioStorylinePayload>): Promise<{ item: AudioStorylineDto; message: string }> {
  const { data } = await api.patch<ApiEnvelope<{ item: AudioStorylineDto; message: string }>>(`/api/admin/intelligence/audio-storylines/${itemId}`, payload)
  return data.data
}
