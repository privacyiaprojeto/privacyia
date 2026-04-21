/*
 * ============================================================
 * ESPECIFICAÇÃO — Gerar NSFW (Vídeo) (/cliente/gerar-video)
 * Última revisão: 2026-04-16
 * Fonte: definição do produto (usuário)
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    Cliente gerar NSFW de vídeo com fluxo equivalente ao de imagem, com campos
 *    específicos de vídeo.
 *
 * 2) Usuário e pré-condições
 *    - Só com login.
 *    - A atriz só aparece para geração se assinatura ativa.
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Topo com alternância “Gerar imagem” / “Gerar vídeo” (esta aba ativa).
 *    - Escolha de atriz por foto (assinaturas ativas).
 *    - Montagem por seleção visual para vídeo:
 *      ação + roupa + localização.
 *    - Prompt auto (não editável manualmente).
 *    - Se nada além da atriz for marcado, geração usa combinação aleatória.
 *    - Entrada de geração: imagem base.
 *    - Saída padrão: vídeo de 5 segundos, sem áudio, com autoplay na prévia.
 *    - Painel “Gerados”: % + ETA e resultado final; notificação ao concluir.
 *
 * 4) Ações primárias e secundárias
 *    - Gerar, tentar novamente, alternar para imagem.
 *    - Denunciar vídeo defeituoso/corrompido para análise adm/gestor.
 *
 * 5) Estados
 *    - Sem créditos suficientes: bloqueia geração.
 *    - Em andamento: exibe percentual + ETA.
 *    - Erro: “tentar novamente”.
 *    - Corrompido/defeituoso: denúncia -> adm avalia; se confirmado, devolve
 *      créditos, remove erro e notifica cliente.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    - Custa créditos (valor ainda em aberto para vídeo).
 *    - Duração fixa atual: 5s.
 *    - Sem áudio.
 *    - Opções variam conforme sexo do modelo.
 *    - Bloqueio por prompt de moderação específico.
 *    - Privado.
 *    - Marca d’água na geração.
 *
 * 7) Navegação (entrada / saída)
 *    - Rotas: `/cliente/gerar-imagem` e `/cliente/gerar-video`.
 *    - Entrada pelo BottomNav e perfil da atriz.
 *    - Concluído: vai para “Gerados” e para Galeria da atriz automaticamente.
 *
 * 8) Analytics / eventos
 *    - Créditos gastos.
 *    - Quantidade de vídeos gerados.
 *
 * 9) Fora de escopo nesta tela
 *    - Download.
 *    - Qualidade múltipla (SD/HD) por enquanto.
 *
 * 10) Abertos (TBD)
 *     - Custo em créditos por vídeo (item 21/24 ainda sem definição de custo).
 *     - Faixas de qualidade/resolução para vídeo (item 24 em aberto).
 *     - Limite exato de histórico em “Gerados” dentro da tela.
 *     - Fora de escopo adicional da fase 1 (item 30 não preenchido).
 *
 * --- Wireframe ASCII (resumo) ---
 * | [Gerar imagem] [Gerar vídeo] | atriz assinada | ação/roupa/local | prompt |
 * |______________________________|________________|___________________|_______|
 * | Gerados: % + ETA + autoplay | notificação pronto | envio auto Galeria      |
 * ============================================================
 */

export { GerarVideo } from '@/features/cliente/nsfw/gerar-video/pages/GerarVideo'
