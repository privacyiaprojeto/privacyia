/*
 * ============================================================
 * ESPECIFICAÇÃO — Notificações (/cliente/notificacoes)
 * Última revisão: 2026-04-16 (destino dinâmico por payload, não URL fixa por atriz)
 * Fonte: produto (checklist + follow-up) + estado do código
 * ============================================================
 *
 * 1) Objetivo (negócio / usuário)
 *    Dois eixos complementares:
 *    - Marketing: avisar novo conteúdo, nova publicação, nova assinante, etc.
 *    - Sistema: avisar que foto ou vídeo em geração concluiu; créditos acabando ou
 *      baixos; outros avisos operacionais da plataforma.
 *    A lista in-app reúne tudo num só lugar (visual homogêneo na listagem).
 *
 * 2) Usuário e pré-condições
 *    Cliente autenticado. Sem login não há acesso ao app cliente (alinhar com Feed).
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Lista única (MKT + sistema misturados na mesma lista).
 *    - **Categorias (modelo de dados):** cada notificação pertence a uma **categoria**;
 *      cada categoria define **para onde navegar** ao toque (não pode ficar sem
 *      destino — ver seção 7).
 *    - **Preferências (ligar/desligar):** ícone de **engrenagem** na tela que abre
 *      um **modal** com opções para ativar/desativar notificações de marketing,
 *      de sistema ou ambas (detalhe dos toggles no mock e no design).
 *    Implementação atual no código: `ClienteLayout` + título “Notificações” (placeholder).
 *
 * 4) Ações primárias e secundárias
 *    - Toque num item: navega conforme a **categoria** → destino mapeado.
 *    - Marcar como lida: **automática ao clicar** no item (além da navegação).
 *    - Botão **“Ler tudo”**: marca todas como lidas; **desabilitado** quando a lista
 *      está vazia (não oculto).
 *    - Engrenagem → modal de preferências (ligar/desligar por tipo).
 *
 * 5) Estados
 *    - Lista vazia: copy fixa **“Nenhuma notificação”**.
 *    - Erro ao carregar: **copy padrão** de erro global do app (ex.: fluxo já
 *      previsto com `parseApiError` / mensagem genérica — alinhar na implementação).
 *    - Loading, offline: padrão global quando houver integração.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    - Retenção: notificações ficam disponíveis **uma semana**; depois saem da lista
 *      (mock + backend).
 *    - Toda notificação tem **categoria** e dados suficientes no **payload** (API)
 *      para montar o destino — ex.: `atrizId` quando for caso de atriz, ids de
 *      mídia/geração quando for Galeria. O destino **não** é uma “API fixa” por
 *      atriz: o endpoint de listagem pode ser único; o que varia é o conteúdo de
 *      cada item (qual atriz, qual geração, etc.).
 *
 * 7) Navegação (entrada / saída)
 *    - Rota da tela: `/cliente/notificacoes`.
 *    - Entrada: ícone de sino no `Header` e item “Notificações” na `Sidebar`.
 *    - Mobile: acesso **só pelo header** (sem `BottomNav`).
 *    - **Deep link ao tocar:** construído **dinamicamente** a partir da categoria +
 *      **payload** da notificação (não há uma única URL “fixa” para todos os casos
 *      de atriz — o `atrizId` [e outros ids] vêm no objeto retornado pela API).
 *      Exemplos de regra (produto + implementação):
 *      - Geração concluída: navegar para o contexto daquela geração na Galeria usando
 *        ids devolvidos no item (ex.: `atrizId`, `albumId` ou `mediaId` — contrato TBD).
 *      - Notificação ligada à atriz: mesma **forma de rota** sempre (molde), com
 *        **parâmetro** `atrizId` (ou slug) diferente conforme a notificação.
 *    - Implementar um resolver no front (ex.: `getNotificationDestination(n)`) que
 *      centraliza categoria + payload → `to` do React Router.
 *
 * 8) Analytics / eventos
 *    **Captação completa:** acesso à tela, leitura (item / “ler tudo”), abertura do
 *    modal da engrenagem, mudança de toggles — nomes de eventos na implementação.
 *
 * 9) API / persistência e MSW (ordem de trabalho)
 *    **Prioridade: mock (MSW + dados em memória) primeiro**; depois API real.
 *    **Endpoints** de listagem/patch podem ser estáveis (ex.: um `GET` que devolve
 *    a lista). Cada **elemento** da lista traz o que for preciso para o destino:
 *    `categoria`, `atrizId?`, `mediaId?`, … — não depende de “API diferente por
 *    atriz”, e sim de **campos variáveis** no JSON de cada notificação.
 *    MSW: simular `GET` com vários itens e ids distintos; o front resolve a rota.
 *    Proposta (validar após o mock): `GET/PATCH` notificações, `POST` marcar todas
 *    lidas, `GET/PATCH` preferências — alinhar com backend.
 *
 * 10) Fora de escopo nesta rota
 *     - Renderizar o conteúdo completo do Feed, Galeria ou perfil da atriz: só
 *       **navega** para o destino.
 *     - Canais fora do app (push nativo, e-mail, SMS) — onde o produto definir.
 *     - Painéis `atriz` e `adm`.
 *
 * 11) Lacunas úteis para fechar na implementação
 *     - **Tabela categoria → molde de rota + campos obrigatórios no payload** (ex.:
 *       categoria X exige `atrizId`; categoria Y exige `mediaId` + `atrizId`).
 *     - **Contrato JSON** por tipo de notificação (quais ids o backend envia).
 *     - **Molde** de URL para perfil de atriz (ex.: `/cliente/.../:atrizId`) — um
 *       padrão só; o valor do `:atrizId` muda por item.
 *     - Badge no sino; tempo real (polling vs WebSocket).
 *
 * --- Wireframe ASCII (conceitual) ---
 * |  Notificações                    [ engrenagem ]            [ Ler tudo ]      |
 * |___________________________________________________________________________|
 * |  (lista; cada linha tem categoria interna → destino ao toque)                 |
 * |  (vazio) Nenhuma notificação          [ Ler tudo desabilitado ]                |
 * |  Modal engrenagem: [ ] Marketing   [ ] Sistema   (ou ambos / granular — UI)    |
 * ============================================================
 *
 * --- Checklist (respostas do produto) ---
 *  1. MKT + sistema; lista unificada.
 *  2. Preferências: engrenagem → modal com ligar/desligar (MKT / sistema / ambos).
 *  3. Cada notificação tem categoria; cada categoria leva a um lugar.
 *  4. Geração pronta → contexto na Galeria; atriz → perfil com **atrizId** (e demais
 *     ids) vindos do payload — destino dinâmico, não API fixa por atriz.
 *  5. Erro: copy padrão global.
 *  6. “Ler tudo” desabilitado com lista vazia.
 *  (demais itens anteriores: mobile só header; analytics completo; mock primeiro;
 *  retenção 1 semana.)
 * ============================================================
 */

export { Notificacoes } from '@/features/cliente/notificacoes/pages/Notificacoes'
