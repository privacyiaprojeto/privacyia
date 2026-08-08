import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export type MappingRequirementMediaType = 'image' | 'audio' | 'video'
export type MappingRequirementSystemTag =
  | 'face_front'
  | 'face_profile'
  | 'face_profile_left'
  | 'face_profile_right'
  | 'body_front'
  | 'body_back'
  | 'nsfw_front'
  | 'nsfw_back'
  | 'nsfw_closeup_front'
  | 'nsfw_closeup_back'
  | 'voice_natural'
  | 'voice_whisper'
  | 'voice_affectionate'
  | 'nsfw_voice_moan'
  | 'video_expression'
  | 'video_walk'

export const MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS: Array<{ value: MappingRequirementSystemTag; label: string }> = [
  { value: 'face_front', label: 'Rosto Frontal' },
  { value: 'face_profile_left', label: 'Rosto Perfil — Lado Esquerdo' },
  { value: 'face_profile_right', label: 'Rosto Perfil — Lado Direito' },
  { value: 'body_front', label: 'Corpo Frente' },
  { value: 'body_back', label: 'Corpo Costas' },
  { value: 'nsfw_front', label: 'Explícito Frente' },
  { value: 'nsfw_back', label: 'Explícito Costas' },
  { value: 'nsfw_closeup_front', label: 'Proximidade 18+ Frente' },
  { value: 'nsfw_closeup_back', label: 'Proximidade 18+ Costas' },
  { value: 'voice_natural', label: 'Voz Natural' },
  { value: 'voice_whisper', label: 'Voz Sussurro' },
  { value: 'voice_affectionate', label: 'Voz Carinhosa' },
  { value: 'nsfw_voice_moan', label: 'Voz Explícita' },
  { value: 'video_expression', label: 'Vídeo Rosto' },
  { value: 'video_walk', label: 'Vídeo Caminhada' },
]

export interface MappingRequirement {
  id: string
  title: string
  description: string
  guidance: string
  mediaType: MappingRequirementMediaType
  systemTag: MappingRequirementSystemTag | null
  isRequired: boolean
  isActive: boolean
  acceptedMimeTypes: string[]
  accept: string
  createdAt: string | null
  updatedAt: string | null
}

export interface MappingRequirementsResponse {
  items: MappingRequirement[]
}

export interface CreateMappingRequirementPayload {
  title: string
  description: string
  mediaType: MappingRequirementMediaType
  systemTag: MappingRequirementSystemTag | null
  isRequired: boolean
}

export interface UpdateMappingRequirementPayload extends Partial<CreateMappingRequirementPayload> {
  isActive?: boolean
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data
  }
  return payload as T
}

export async function getMappingRequirements(includeInactive = true): Promise<MappingRequirementsResponse> {
  const { data } = await api.get<ApiEnvelope<MappingRequirementsResponse> | MappingRequirementsResponse>('/api/admin/mapping-requirements', {
    params: { includeInactive },
  })
  return unwrap(data)
}

export async function createMappingRequirement(payload: CreateMappingRequirementPayload): Promise<MappingRequirement> {
  const { data } = await api.post<ApiEnvelope<{ item: MappingRequirement }> | { item: MappingRequirement }>('/api/admin/mapping-requirements', payload)
  return unwrap(data).item
}

export async function updateMappingRequirement(requirementId: string, payload: UpdateMappingRequirementPayload): Promise<MappingRequirement> {
  const { data } = await api.patch<ApiEnvelope<{ item: MappingRequirement }> | { item: MappingRequirement }>(`/api/admin/mapping-requirements/${requirementId}`, payload)
  return unwrap(data).item
}

export async function inactivateMappingRequirement(requirementId: string): Promise<MappingRequirement> {
  const { data } = await api.post<ApiEnvelope<{ item: MappingRequirement }> | { item: MappingRequirement }>(`/api/admin/mapping-requirements/${requirementId}/inactivate`)
  return unwrap(data).item
}
