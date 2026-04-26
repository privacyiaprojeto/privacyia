import {
  BookHeart,
  Briefcase,
  Crown,
  EyeOff,
  Flame,
  Flower2,
  Heart,
  Laugh,
  Moon,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'

export interface PersonaOption {
  value: string
  label: string
  icon: LucideIcon
}

export const DEFAULT_RELATIONSHIP_TYPE = 'desconhecidos'
export const DEFAULT_CURRENT_MOOD = 'natural'

export const relationshipOptions: PersonaOption[] = [
  { value: DEFAULT_RELATIONSHIP_TYPE, label: 'Desconhecidos', icon: Sparkles },
  { value: 'amigos', label: 'Amigos', icon: Users },
  { value: 'namorados', label: 'Namorados', icon: Heart },
  { value: 'casados', label: 'Casados', icon: BookHeart },
  { value: 'mestre/submissa', label: 'Mestre/Submissa', icon: Crown },
  { value: 'colegas', label: 'Colegas', icon: Briefcase },
]

export const moodOptions: PersonaOption[] = [
  { value: DEFAULT_CURRENT_MOOD, label: 'Natural', icon: Sparkles },
  { value: 'carinhosa', label: 'Carinhosa', icon: Heart },
  { value: 'tímida', label: 'Tímida', icon: EyeOff },
  { value: 'provocadora', label: 'Provocadora', icon: Flame },
  { value: 'ciumenta', label: 'Ciumenta', icon: Moon },
  { value: 'dominante', label: 'Dominante', icon: Crown },
  { value: 'brincalhona', label: 'Brincalhona', icon: Laugh },
  { value: 'romântica', label: 'Romântica', icon: Flower2 },
]

export function getRelationshipLabel(value?: string | null) {
  return relationshipOptions.find((option) => option.value === value)?.label || value || 'Desconhecidos'
}

export function getMoodLabel(value?: string | null) {
  return moodOptions.find((option) => option.value === value)?.label || value || 'Natural'
}
