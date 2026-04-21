import type { TipoOpcaoImagem, OpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'
import type { TipoOpcaoVideo, OpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

export function buildPromptImagem(
  atrizNome: string,
  selecionadas: Record<TipoOpcaoImagem, string | null>,
  opcoes: OpcaoImagem[],
): string {
  const get = (cat: TipoOpcaoImagem) => {
    const id = selecionadas[cat]
    return id ? (opcoes.find((o) => o.id === id && o.categoria === cat)?.label ?? null) : null
  }

  const partes: string[] = []
  const posicao = get('posicao')
  const ambiente = get('ambiente')
  const acessorio = get('acessorio')
  const roupa = get('roupa')

  if (posicao) partes.push(`posição: ${posicao}`)
  if (ambiente) partes.push(`ambiente: ${ambiente}`)
  if (acessorio) partes.push(`acessório: ${acessorio}`)
  if (roupa) partes.push(`roupa: ${roupa}`)

  if (partes.length === 0) return `${atrizNome} — combinação aleatória`
  return `${atrizNome}, ${partes.join(', ')}`
}

export function buildPromptVideo(
  atrizNome: string,
  selecionadas: Record<TipoOpcaoVideo, string | null>,
  opcoes: OpcaoVideo[],
): string {
  const get = (cat: TipoOpcaoVideo) => {
    const id = selecionadas[cat]
    return id ? (opcoes.find((o) => o.id === id && o.categoria === cat)?.label ?? null) : null
  }

  const partes: string[] = []
  const acao = get('acao')
  const roupa = get('roupa')
  const localizacao = get('localizacao')

  if (acao) partes.push(`ação: ${acao}`)
  if (roupa) partes.push(`roupa: ${roupa}`)
  if (localizacao) partes.push(`local: ${localizacao}`)

  if (partes.length === 0) return `${atrizNome} — combinação aleatória`
  return `${atrizNome}, ${partes.join(', ')}, vídeo 5s`
}
