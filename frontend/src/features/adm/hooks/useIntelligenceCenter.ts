import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAudioStoryline,
  createPromptDictionary,
  listAudioStorylines,
  listPromptDictionaries,
  updateAudioStoryline,
  updatePromptDictionary,
  type AudioStorylinePayload,
  type PromptDictionaryPayload,
} from '@/features/adm/api/intelligenceCenterApi'

export function usePromptDictionaries(category?: string) {
  return useQuery({
    queryKey: ['admin-intelligence-prompt-dictionaries', category || 'all'],
    queryFn: () => listPromptDictionaries(category),
  })
}

export function useCreatePromptDictionary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: PromptDictionaryPayload) => createPromptDictionary(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intelligence-prompt-dictionaries'] })
    },
  })
}

export function useUpdatePromptDictionary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Partial<PromptDictionaryPayload> }) => updatePromptDictionary(itemId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intelligence-prompt-dictionaries'] })
    },
  })
}

export function useAudioStorylines() {
  return useQuery({
    queryKey: ['admin-intelligence-audio-storylines'],
    queryFn: listAudioStorylines,
  })
}

export function useCreateAudioStoryline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: AudioStorylinePayload) => createAudioStoryline(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intelligence-audio-storylines'] })
    },
  })
}

export function useUpdateAudioStoryline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: Partial<AudioStorylinePayload> }) => updateAudioStoryline(itemId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-intelligence-audio-storylines'] })
    },
  })
}
