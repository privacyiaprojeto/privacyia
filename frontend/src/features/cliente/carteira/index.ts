/*
 * ============================================================
 * ESPECIFICAÇÃO — Carteira (/cliente/carteira)
 * Última revisão: 2026-04-16 (respostas do checklist + mock primeiro)
 * Fonte: produto (checklist) + estado do código
 * ============================================================
 *
 * 1) Objetivo (negócio / usuário)
 *    O cliente deve **ver a carteira** com **saldo** e **créditos** visíveis na
 *    interface, além de **histórico**: separar (ou distinguir claramente)
 *    **movimentação de créditos** e **histórico de pagamentos**.
 *
 * 2) Usuário e pré-condições
 *    Cliente autenticado. Sem login não há acesso ao app cliente (alinhar com Feed).
 *
 * 3) Conteúdo e seções (UI em alto nível)
 *    - Destaque de **saldo** e de **créditos** (como o produto quiser diferenciar na
 *      UI — ex.: saldo em créditos como unidade principal; alinhar com `Header` que
 *      já mostra créditos).
 *    - **Histórico de créditos** (entradas/saídas, consumo).
 *    - **Histórico de pagamentos** (compras, recargas).
 *    - **Métodos de pagamento:** visualizar lista e **adicionar** novo método.
 *    - **Comprar créditos:** opção explícita (CTA / seção de pacotes).
 *    Implementação atual no código: `ClienteLayout` + título “Carteira” (placeholder).
 *
 * 4) Ações primárias e secundárias
 *    - Comprar créditos (pacotes de **valores fixos** em créditos — ver seção 6).
 *    - Gerenciar métodos de pagamento (ver, adicionar).
 *    - Consultar históricos (crédito e pagamento).
 *
 * 5) Estados
 *    Loading, erro, lista vazia, saldo zero: **mensagens padrão** do app (fluxo
 *    global — ex.: `parseApiError` / cópias genéricas já usadas no projeto).
 *
 * 6) Regras / validações (campos, limites, permissões)
 *    - Oferta de compra: **valores fixos** em **créditos** (pacotes pré-definidos),
 *      não valor livre digitável — salvo mudança futura de produto.
 *    - **Histórico:** sem limite de retenção definido pelo produto (listar tudo o que
 *      o backend devolver; no mock, simular volume razoável ou paginação depois).
 *
 * 7) Navegação (entrada / saída)
 *    - Rota: `/cliente/carteira`.
 *    - Entrada: `Header` (link de créditos/saldo), `Sidebar` (item Carteira),
 *      **hub de Perfil** (`/cliente/perfil` — botão/atalho para Carteira), e links
 *      contextuais “falta saldo” quando existirem em outras features (a implementar).
 *
 * 8) Analytics / eventos
 *    **Sim** — captar eventos relevantes (ex.: visualização da carteira, início de
 *    compra, conclusão, valor/pacote) — nomes e payload na implementação.
 *
 * 9) API / persistência e MSW (ordem de trabalho)
 *    **Somente mock (MSW + dados em memória) por enquanto**; gateway de pagamento
 *    real fica para fase posterior.
 *    Proposta para o mock (ajustar ao implementar):
 *    - `GET /cliente/carteira` ou recursos separados — saldo, créditos, resumo.
 *    - Históricos: `GET` paginado ou filtros (créditos vs pagamento) conforme modelo.
 *    - Métodos de pagamento: `GET/POST` (adicionar).
 *    - Compra: `POST` simulada que incrementa saldo no mock.
 *    Dados em `mocks/data/` + handlers em `mocks/handlers/`, espelhando `features/carteira/`.
 *
 * 10) Fora de escopo nesta rota
 *     - Execução do consumo de créditos nas outras telas (geração, chat, etc.) — só
 *       **integração** financeira visível aqui.
 *     - Processamento real de pagamento (PSP, PIX live) até o produto acoplar gateway.
 *     - Item 10 do checklist em branco — delimitações extras quando o produto quiser.
 *
 * 11) Lacunas úteis para fechar na implementação
 *     - Layout exato: duas abas vs uma página com dois blocos de histórico.
 *     - Contrato JSON fino (campos de transação, método de pagamento).
 *     - Paginação infinita vs páginas quando o histórico crescer.
 *
 * --- Wireframe ASCII (conceitual) ---
 * |  Carteira                                                                   |
 * |  Saldo: [ ___ ]   Créditos: [ ___ ]   [ Comprar créditos ]                    |
 * |  Métodos de pagamento                              [ + adicionar ]             |
 * |  Histórico de créditos                                                       |
 * |  ...                                                                         |
 * |  Histórico de pagamentos                                                     |
 * |  ...                                                                         |
 * ============================================================
 *
 * --- Checklist (respostas do produto) ---
 *  1. Ver carteira; histórico de crédito e de pagamento; mostrar créditos e saldo.
 *  2. Ver e adicionar método de pagamento.
 *  3. Opção de comprar créditos.
 *  4. Mensagens padrão (loading/erro/vazio).
 *  5. Pacotes com valores fixos em créditos.
 *  6. Entrada também pelo perfil do cliente (hub).
 *  7. Analytics sim.
 *  8. Só mock por enquanto.
 *  9. Histórico sem limite de retenção definido.
 * 10. (em branco) — pendente.
 * ============================================================
 */

export { Carteira } from '@/features/cliente/carteira/pages/Carteira'
