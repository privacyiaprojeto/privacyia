/*
 * ============================================================
 * ESPECIFICAÇÃO — Descobrir (/cliente/descobrir)
 * Última revisão: 2026-04-15
 * Fonte: definição do produto (usuário)
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    Cliente explorar atrizes em várias seções temáticas (aba Descobrir) e
 *    localizar por busca com histórico (aba Buscar). Layout de referência:
 *    screenshot de exemplo (carrosséis, grids variados, banner). “Ver mais” não
 *    existe nesta tela — só no Feed (ver spec do Feed).
 *
 * 2) Usuário e pré-condições
 *    Cliente autenticado (plataforma só com login — alinhar com Feed).
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - ClienteLayout envolvendo o conteúdo.
 *    - Topo: dois botões / abas — “Descobrir” e “Buscar”.
 *
 *    Aba Buscar:
 *    - Barra de busca.
 *    - Buscas recentes persistidas via API.
 *    - Primeira vez / sem histórico recente ainda: mostrar “Recomendados”.
 *    - Resultados ao pesquisar; se não houver resultado: mensagem de que não
 *      foi encontrado (texto simples).
 *    - Toque em uma busca recente: vai para o perfil da pessoa (não repete a
 *      busca na barra como ação principal).
 *
 *    Aba Descobrir:
 *    - Sem botão “Ver mais” nesta tela; no Feed é que existe “ver mais”
 *      (abre esta área — ver Feed). Aqui o Top 10 mostra do 1 ao 10 no
 *      próprio layout (não é atalho “ver mais” por seção).
 *    - Seções em sequência vertical; formatos variados conforme fluidez e
 *      referência visual (ex.: Top 10 em carrossel horizontal; uma seção tipo
 *      “mais curtidas” pode ser grid 2 linhas × 5 colunas com banner + ícone
 *      como no Feed; outras seções carrossel ou grid — o que ficar mais fluido).
 *    - Lista ordenada e nomes finais das seções: ver §10 (TBD) — item 8 ainda
 *      não preenchido pelo produto.
 *
 * 4) Ações primárias e secundárias
 *    - Alternar Descobrir / Buscar.
 *    - Buscar: digitar e ver resultados; toque em busca recente → perfil.
 *    - Cards / “ver perfil” onde existir: mesma regra de métrica do Feed
 *      (abrir página do perfil conta na métrica).
 *    - Não há menu “⋯” (silenciar / denunciar / ocultar) nos cards do Descobrir;
 *      isso existe no Feed nos posts, não aqui.
 *
 * 5) Estados
 *    - Loading e erro: padrão global da app.
 *    - Busca sem resultado: apenas informar que não foi encontrado.
 *    - Aba Buscar sem buscas recentes: mostrar Recomendados.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    Tudo visível sem créditos / sem pagar (igual Feed — só consumo/exploração).
 *
 * 7) Navegação (entrada / saída)
 *    - Rota: /cliente/descobrir. BottomNav.
 *    - O Feed pode abrir esta rota ao usar “ver mais” nos blocos entre
 *      postagens (ver Feed §7).
 *
 * 8) Analytics / eventos (se aplicável)
 *    Contagem de visitas ao perfil alinhada ao Feed: o evento é abrir a página
 *    do perfil da atriz; incluir caminhos vindos do Descobrir e do Feed.
 *
 * 9) Fora de escopo nesta tela
 *    Igual Feed: carteira/recarga profunda, admin, geração em tela própria;
 *    Descobrir pode linkar, não substituir essas áreas.
 *
 * 10) Abertos (TBD)
 *     - Lista ordenada e definitiva das seções na aba Descobrir (item 8 do
 *       questionário ainda não enviada pelo produto).
 *     - Detalhes de API para buscas recentes (limite de itens, paginação se
 *       houver) quando a API existir.
 *
 * --- Wireframe ASCII (só exemplo, | e _) ---
 * |  [ Descobrir ]     [ Buscar ]                                              |
 * |___________________________________________________________________________|
 * DESCOBRIR (scroll vertical; sem "Ver mais" global — só conteúdo 1–10, grids):
 * | [ banner / destaque ]                                                     |
 * | Top 1 … Top 10 (ex.: carrossel horizontal)                                  |
 * |___________________________________________________________________________|
 * | outras seções (formatos variados: grid 2×5, carrossel, …)                 |
 *
 * BUSCAR:
 * | ______________________  [ busca...  ] ______________________              |
 * | Recomendados (se sem recentes) OU  Buscas recentes (API)                  |
 * |___________________________________________________________________________|
 * | [ resultados ]   |   "não foi encontrado" se vazio                         |
 * ============================================================
 */

export { Descobrir } from '@/features/cliente/descobrir/pages/Descobrir'
