/*
 * ============================================================
 * ESPECIFICAÇÃO — Gerar NSFW (Imagem) (/cliente/gerar-imagem)
 * Última revisão: 2026-04-16
 * Fonte: definição do produto (usuário)
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    Cliente gerar NSFW de imagem escolhendo modelo + atributos visuais por
 *    seleção de cards (sem prompt livre).
 *
 * 2) Usuário e pré-condições
 *    - Só com login.
 *    - A atriz só aparece para geração se o cliente tiver assinatura ativa dela.
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Entrada padrão do fluxo NSFW abre em Gerar Imagem.
 *    - No topo: dois botões para alternar entre “Gerar imagem” e “Gerar vídeo”.
 *    - Escolha de atriz por foto (lista das assinaturas ativas do cliente).
 *    - Montagem por seleção visual (cards): posição (incl. posições quentes),
 *      ambiente, acessório, roupa.
 *    - Prompt é montado automaticamente conforme escolhas e exibido em tela,
 *      mas não é editável manualmente.
 *    - Se nada além da atriz for marcado, geração usa combinação aleatória.
 *    - Para imagem: selecionar quantidade de imagens por geração (por ora: 1).
 *    - Painel lateral “Gerados”: progresso com porcentagem + tempo estimado;
 *      ao concluir, item aparece ali e dispara notificação de pronto.
 *
 * 4) Ações primárias e secundárias
 *    - Gerar, tentar novamente, alternar para vídeo.
 *    - Denunciar resultado defeituoso para análise do gestor/adm e pedido de
 *      crédito de volta (fluxo em §5 e §6).
 *
 * 5) Estados
 *    - Sem créditos suficientes: não permite gerar.
 *    - Em andamento: mostrar percentual + ETA em “Gerados”.
 *    - Erro de geração: ação de “tentar de novo”.
 *    - Resultado defeituoso: denunciar -> análise adm/gestor; se aprovado,
 *      devolve créditos e notifica cliente.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    - Custa créditos (valor exato ainda em aberto).
 *    - Conteúdo bloqueado por prompt de moderação específico.
 *    - Opções (ações, roupas etc.) mudam conforme sexo do modelo selecionado.
 *    - Resultado é privado.
 *    - Marca d’água já entra na geração.
 *
 * 7) Navegação (entrada / saída)
 *    - Rotas: `/cliente/gerar-imagem` e `/cliente/gerar-video`.
 *    - Entrada pelo BottomNav e pelo perfil da atriz.
 *    - Depois de gerar: item aparece em “Gerados” e vai automático para Galeria,
 *      no perfil da atriz, como gerado recentemente.
 *
 * 8) Analytics / eventos
 *    - Créditos gastos.
 *    - Quantidade de imagens geradas.
 *
 * 9) Fora de escopo nesta tela
 *    - Download.
 *    - Edição pós-geração avançada (upscale, remover fundo, etc.).
 *
 * 10) Abertos (TBD)
 *     - Valor de créditos por geração de imagem.
 *     - Recomendação de resolução/ratio: sugerido iniciar com 4:5 (padrão feed)
 *       e 1:1, expandindo depois por dados de uso.
 *     - Limite exato de histórico exibido em “Gerados” dentro da tela.
 *     - Fora de escopo adicional da fase 1 (item 30 não preenchido).
 *
 * --- Wireframe ASCII (resumo) ---
 * | [Gerar imagem] [Gerar vídeo] | atriz assinada | opções visuais | prompt auto |
 * |______________________________|________________|_________________|_____________|
 * | painel Gerados: % + ETA + concluídos | notificação quando pronto            |
 * ============================================================
 */

export { GerarImagem } from '@/features/cliente/nsfw/gerar-imagem/pages/GerarImagem'
