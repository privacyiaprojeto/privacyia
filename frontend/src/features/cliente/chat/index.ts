/*
 * ============================================================
 * ESPECIFICAÇÃO — Chat (/cliente/chat, /cliente/chat/:id)
 * Última revisão: 2026-04-15
 * Fonte: estado do código + pendências com produto
 * ============================================================
 * 1) Objetivo (negócio / usuário)
 *    A definir com o produto (uma frase: ex. retenção, conversa paga por crédito,
 *    mensagens ilimitadas com assinatura…).
 *
 * 2) Usuário e pré-condições
 *    Cliente autenticado (plataforma só com login — alinhar com Feed / Galeria).
 *
 * 3) Conteúdo e seções (UI — implementado hoje)
 *    - Rota única de página: `ChatPage` para `/cliente/chat` e `/cliente/chat/:id`.
 *    - Layout em três zonas no desktop (md+): lista de conversas (esquerda) |
 *      thread de mensagens (centro) | painel de perfil da atriz (`AtrizProfilePanel`,
 *      direita). Mobile: lista OU thread; seta voltar no thread; painel direito
 *      conforme implementação responsiva do painel.
 *    - Lista: `ConversationCard` por conversa; skeleton ao carregar; vazio
 *      “Nenhuma conversa”.
 *    - Sem `id` na URL e com conversas: redireciona para a primeira conversa.
 *    - Thread: sub-header com avatar, nome, online/offline, menu “⋯” com ação
 *      “Resetar chat”; bolhas `MessageBubble`; `ChatInput` no rodapé; scroll ao
 *      fim ao receber mensagens.
 *    - Arquivos legados na pasta (não usados no router atual): `Chat.tsx`,
 *      `ChatDetail.tsx`, `Mensagens.tsx` — confirmar se serão removidos ou
 *      reaproveitados.
 *
 * 4) Ações primárias e secundárias
 *    - Enviar mensagem de texto (implementado).
 *    - Abrir conversa; voltar (mobile).
 *    - Menu: “Resetar chat” (comportamento de negócio/API a definir).
 *    - Painel da atriz: ver `AtrizProfilePanel` (detalhe na spec quando fechada).
 *
 * 5) Estados
 *    - Loading conversas / mensagens / envio: implementado (skeleton, spinner,
 *      disabled no input).
 *    - Sem conversa selecionada (desktop): placeholder “Selecione uma conversa”.
 *    - Erros de API: tratamento global de hook/query — detalhar com produto se
 *      houver toast específico no chat.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    A definir (ex.: custo por mensagem, bloqueio sem assinatura, mídia no chat,
 *    moderação).
 *
 * 7) Navegação (entrada / saída)
 *    - BottomNav: item “Chat” → `/cliente/chat`.
 *    - Links externos para conversa específica: `/cliente/chat/:id`.
 *
 * 8) Analytics / eventos (se aplicável)
 *    A definir (ex.: envio, abrir conversa, reset).
 *
 * 9) Fora de escopo nesta tela
 *    A definir ou alinhar com Galeria/Feed (carteira profunda, admin, etc.).
 *
 * 10) Abertos (TBD)
 *     - Objetivo de negócio e regras de cobrança / limite de mensagens.
 *     - Significado exato de “Resetar chat” e impacto no backend.
 *     - Anexos, áudio, imagem, pagamento dentro do chat (se aplicável).
 *
 * --- Wireframe ASCII (só exemplo, | e _) ---
 * Desktop (md+):
 * | LISTA      | THREAD                          | PERFIL ATriz (painel)        |
 * | conversas  | nome | online    ...            | AtrizProfilePanel            |
 * |____________|_________________________________|______________________________|
 * |            | mensagens...                    |                              |
 * |            | [ input                       ] |                              |
 *
 * Mobile: lista OU thread com <- voltar
 * ============================================================
 */

export { ChatPage } from '@/features/cliente/chat/pages/ChatPage'
