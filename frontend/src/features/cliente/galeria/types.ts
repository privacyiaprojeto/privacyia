export type MidiaTipo = 'foto' | 'video' | 'live_action' | 'live_audio'

export interface MidiaGaleria {
  id: string
  atrizId: string
  tipo: MidiaTipo
  url: string
  criadaEm: string
  salvaDoFeed: boolean
}

export interface GaleriaAtriz {
  id: string
  slug: string
  nome: string
  avatar: string
  banner: string
  assinaturaAtiva: boolean
  totalMidias: number
  previewUrl: string
}
