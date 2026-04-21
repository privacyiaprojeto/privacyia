/*
 * ============================================================
 * ESPECIFICAÇÃO — Perfil do cliente (/cliente/perfil)
 * Última revisão: 2026-04-16 (seções 10–11 e checklist completos)
 * Fonte: produto (checklist) + estado do código
 * ============================================================
 * Escopo desta rota: perfil do usuário com role `cliente` (conta própria).
 * Não confundir com o perfil de atriz (ex.: painel no chat, `/atrizes/:id/perfil`).
 *
 * 1) Objetivo (negócio / usuário)
 *    Tela-hub de perfil: atalhos (botões) para outras áreas (carteira, galeria,
 *    dados pessoais, métodos de pagamento, histórico, sair, etc.) + exibir o nome
 *    do cliente + bloco estilo “Saiba mais” / prompt onde a IA pode preencher e o
 *    cliente pode editar preferências de tom (ex.: mais agressivo, mais tranquilo,
 *    jeito de falar).
 *
 * 2) Usuário e pré-condições
 *    Cliente autenticado. Sessão atual (`User` em `shared/types/user.ts`) ainda não
 *    inclui CPF — alinhar tipo/API quando a verificação de ID na criação de conta
 *    existir. CPF fica somente leitura e vinculado à verificação na conta.
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Nome do cliente.
 *    - Ícone de perfil (sem foto de usuário — só ícone).
 *    - Área de prompt / “como me conhecer” editável por IA e pelo cliente.
 *    - Vários botões de navegação para destinos (carteira, galeria, dados pessoais,
 *      métodos de pagamento, histórico, sair, …).
 *    Implementação atual no código: `ClienteLayout` + título “Perfil” (placeholder).
 *
 * 4) Ações primárias e secundárias
 *    - Navegar via botões para cada área; “Dados pessoais” concentra edição de
 *      nome, e-mail, senha (CPF não editável).
 *    - Alteração de e-mail e senha: em modal (não rota dedicada).
 *    - Preferências (idioma, notificações, privacidade, etc.): a partir desta tela
 *      há um botão que leva a uma tela só para isso.
 *    - Logout e links legais (termos, privacidade): nesta tela de perfil (não só
 *      na sidebar).
 *
 * 5) Estados
 *    Loading/erro quando houver persistência remota do prompt e dados — padrão
 *    global a definir na implementação.
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    Em “Dados pessoais”: e-mail, senha e nome editáveis; CPF somente leitura
 *    (vínculo com verificação de identidade na criação da conta). Schemas Zod e
 *    contrato de API quando implementados.
 *
 * 7) Navegação (entrada / saída)
 *    - Rota: `/cliente/perfil`.
 *    - Entrada: ícone de usuário no `Header` e item “Perfil” na `Sidebar`.
 *    - Mobile: acesso ao perfil só pelo header (sem item na `BottomNav` — alinhado
 *      à decisão de produto).
 *
 * 8) Analytics / eventos
 *    Sem captação de analytics nesta área.
 *
 * 9) API / persistência e MSW (item 8 — proposta para alinhar com o backend)
 *    Ideia: um recurso “perfil do cliente autenticado” + credenciais no namespace
 *    `auth`, no mesmo estilo de `/chat/...` e `/auth/login`.
 *
 *    Proposta (ajustar com o backend antes de implementar):
 *    - `GET /cliente/perfil` — leitura completa para a UI: nome, e-mail, CPF
 *      (somente leitura), texto do prompt de tom (“Saiba mais”), e o que mais for
 *      necessário. O JWT identifica o usuário; não precisa `id` na URL.
 *    - `PATCH /cliente/perfil` — atualização parcial (JSON merge): nome, e-mail
 *      (se o fluxo for direto; se houver confirmação por link, o contrato muda),
 *      prompt de tom. Campos imutáveis (ex.: CPF) o backend ignora ou responde 422.
 *    - `POST /auth/change-password` — corpo com senha atual + nova (modal de senha).
 *      Alternativa comum: mesmo endpoint com nomes que o backend já usar.
 *    - Preferências em tela separada: `GET/PATCH /cliente/preferencias` (ou
 *      `/cliente/perfil/preferencias`) quando existir — evita um PATCH gigante no
 *      perfil se o payload crescer.
 *
 *    MSW em dev: espelhar esses paths em `mocks/handlers/` (ex.: `cliente.ts` ou
 *    `perfil.ts`), com dados em `mocks/data/` se precisar de estado mutável, como
 *    no chat.
 *
 * 10) Fora de escopo nesta rota
 *     Esta rota é hub de atalhos e dados resumidos do cliente; não substitui as
 *     áreas abaixo (apenas pode linkar para elas).
 *     - Perfil, conteúdo e métricas da atriz (`/atrizes/:id/perfil`, Feed, Descobrir,
 *       posts) — domínio da atriz/conteúdo, não da conta cliente nesta URL.
 *     - Chat e mensagens (`/cliente/chat`) — thread, lista de conversas, painel da
 *       atriz.
 *     - Geração NSFW (`/cliente/gerar-imagem`, `/cliente/gerar-video`) — fluxo de
 *       geração em si.
 *     - Experiência principal da Galeria (álbum, gerados, salvos) — `/cliente/galeria`;
 *       o perfil só encaminha.
 *     - Operações profundas de créditos: compra, extrato detalhado, métodos de
 *       pagamento ativos, histórico financeiro completo — concentrar na Carteira
 *       (`/cliente/carteira`) e rotas alinhadas a ela; evitar duplicar a mesma UI
 *       aqui (só botão de atalho).
 *     - Painéis de outros papéis: `/atriz`, `/adm`.
 *     - Conteúdo “de verdade” das preferências (idioma, notificações, etc.) fica na
 *       tela dedicada; esta rota só o botão de entrada.
 *
 * 11) Lacunas úteis para fechar na implementação (ainda não decididas)
 *     - Rotas React (define `router.tsx` e `Link`s dos botões):
 *       sub-rotas (`/cliente/perfil/dados`, `/cliente/perfil/preferencias`, …) vs
 *       prefixo paralelo (`/cliente/dados-pessoais`, …) vs modais só para parte do
 *       fluxo — decidir antes de implementar navegação profunda.
 *     - Troca de e-mail: `PATCH` imediato no perfil vs fluxo com confirmação por link
 *       no e-mail — depende do backend; muda modal, toasts e estados de “pendente”.
 *     - CPF na interface: mostrar número completo vs mascarado (ex.: ***.***.*-**)
 *       vs apenas selo “verificado” — impacto em privacidade, LGPD e clareza para o
 *       usuário.
 *     - Prompt “Saiba mais” vazio: copy de placeholder, texto de ajuda e limite
 *       máximo de caracteres (e se contagem aparece ao digitar) — decisão de
 *       produto/copy.
 *     - Termos de uso e política de privacidade: rotas internas (`/legal/...`),
 *       páginas estáticas no app ou URLs externas; abrir na mesma aba ou nova.
 *     - Histórico de compras e métodos de pagamento: se virarem rotas novas, alinhar
 *       nomenclatura e responsabilidade com Carteira/backend para não ter duas
 *       telas com o mesmo propósito.
 *
 * --- Wireframe ASCII (conceitual) ---
 * |  [ ícone ]  Nome do cliente                                                |
 * |  “Saiba mais” / prompt (IA + usuário)  [ editar ]                          |
 * |  [ Carteira ] [ Galeria ] [ Dados pessoais ] [ Pagamento ] [ Histórico ] … |
 * |  [ Preferências → ]   Termos | Privacidade   [ Sair ]                      |
 * ============================================================
 *
 * --- Checklist (respostas do produto) ---
 *  1. Hub de perfil + nome + bloco prompt (tom/comportamento); botões para
 *     carteira, galeria, dados pessoais, pagamento, histórico, sair, etc.
 *  2. Dados pessoais: nome, e-mail, senha editáveis; CPF só leitura (verificação ID).
 *  3. Ícone sim; sem foto de perfil.
 *  4. E-mail e senha: modal.
 *  5. Preferências: botão nesta tela → tela dedicada só para isso.
 *  6. Logout e links legais: nesta tela de perfil.
 *  7. Mobile: só pelo header.
 *  8. Proposta na seção 9 (`GET/PATCH /cliente/perfil`, senha em `/auth/...`,
 *     MSW espelhando — validar com backend).
 *  9. Sem captação de analytics.
 * 10. Ver seção 10 — fora de escopo explícito (hub vs outras áreas do app).
 * ============================================================
 */

export { Perfil } from '@/features/cliente/perfil/pages/Perfil'
