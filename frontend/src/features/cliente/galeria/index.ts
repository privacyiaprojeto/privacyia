/*
 * ============================================================
 * ESPECIFICAÇÃO — Galeria (/cliente/galeria)
 * Última revisão: 2026-04-15
 * Fonte: definição do produto (usuário)
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    Centralizar fotos e vídeos gerados com as atrizes. Com assinatura da
 *    atriz, o cliente vê uma foto dela na listagem; ao tocar, abre a área do
 *    perfil da atriz onde ficam o álbum (tudo o que foi gerado + itens salvos,
 *    ver §7). Inclui também “comprar álbum” (pacote de fotos/vídeos prontos por
 *    créditos) — após compra, o conteúdo fica disponível na galeria.
 *
 * 2) Usuário e pré-condições
 *    Só acessa com login. Sem login não entra na galeria.
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Origens das mídias na galeria: Gerar imagem, Gerar vídeo, live action,
 *      live audio, compra de álbum, e posts do feed que o cliente salvar (ver
 *      spec do Feed — botão salvar).
 *    - Tipos: fotos, vídeos, live action, live audio; álbum comprado = várias
 *      fotos/vídeos já prontos (custo em créditos).
 *    - Organização: por atriz (lista/cards por criadora).
 *    - Ordenação: mais recentes primeiro + campo de busca (filtrar atriz ou
 *      termo — detalhe de implementação alinhado ao backend).
 *    - Grid: 4 colunas no desktop, 2 no mobile.
 *    - Marca d’água obrigatória em cada foto e vídeo exibidos na galeria.
 *    - Enquanto a assinatura da atriz estiver ativa, o cliente vê o conteúdo
 *      normalmente; se a assinatura não estiver ativa, fotos e vídeos aparecem
 *      borrados.
 *    - Sem limite de quantidade/armazenamento documentado (não há teto definido).
 *
 * 4) Ações primárias e secundárias
 *    - Visualização: o foco é apenas ver mídias (sem download na spec).
 *    - Em cada imagem/vídeo: menu “⋯” para denunciar se o conteúdo vier errado.
 *    - Toque na atriz (card): abre no perfil da atriz a zona de álbum com todas
 *      as fotos e vídeos gerados e os salvos, por ordem de chegada.
 *
 * 5) Estados
 *    Loading e erro: padrão global da app. Tratamento de falhas pontuais (ex. ao
 *    denunciar): critério de UX/implementação.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    Acesso só logado (§2). Visibilidade nítida vs. borrado conforme assinatura
 *    ativa da atriz (§3). Download não previsto na spec.
 *
 * 7) Navegação (entrada / saída)
 *    - Rota: /cliente/galeria.
 *    - BottomNav: item “Galeria”.
 *    - Perfil da atriz: entrada alternativa para a mesma lógica de álbum
 *      (conteúdo agregado da atriz).
 *    - Ao escolher uma atriz na galeria, abre-se a parte do perfil onde está o
 *      álbum: todas as fotos/vídeos gerados e os salvos, ordenados por ordem de
 *      chegada.
 *
 * 8) Analytics / eventos (se aplicável)
 *    Sem métrica de download. Medir, por atriz: quantidade de mídias geradas,
 *    quantidade de salvos (ex.: posts do feed salvos na galeria), e quantidade
 *    de compras de álbum.
 *
 * 9) Fora de escopo nesta tela
 *    Escopo funcional desta definição: galeria do cliente e fluxo de álbum
 *    comprado; não misturar com outras áreas (ex.: gestão profunda de carteira
 *    fora do que for necessário para créditos do álbum, telas de admin/atriz).
 *
 * 10) Abertos (TBD)
 *     - Detalhe de busca (campos indexados, debounce) quando houver API.
 *     - Textos exatos de denúncia e fluxo moderado.
 *
 * --- Wireframe ASCII (só exemplo, | e _) ---
 * |  Galeria                                              [ buscar... ]         |
 * |___________________________________________________________________________|
 * | [ foto atriz A ] [ foto atriz B ] [ foto atriz C ] [ foto atriz D ]  (4 col) |
 * | [   ]            [   ]            ...                                         |
 * | (mobile: 2 colunas)                                                          |
 * | toque na atriz -> perfil: [ álbum: gerados + salvos por ordem de chegada ]   |
 * | cada tile: ⋯ denunciar; mídia com marca d'água; borrado se sem assinatura    |
 * ============================================================
 */

export { Galeria } from '@/features/cliente/galeria/pages/Galeria'
