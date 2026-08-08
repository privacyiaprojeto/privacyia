import type { TipoOpcaoImagem, OpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'
import type { TipoOpcaoVideo, OpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

const LABELS_IMAGEM: Record<string, string> = {
  posicao: 'posição',
  ambiente: 'ambiente',
  acessorio: 'acessório',
  roupa: 'roupa',
}

const LABELS_VIDEO: Record<string, string> = {
  acao: 'ação',
  roupa: 'roupa',
  localizacao: 'local',
}

function getCategoriaLabel(opcao: { categoria: string; categoriaLabel?: string; titleName?: string }, labels: Record<string, string>) {
  return opcao.categoriaLabel || opcao.titleName || labels[opcao.categoria] || opcao.categoria
}

function buildPartes<T extends { id: string; label: string; categoria: string; categoriaLabel?: string; titleName?: string }>(
  selecionadas: Record<string, string | null>,
  opcoes: T[],
  labels: Record<string, string>,
) {
  return Object.entries(selecionadas)
    .map(([categoria, id]) => {
      if (!id) return null
      const opcao = opcoes.find((item) => item.id === id && item.categoria === categoria)
      if (!opcao) return null
      return `${getCategoriaLabel(opcao, labels)}: ${opcao.label}`
    })
    .filter(Boolean) as string[]
}

export function buildPromptImagem(
  atrizNome: string,
  selecionadas: Record<TipoOpcaoImagem, string | null>,
  opcoes: OpcaoImagem[],
): string {
  const partes = buildPartes(selecionadas, opcoes, LABELS_IMAGEM)

  if (partes.length === 0) return `${atrizNome} — combinação aleatória`
  return `${atrizNome}, ${partes.join(', ')}`
}

export function buildPromptVideo(
  atrizNome: string,
  selecionadas: Record<TipoOpcaoVideo, string | null>,
  opcoes: OpcaoVideo[],
): string {
  const partes = buildPartes(selecionadas, opcoes, LABELS_VIDEO)

  if (partes.length === 0) return `${atrizNome} — combinação aleatória`
  return `${atrizNome}, ${partes.join(', ')}, vídeo 5s`
}
