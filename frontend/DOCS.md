# Privacy IA â€” DocumentaÃ§Ã£o Frontend

> Arquivo mantido automaticamente. Atualizado sempre que uma rota, feature, hook, funÃ§Ã£o, tipo ou utilitÃ¡rio Ã© criado ou modificado.

---

## Rotas

| Path | PÃ¡gina | Feature |
|---|---|---|
| `/` | `Home` | `landing` |
| `/sign-in` | `SignIn` | `auth` |
| `/forgot-password` | `ForgotPassword` | `auth` |
| `/sign-up` | `SignUp` | `auth` |
| `/cliente` | `ClienteDashboard` (redirect â†’ `/cliente/feed`) | `cliente` |
| `/cliente/feed` | `Feed` | `cliente/feed` |
| `/cliente/descobrir` | `Descobrir` | `cliente/descobrir` |
| `/cliente/notificacoes` | `Notificacoes` | `cliente/notificacoes` |
| `/cliente/chat` | `ChatPage` | `cliente/chat` |
| `/cliente/chat/:id` | `ChatPage` | `cliente/chat` |
| `/cliente/galeria` | `Galeria` | `cliente/galeria` |
| `/cliente/gerar-imagem` | `GerarImagem` | `cliente/nsfw/gerar-imagem` |
| `/cliente/gerar-video` | `GerarVideo` | `cliente/nsfw/gerar-video` |
| `/cliente/carteira` | `Carteira` | `cliente/carteira` |
| `/cliente/perfil` | `Perfil` | `cliente/perfil` |
| `/cliente/atriz/:id` | `AtrizPerfilPage` | `cliente/atriz-perfil` |
| `/atriz` | `AtrizDashboard` | `atriz` |
| `/adm` | `AdmDashboard` | `adm` |

---

## Features

### `landing`
PÃ¡gina inicial pÃºblica da aplicaÃ§Ã£o.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/Home.tsx` | Landing page com tÃ­tulo, tagline e botÃµes de acesso |

---

### `auth`
ResponsÃ¡vel por autenticaÃ§Ã£o do usuÃ¡rio.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/SignIn.tsx` | PÃ¡gina de login â€” renderiza o `LoginForm` + credenciais de teste |
| `pages/ForgotPassword.tsx` | RecuperaÃ§Ã£o de senha â€” exibe mensagem de manutenÃ§Ã£o ao enviar |
| `pages/SignUp.tsx` | Cadastro de nova conta |

**Componentes**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `components/LoginForm.tsx` | FormulÃ¡rio de login com validaÃ§Ã£o via RHF + Zod, toggle de visibilidade de senha |
| `components/SignUpForm.tsx` | FormulÃ¡rio de cadastro com feedback visual dos requisitos de senha |

**Hooks**
| Arquivo | Assinatura | DescriÃ§Ã£o |
|---|---|---|
| `hooks/useLogin.ts` | `useLogin()` | `useMutation` â†’ `POST /auth/login`, salva na `useAuthStore`, redireciona para `/cliente/feed`, `/atriz` ou `/adm` conforme role |
| `hooks/useSignUp.ts` | `useSignUp()` | `useMutation` â†’ `POST /auth/sign-up`, salva na `useAuthStore`, redireciona para `/cliente/feed` |

**API**
| Arquivo | FunÃ§Ã£o | MÃ©todo | Endpoint |
|---|---|---|---|
| `api/login.ts` | `login(data: LoginInput)` | `POST` | `/auth/login` |
| `api/signUp.ts` | `signUp(data: SignUpInput)` | `POST` | `/auth/sign-up` |

**Tipos / Schemas**
| Nome | Tipo | DescriÃ§Ã£o |
|---|---|---|
| `loginSchema` | `ZodObject` | Schema de validaÃ§Ã£o do formulÃ¡rio de login |
| `LoginInput` | `type` | Inferido do `loginSchema` â€” `{ email, password }` |
| `LoginResponse` | `interface` | `{ token, user: User }` |
| `signUpSchema` | `ZodObject` | Schema de validaÃ§Ã£o do formulÃ¡rio de cadastro |
| `SignUpInput` | `type` | Inferido do `signUpSchema` â€” `{ username, email, password }` |
| `SignUpResponse` | `interface` | `{ token, user: User }` |

---

### `cliente`
DomÃ­nio exclusivo do usuÃ¡rio com role `cliente`. Possui layout prÃ³prio com bottom navigation mobile-first.

**`nsfw/`** â€” agrupa as sub-features `gerar-imagem` e `gerar-video` (geraÃ§Ã£o NSFW). O barrel `nsfw/index.ts` reexporta `GerarImagem` e `GerarVideo` para o router.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/ClienteDashboard.tsx` | Redirect para `/cliente/feed` |

**Componentes**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `components/Header.tsx` | Header fixo no topo â€” logo Privacy IA (esquerda) + Ã­cone de perfil com link para `/cliente/perfil` (direita) |
| `components/BottomNav.tsx` | Bottom navigation fixa com 5 itens: Feed, Descobrir, Chat, Gerar NSFW (`/cliente/gerar-imagem`), Galeria |
| `components/ClienteLayout.tsx` | Layout base â€” `Header` fixo no topo + conteÃºdo com `pt-14 pb-16` + `BottomNav` fixa no rodapÃ© |
| `components/AtrizCardCompact.tsx` | Card pequeno de atriz â€” banner + avatar sobreposto + nome; usado em carrossel do Feed, coluna de sugestÃµes e blocos Top |
| `components/AtrizCardHorizontal.tsx` | Card horizontal de atriz â€” banner como fundo + gradiente + avatar + nome; usado em grids e carrosÃ©is do Descobrir |

**Sub-features**
| Pasta | Rota | PÃ¡gina | DescriÃ§Ã£o |
|---|---|---|---|
| `feed/` | `/cliente/feed` | `Feed.tsx` | Feed do cliente â€” posts com banner strip, mÃ­dia 4:5, curtir/salvar, carrossel entre posts e Top 10 |
| `descobrir/` | `/cliente/descobrir` | `Descobrir.tsx` | PÃ¡gina de descoberta |
| `notificacoes/` | `/cliente/notificacoes` | `Notificacoes.tsx` | Lista por categoria -> destino; engrenagem + modal; mock primeiro â€” spec em `index.ts` |
| `chat/` | `/cliente/chat`, `/cliente/chat/:id` | `ChatPage.tsx` (+ pÃ¡ginas legadas nÃ£o roteadas) | Chat â€” spec em `index.ts` |
| `galeria/` | `/cliente/galeria` | `Galeria.tsx` | Grid de atrizes com mÃ­dias; busca com debounce; borrado se sem assinatura; marca d'Ã¡gua |
| `nsfw/gerar-imagem/` | `/cliente/gerar-imagem` | `GerarImagem.tsx` | Gerar NSFW (imagem) â€” spec em `index.ts`; BottomNav: â€œGerar NSFWâ€ |
| `nsfw/gerar-video/` | `/cliente/gerar-video` | `GerarVideo.tsx` | GeraÃ§Ã£o de vÃ­deo com IA |
| `carteira/` | `/cliente/carteira` | `Carteira.tsx` | Saldo, hist. crÃ©dito/pagamento, mÃ©todos, compra; mock â€” spec em `index.ts` (secoes 1 a 11) |
| `perfil/` | `/cliente/perfil` | `Perfil.tsx` | Hub de perfil (atalhos, nome, prompt de tom) â€” spec completa em `index.ts` (secoes 1 a 11) |
| `atriz-perfil/` | `/cliente/atriz/:id` | `AtrizPerfilPage.tsx` | Perfil de atriz visto pelo cliente â€” placeholder (spec a definir) |

---

### `cliente/feed`
Feed principal do cliente.

**Componentes internos**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `components/PostCard.tsx` | Card completo de post â€” orquestra Header, BannerStrip, Media e Actions |
| `components/PostHeader.tsx` | CabeÃ§alho do post â€” avatar + nome + menu de 3 pontos (silenciar/denunciar/ocultar) |
| `components/PostBannerStrip.tsx` | Faixa banner do post â€” banner + avatar + nome sobrepostos; link ao perfil |
| `components/PostMedia.tsx` | MÃ­dia principal do post â€” foto ou vÃ­deo em proporÃ§Ã£o 4:5 |
| `components/PostActions.tsx` | AÃ§Ãµes do post â€” ir ao perfil, curtir (com contagem), comentar, salvar na galeria |
| `components/CarouselEntrePostsBlock.tsx` | Carrossel horizontal entre posts â€” 4x AtrizCardCompact + botÃ£o “ver mais” â†' Descobrir |
| `components/Top10Block.tsx` | Bloco Top 10 â€” carrossel horizontal com posiÃ§Ã£o + banner + avatar + nome |
| `components/SugestoesColuna.tsx` | Coluna direita (desktop) â€” sugestÃµes de atrizes com AtrizCardCompact |

**Hooks**
| Arquivo | Assinatura | DescriÃ§Ã£o |
|---|---|---|
| `hooks/useFeedPosts.ts` | `useFeedPosts()` | `useQuery` â†' `GET /feed/posts` |
| `hooks/useSugestoes.ts` | `useSugestoes()` | `useQuery` â†' `GET /feed/sugestoes` |
| `hooks/useTop10.ts` | `useTop10()` | `useQuery` â†' `GET /feed/top10` |
| `hooks/useCurtirPost.ts` | `useCurtirPost()` | `useMutation` â†' `POST /feed/posts/:id/curtir`, invalida `['feed','posts']` |
| `hooks/useSalvarPost.ts` | `useSalvarPost()` | `useMutation` â†' `POST /feed/posts/:id/salvar`, invalida `['feed','posts']` |

**API**
| Arquivo | FunÃ§Ã£o | MÃ©todo | Endpoint |
|---|---|---|---|
| `api/getFeedPosts.ts` | `getFeedPosts()` | `GET` | `/feed/posts` |
| `api/getSugestoes.ts` | `getSugestoes()` | `GET` | `/feed/sugestoes` |
| `api/getTop10.ts` | `getTop10()` | `GET` | `/feed/top10` |
| `api/curtirPost.ts` | `curtirPost(id)` | `POST` | `/feed/posts/:id/curtir` |
| `api/salvarPost.ts` | `salvarPost(id)` | `POST` | `/feed/posts/:id/salvar` |

**Tipos**
| Nome | Tipo | DescriÃ§Ã£o |
|---|---|---|
| `Post` | `interface` | `{ id, atriz: AtrizPerfil, tipo, url, curtidas, comentarios, curtido, salvo }` |
| `Top10Item` | `interface` | `{ posicao, atriz: AtrizPerfil }` |

---

### `cliente/chat`
Sistema de mensagens entre cliente e atriz.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/ChatPage.tsx` | Rota ativa â€” lista + thread + painel atriz; `/cliente/chat` e `/cliente/chat/:id` |
| `pages/Chat.tsx`, `ChatDetail.tsx`, `Mensagens.tsx` | Legadas â€” nÃ£o usadas no router atual |

**Componentes**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `components/ConversationCard.tsx` | Card de conversa â€” avatar, nome, Ãºltima mensagem, hora e badge de nÃ£o lidas |
| `components/MessageBubble.tsx` | Bolha de mensagem â€” alinhamento e cor variam por remetente (`cliente` / `atriz`) |
| `components/ChatInput.tsx` | Textarea + botÃ£o de envio â€” submete com Enter (sem Shift), limpa apÃ³s envio |

**Hooks**
| Arquivo | Assinatura | DescriÃ§Ã£o |
|---|---|---|
| `hooks/useConversas.ts` | `useConversas()` | `useQuery` â†’ `GET /chat/conversas` |
| `hooks/useMensagens.ts` | `useMensagens(conversaId)` | `useQuery` â†’ `GET /chat/conversas/:id/mensagens` |
| `hooks/useEnviarMensagem.ts` | `useEnviarMensagem(conversaId)` | `useMutation` â†’ `POST /chat/conversas/:id/mensagens`, invalida queries de mensagens e conversas |

**API**
| Arquivo | FunÃ§Ã£o | MÃ©todo | Endpoint |
|---|---|---|---|
| `api/getConversas.ts` | `getConversas()` | `GET` | `/chat/conversas` |
| `api/getMensagens.ts` | `getMensagens(conversaId)` | `GET` | `/chat/conversas/:id/mensagens` |
| `api/enviarMensagem.ts` | `enviarMensagem(conversaId, conteudo)` | `POST` | `/chat/conversas/:id/mensagens` |

**Tipos**
| Nome | Tipo | DescriÃ§Ã£o |
|---|---|---|
| `Atriz` | `interface` | `{ id, nome, avatar, online }` |
| `Conversa` | `interface` | `{ id, atriz, ultimaMensagem, ultimaHora, naoLidas }` |
| `Mensagem` | `interface` | `{ id, conversaId, conteudo, de: 'cliente' \| 'atriz', criadaEm }` |

---

### `cliente/carteira`
Carteira financeira do cliente — saldo, créditos, históricos e compra de créditos.

**Componentes internos**
| Arquivo | Descrição |
|---|---|
| `components/SaldoCard.tsx` | Cards de saldo (R$) e créditos em destaque |
| `components/PacotesCreditos.tsx` | Grid de pacotes de créditos com seleção + método + botão comprar |
| `components/MetodosPagamento.tsx` | Lista de métodos + formulário inline para adicionar cartão ou Pix |
| `components/HistoricoCreditos.tsx` | Lista de transações de crédito (entradas e saídas) |
| `components/HistoricoPagamentos.tsx` | Lista de pagamentos com status (aprovado/pendente/recusado) |

**Hooks**
| Arquivo | Assinatura | Descrição |
|---|---|---|
| `hooks/useCarteira.ts` | `useCarteira()` | `useQuery` → `GET /carteira` |
| `hooks/useHistoricoCreditos.ts` | `useHistoricoCreditos()` | `useQuery` → `GET /carteira/historico-creditos` |
| `hooks/useHistoricoPagamentos.ts` | `useHistoricoPagamentos()` | `useQuery` → `GET /carteira/historico-pagamentos` |
| `hooks/useMetodosPagamento.ts` | `useMetodosPagamento()` | `useQuery` → `GET /carteira/metodos-pagamento` |
| `hooks/useAdicionarMetodo.ts` | `useAdicionarMetodo()` | `useMutation` → `POST /carteira/metodos-pagamento`, invalida `['carteira','metodos-pagamento']` |
| `hooks/usePacotes.ts` | `usePacotes()` | `useQuery` → `GET /carteira/pacotes` |
| `hooks/useComprarCreditos.ts` | `useComprarCreditos()` | `useMutation` → `POST /carteira/comprar`, invalida `['carteira']` |

**API**
| Arquivo | Função | Método | Endpoint |
|---|---|---|---|
| `api/getCarteira.ts` | `getCarteira()` | `GET` | `/carteira` |
| `api/getHistoricoCreditos.ts` | `getHistoricoCreditos()` | `GET` | `/carteira/historico-creditos` |
| `api/getHistoricoPagamentos.ts` | `getHistoricoPagamentos()` | `GET` | `/carteira/historico-pagamentos` |
| `api/getMetodosPagamento.ts` | `getMetodosPagamento()` | `GET` | `/carteira/metodos-pagamento` |
| `api/adicionarMetodoPagamento.ts` | `adicionarMetodoPagamento(input)` | `POST` | `/carteira/metodos-pagamento` |
| `api/getPacotes.ts` | `getPacotes()` | `GET` | `/carteira/pacotes` |
| `api/comprarCreditos.ts` | `comprarCreditos(input)` | `POST` | `/carteira/comprar` |

**Tipos**
| Nome | Tipo | Descrição |
|---|---|---|
| `CarteiraResumo` | `interface` | `{ saldo, creditos }` |
| `TransacaoCredito` | `interface` | `{ id, tipo: 'entrada' \| 'saida', descricao, valor, criadaEm }` |
| `TipoTransacaoCredito` | `type` | `'entrada' \| 'saida'` |
| `HistoricoPagamento` | `interface` | `{ id, tipo, descricao, valor, status, criadaEm }` |
| `StatusPagamento` | `type` | `'aprovado' \| 'pendente' \| 'recusado'` |
| `TipoPagamento` | `type` | `'compra' \| 'recarga'` |
| `MetodoPagamento` | `interface` | `{ id, tipo, bandeira?, ultimosDigitos?, apelido?, criadaEm }` |
| `TipoMetodo` | `type` | `'cartao' \| 'pix'` |
| `AdicionarMetodoInput` | `interface` | `{ tipo, apelido?, ultimosDigitos?, bandeira? }` |
| `PacoteCreditos` | `interface` | `{ id, creditos, preco, destaque? }` |
| `ComprarCreditosInput` | `interface` | `{ pacoteId, metodoId }` |

---

### `cliente/galeria`
Galeria de mídias por atriz.

**Componentes internos**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `components/GaleriaAtrizCard.tsx` | Card de atriz â€" preview quadrado, borrado se sem assinatura, marca d'Ã¡gua, contagem de mÃ­dias, badge "Ativa" |

**Hooks**
| Arquivo | Assinatura | DescriÃ§Ã£o |
|---|---|---|
| `hooks/useGaleria.ts` | `useGaleria(q?)` | `useQuery` â†' `GET /galeria?q=` |

**API**
| Arquivo | FunÃ§Ã£o | MÃ©todo | Endpoint |
|---|---|---|---|
| `api/getGaleria.ts` | `getGaleria(q?)` | `GET` | `/galeria` |

**Tipos**
| Nome | Tipo | DescriÃ§Ã£o |
|---|---|---|
| `GaleriaAtriz` | `interface` | `{ id, nome, avatar, banner, assinaturaAtiva, totalMidias, previewUrl }` |
| `MidiaGaleria` | `interface` | `{ id, atrizId, tipo, url, criadaEm, salvaDoFeed }` |
| `MidiaTipo` | `type` | `'foto' \| 'video' \| 'live_action' \| 'live_audio'` |

---

### `cliente/notificacoes`
Lista unificada de notificações de marketing e sistema. Cada item navega dinamicamente conforme categoria + payload. Modal de preferências para ligar/desligar por tipo.

**Componentes internos**
| Arquivo | Descrição |
|---|---|
| `components/NotificacaoItem.tsx` | Linha de notificação — ícone por categoria, título, descrição, tempo relativo, ponto de não lida; clique marca como lida e navega |
| `components/ModalPreferencias.tsx` | Modal bottom-sheet com toggles para Marketing e Sistema |

**Hooks**
| Arquivo | Assinatura | Descrição |
|---|---|---|
| `hooks/useNotificacoes.ts` | `useNotificacoes()` | `useQuery` → `GET /notificacoes` |
| `hooks/useMarcarLida.ts` | `useMarcarLida()` | `useMutation` → `PATCH /notificacoes/:id/lida`, invalida `['notificacoes']` |
| `hooks/useMarcarTodasLidas.ts` | `useMarcarTodasLidas()` | `useMutation` → `POST /notificacoes/ler-tudo`, invalida `['notificacoes']` |
| `hooks/usePreferencias.ts` | `usePreferencias()` | `useQuery` → `GET /notificacoes/preferencias` |
| `hooks/useSalvarPreferencias.ts` | `useSalvarPreferencias()` | `useMutation` → `PATCH /notificacoes/preferencias`, invalida preferências |

**API**
| Arquivo | Função | Método | Endpoint |
|---|---|---|---|
| `api/getNotificacoes.ts` | `getNotificacoes()` | `GET` | `/notificacoes` |
| `api/marcarLida.ts` | `marcarLida(id)` | `PATCH` | `/notificacoes/:id/lida` |
| `api/marcarTodasLidas.ts` | `marcarTodasLidas()` | `POST` | `/notificacoes/ler-tudo` |
| `api/getPreferencias.ts` | `getPreferencias()` | `GET` | `/notificacoes/preferencias` |
| `api/salvarPreferencias.ts` | `salvarPreferencias(prefs)` | `PATCH` | `/notificacoes/preferencias` |

**Utils**
| Arquivo | Função | Descrição |
|---|---|---|
| `utils/getNotificationDestination.ts` | `getNotificationDestination(n)` | Resolve categoria + payload → rota do React Router |
| `utils/getNotificationDestination.ts` | `tempoRelativo(iso)` | Formata timestamp ISO em string relativa (agora, 5min, 2h, 3d) |

**Tipos**
| Nome | Tipo | Descrição |
|---|---|---|
| `TipoNotificacao` | `type` | `'marketing' \| 'sistema'` |
| `CategoriaNotificacao` | `type` | `'novo_conteudo' \| 'nova_publicacao' \| 'geracao_concluida' \| 'creditos_baixos' \| 'aviso_geral'` |
| `Notificacao` | `interface` | `{ id, tipo, categoria, titulo, descricao, lida, criadaEm, payload? }` |
| `NotificacaoPayload` | `interface` | `{ atrizSlug?, atrizId?, mediaId? }` |
| `PreferenciasNotificacao` | `interface` | `{ marketing, sistema }` |

---

### `atriz`
DomÃ­nio exclusivo do usuÃ¡rio com role `atriz`.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/AtrizDashboard.tsx` | Painel da atriz â€” ponto de entrada pÃ³s-login |

---

### `adm`
DomÃ­nio exclusivo do usuÃ¡rio com role `adm`.

**PÃ¡ginas**
| Arquivo | DescriÃ§Ã£o |
|---|---|
| `pages/AdmDashboard.tsx` | Painel do administrador â€” ponto de entrada pÃ³s-login |

---

## Shared

### `lib`
| Arquivo | Exporta | DescriÃ§Ã£o |
|---|---|---|
| `shared/lib/env.ts` | `env` | VariÃ¡veis de ambiente validadas via Zod |
| `shared/lib/axios.ts` | `api` | InstÃ¢ncia axios com `baseURL` vinda do `env` |
| `shared/lib/queryClient.ts` | `queryClient` | InstÃ¢ncia global do TanStack Query |

### `components`
_Vazio â€” nenhum componente compartilhado criado ainda._

### `hooks`
| Arquivo | Assinatura | DescriÃ§Ã£o |
|---|---|---|
| `shared/hooks/useScrollDirection.ts` | `useScrollDirection(): 'up' \| 'down'` | Detecta direÃ§Ã£o do scroll da janela via `window.scroll` event |
| `shared/hooks/useDebounce.ts` | `useDebounce<T>(value, delay): T` | Retarda a atualizaÃ§Ã£o de um valor pelo delay em ms |

### `types`
| Arquivo | Exporta | DescriÃ§Ã£o |
|---|---|---|
| `shared/types/user.ts` | `User`, `UserRole` | Tipo do usuÃ¡rio autenticado e seus papÃ©is (`cliente`, `atriz`, `adm`) |
| `shared/types/atriz.ts` | `AtrizPerfil` | Perfil de atriz exibÃ­vel â€" `{ id, nome, avatar, banner }` |

### `stores`
| Arquivo | Exporta | DescriÃ§Ã£o |
|---|---|---|
| `shared/stores/useAuthStore.ts` | `useAuthStore` | Store Zustand de sessÃ£o â€” `token` e `user` persistidos no `localStorage` via `persist` |

### `utils`
| Arquivo | FunÃ§Ã£o | DescriÃ§Ã£o |
|---|---|---|
| `shared/utils/parseApiError.ts` | `parseApiError(error)` | Converte erros axios em mensagens legÃ­veis pelo usuÃ¡rio |

---

## Stores Zustand

| Store | Arquivo | Estado | AÃ§Ãµes |
|---|---|---|---|
| `useAuthStore` | `shared/stores/useAuthStore.ts` | `token: string \| null`, `user: User \| null` | `setAuth(token, user)`, `clearAuth()` |

---

## Mocks MSW

| Handler | MÃ©todo | Endpoint | Comportamento |
|---|---|---|---|
| `handlers/auth.ts` | `POST` | `/auth/login` | Valida credenciais, retorna JWT-like token + user ou 401 |
| `handlers/auth.ts` | `POST` | `/auth/sign-up` | Cria conta com role `cliente`, retorna JWT-like token + user ou 409 se e-mail duplicado |
| `handlers/chat.ts` | `GET` | `/chat/conversas` | Retorna lista de conversas mock |
| `handlers/chat.ts` | `GET` | `/chat/conversas/:id/mensagens` | Retorna mensagens filtradas por conversa |
| `handlers/chat.ts` | `POST` | `/chat/conversas/:id/mensagens` | Cria nova mensagem, atualiza `ultimaMensagem` da conversa |
| `handlers/feed.ts` | `GET` | `/feed/posts` | Retorna lista de posts com atrizes enriquecidas (avatar + banner) |
| `handlers/feed.ts` | `GET` | `/feed/sugestoes` | Retorna 6 atrizes sugeridas |
| `handlers/feed.ts` | `GET` | `/feed/top10` | Retorna Top 10 ordenado |
| `handlers/feed.ts` | `POST` | `/feed/posts/:id/curtir` | Toggle curtido, ajusta contador |
| `handlers/feed.ts` | `POST` | `/feed/posts/:id/salvar` | Toggle salvo |
| `handlers/carteira.ts` | `GET` | `/carteira` | Retorna resumo com saldo e créditos |
| `handlers/carteira.ts` | `GET` | `/carteira/historico-creditos` | Retorna lista de transações de crédito |
| `handlers/carteira.ts` | `GET` | `/carteira/historico-pagamentos` | Retorna lista de pagamentos |
| `handlers/carteira.ts` | `GET` | `/carteira/metodos-pagamento` | Retorna métodos cadastrados |
| `handlers/carteira.ts` | `POST` | `/carteira/metodos-pagamento` | Adiciona novo método ao mock em memória |
| `handlers/carteira.ts` | `GET` | `/carteira/pacotes` | Retorna pacotes de créditos disponíveis |
| `handlers/carteira.ts` | `POST` | `/carteira/comprar` | Simula compra: incrementa créditos e registra histórico |
| `handlers/notificacoes.ts` | `GET` | `/notificacoes` | Retorna notificações dos últimos 7 dias |
| `handlers/notificacoes.ts` | `PATCH` | `/notificacoes/:id/lida` | Marca notificação como lida |
| `handlers/notificacoes.ts` | `POST` | `/notificacoes/ler-tudo` | Marca todas as notificações como lidas |
| `handlers/notificacoes.ts` | `GET` | `/notificacoes/preferencias` | Retorna preferências do usuário (marketing/sistema) |
| `handlers/notificacoes.ts` | `PATCH` | `/notificacoes/preferencias` | Atualiza preferências parcialmente |

**UsuÃ¡rios mock disponÃ­veis** (`password: 12345678` para todos):

| E-mail | Role | Redireciona para |
|---|---|---|
| `cliente@privacy.com` | `cliente` | `/cliente/feed` |
| `atriz@privacy.com` | `atriz` | `/atriz` |
| `adm@privacy.com` | `adm` | `/adm` |

