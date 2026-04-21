/*
 * ============================================================
 * ESPECIFICAÇÃO — Feed (/cliente/feed)
 * Última revisão: 2026-04-15
 * Fonte: definição do produto (usuário)
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    O cliente conhecer novas atrizes (descoberta / exposição a perfis que ainda
 *    não domina). Formato: feed no estilo Instagram, com rolagem vertical de
 *    fotos e vídeos das atrizes.
 *
 * 2) Usuário e pré-condições
 *    Cliente tem de estar autenticado; sem login não há acesso à plataforma.
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Layout geral: coluna central com o feed; à direita, coluna “Sugestões”
 *      (banner + ícone + nome). Em telas estreitas a coluna da direita some.
 *    - Mídia do post: proporção igual ao feed do Instagram (~4:5 retrato).
 *    - Cada postagem (ordem vertical):
 *      a) Cabeçalho: ícone da atriz + nome do perfil à esquerda; à direita,
 *         três pontinhos (menu).
 *      b) Faixa “banner”: metade da área do feed, com banner da atriz + ícone
 *         + nome.
 *      c) Mídia principal: foto ou vídeo da atriz (proporção Instagram).
 *      d) Linha de ações: atalho ao perfil antes de curtida e comentário; depois
 *         curtida; depois comentário; botão novo para salvar o post na Galeria
 *         (o post passa a ficar disponível na galeria daquela atriz — ver spec
 *         cliente/galeria).
 *    - Entre postagens — carrossel de 5 containers na horizontal: 4 com foto
 *      da atriz e o 5º com “ver mais” (não é clique no perfil).
 *    - Bloco tipo “Top 10”: mostrar posição no formato Top1, Top2, … junto com
 *      o nome da atriz.
 *
 * --- Wireframe ASCII (só exemplo, | e _) ---
 * Desktop — feed central | coluna sugestões à direita (some em mobile):
 * __________________________________________________________________________________
 * |  FEED (coluna central)                               |  SUGESTÕES (direita)  |
 * |______________________________________________________|_______________________|
 * |  ( ) Nome da atriz                         ...         |  +-------+            |
 * |  ____________________________________________________   |  |banner |           |
 * |  | banner + (icon) + nome  (faixa ~ metade área)   |   |  | + (o)  | nome      |
 * |  |___________________________________________________|   |  +-------+            |
 * |  ____________________________________________________   |  ... mais cards     |
 * |  |                                                   |   |                       |
 * |  |      foto ou vídeo (proporção tipo Instagram)     |   |                       |
 * |  |                                                   |   |                       |
 * |  |___________________________________________________|   |                       |
 * |  [ ir perfil ]   curtir   comentar   [ salvar galeria ]  |                       |
 * |_________________________________________________________________________________|
 * |  ___   ___   ___   ___    ________                    |                       |
 * | |   | |   | |   | |   |  |ver mais| -> Descobrir     |                       |
 * | |___| |___| |___| |___|  |________|  (4 fotos + 5º)  |                       |
 * |_________________________________________________________________________________|
 * | Top1 Nome____   Top2 Nome____   ...  (clique no card -> perfil)                 |
 * |_________________________________________________________________________________|
 * |  ... próximo post (mesma coluna central) ...                                      |
 *
 * Pilha de UM post (de cima para baixo):
 * |  ( ) Nome da atriz                                          ... |
 * |  _____________________________________________________________ |
 * |  | banner + (icon) + nome (faixa ~ metade área do feed)      |
 * |  _____________________________________________________________ |
 * |  |                                                           |
 * |  |              foto ou vídeo (igual Insta)                  |
 * |  |                                                           |
 * |  _____________________________________________________________ |
 * |  [ perfil ]    curtir    comentário   [ salvar galeria ]        |
 *
 * Mobile — coluna direita some; só miolo:
 * _____________________________________
 * |  FEED (largura cheia)               |
 * |_____________________________________|
 * |  ( ) Nome                    ...    |
 * |  _________________________________  |
 * |  | banner + (icon) + nome         | |
 * |  _________________________________  |
 * |  |        foto / vídeo            | |
 * |  _________________________________  |
 * |  [ perfil ]  curtir  comentar  [ salvar galeria ] |
 * |_____________________________________|
 * | ___ ___ ___ ___  _______            |
 * | Top1 Nome   Top2 Nome  ...           |
 *
 * 4) Ações primárias e secundárias
 *    - Ir ao perfil da atriz: toques no fluxo normal do post (cabeçalho, atalho,
 *      banner/mídia conforme já definido), exceto onde indicado abaixo.
 *    - Curtir, comentar.
 *    - Salvar post na Galeria (novo botão): envia o post para a galeria do
 *      cliente vinculado à atriz (consumo na tela Galeria / perfil).
 *    - Menu “⋯” do post: silenciar atriz, denunciar, ocultar.
 *    - Sugestões na coluna direita (desktop): levar ao perfil ao interagir com
 *      o card, salvo regra global da app.
 *
 * 5) Estados
 *    - Loading / vazio / erro de rede: padrão global da app.
 *    - Quando o cliente chegar ao fim de todos os posts, o feed recomeça em
 *      loop (não “acaba” o feed — repete o ciclo).
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    O cliente pode ver este feed mesmo sem créditos e sem pagar nada — acesso
 *    ao consumo do feed (ver) não depende de saldo.
 *
 * 7) Navegação (entrada / saída)
 *    Regra geral: interação leva ao perfil da atriz.
 *    Exceção: o botão “ver mais” nos blocos entre postagens (carrossel 4+1,
 *      etc.) não abre o perfil — abre a tela Descobrir (/cliente/descobrir).
 *    Dentro dos blocos entre posts (ex.: Top), clique no card/perfil da atriz
 *    segue indo ao perfil.
 *
 * 8) Analytics / eventos (se aplicável)
 *    Métrica de “foi ao perfil”: contar quando abre a página do perfil da atriz.
 *    Incluir acessos vindos do feed e vindos do Descobrir (mesma definição de
 *    evento nos dois fluxos).
 *    Salvos na Galeria: alimentam a métrica de “salvos” por atriz (ver spec
 *    cliente/galeria).
 *
 * 9) Fora de escopo nesta tela (sugestão documentada — ajuste se quiser)
 *    Gestão de carteira/recarga em profundidade, preferências globais da conta,
 *    painel de atriz/admin, fluxos só de criação (gerar imagem/vídeo como tela
 *    própria), e moderação backoffice. O feed pode linkar para essas áreas, mas
 *    não as implementa aqui.
 *
 * 10) Abertos (TBD)
 *     - (Resolvido) “Ver mais” entre postagens → abre Descobrir.
 *     - (Resolvido) Estados → padrão global; feed em loop ao fim da lista (§5).
 *
 * --- Nota (layout do post) ---
 * - Cabeçalho + banner com ícone/nome: mantém como em §3.
 * ============================================================
 */

export { Feed } from '@/features/cliente/feed/pages/Feed'
