# TRACKER — Matriz de Rastreabilidade Bidirecional (Regras ↔ Features ↔ Código ↔ Testes)

Este documento materializa a rastreabilidade bidirecional estrita do sistema **Catraca**, mapeando cada regra de negócio (**R01–R13**), critério do PRD (**AC-F01..AC-F06**) e contrato executável (**C-F01..C-F06**) aos arquivos de implementação em `src/` e às suítes de testes automatizados em `tests/`.

---

## 1. Rastreabilidade Regras (R01–R13) ↔ Features ↔ Contratos ↔ Código ↔ Testes

| Regra | Descrição Resumida | Feature(s) | Critérios no PRD | Contrato(s) | Arquivos de Código (Implementação) | Arquivos de Teste | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | Campos obrigatórios do evento e data estritamente futura na criação e edição | F02 | AC-F02.1, XF-01 | `docs/features/F02/contract.md` (C-F02-1) | `src/lib/events/validation.ts`, `src/lib/events/service.ts`, `src/app/api/organizer/events/route.ts`, `src/app/api/organizer/events/[id]/route.ts` | `tests/f02-events.test.ts` | `SYNCED` |
| **R02** | Evento nasce como rascunho (`draft`); somente publicado (`published`) e não cancelado aparece na vitrine e vende ingressos | F02, F03, F04, F05 | AC-F02.1, AC-F02.2, AC-F04.1, AC-F05.2, XF-06, XF-08 | `docs/features/F02/contract.md`, `docs/features/F04/contract.md`, `docs/features/F05/contract.md` | `src/lib/events/service.ts`, `src/app/api/organizer/events/[id]/publish/route.ts`, `src/lib/tickets/purchase.ts`, `src/app/api/partner/events/route.ts`, `src/components/storefront/StorefrontClient.tsx` | `tests/f02-events.test.ts`, `tests/f04-storefront.test.ts`, `tests/f05-partner-api.test.ts` | `SYNCED` |
| **R03** | Lotação máxima `>=` vagas ocupadas (`pending + confirmed`); aumento de preço afeta apenas novas compras | F02, F03, F06 | AC-F02.3, AC-F06.2, XF-08, XF-10 | `docs/features/F02/contract.md`, `docs/features/F05/contract.md`, `docs/features/F06/contract.md` | `src/lib/events/service.ts`, `src/lib/events/validation.ts`, `src/lib/tickets/purchase.ts`, `src/app/api/organizer/events/[id]/route.ts` | `tests/f02-events.test.ts`, `tests/f03-purchase-gateway.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |
| **R04** | Página de gestão própria por evento em `/organizer/events/[id]` com controles operacionais | F02, F06 | AC-F02.2, XF-10 | `docs/features/F02/contract.md`, `docs/features/F06/contract.md` | `src/app/organizer/events/[id]/page.tsx`, `src/components/organizer/EventManageClient.tsx`, `src/components/organizer/OrganizerDashboardClient.tsx` | `tests/f02-events.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |
| **R05** | Cálculo exato de vagas: `ocupadas = pending + confirmed`; `disponíveis = max(0, capacity - ocupadas)` (0 se cancelado) | F02, F03, F04, F05, F06 | AC-F02.3, AC-F03.1, AC-F05.2, AC-F06.2, XF-07, XF-09 | `docs/features/F02/contract.md`–`docs/features/F06/contract.md` | `src/lib/events/utils.ts`, `src/lib/tickets/purchase.ts`, `src/lib/tickets/queries.ts`, `src/app/api/partner/events/route.ts`, `src/app/api/organizer/events/[id]/dashboard/route.ts` | `tests/f02-events.test.ts`, `tests/f03-purchase-gateway.test.ts`, `tests/f04-storefront.test.ts`, `tests/f05-partner-api.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |
| **R06** | Compra de 1 ingresso nasce `pending`, reserva a vaga imediatamente e responde `202` sem esperar o gateway externo | F03, F04, F05 | AC-F03.1, AC-F04.2, AC-F05.3, XF-02, XF-07, XF-09 | `docs/features/F03/contract.md`, `docs/features/F04/contract.md`, `docs/features/F05/contract.md` | `src/lib/tickets/purchase.ts`, `src/app/api/purchases/route.ts`, `src/app/api/partner/events/[eventId]/purchases/route.ts`, `src/lib/queue.ts` | `tests/f03-purchase-gateway.test.ts`, `tests/f04-storefront.test.ts`, `tests/f05-partner-api.test.ts` | `SYNCED` |
| **R07** | Sem vaga: `Ingressos esgotados` na vitrine e `409 sold_out` na API; garantia de nunca exceder lotação sob concorrência (`SELECT FOR UPDATE`) | F03, F04, F05 | AC-F03.2, AC-F04.3, AC-F05.3, XF-07, XF-09 | `docs/features/F03/contract.md`, `docs/features/F04/contract.md`, `docs/features/F05/contract.md` | `src/lib/tickets/purchase.ts`, `src/components/storefront/EventPurchaseCard.tsx`, `src/app/api/partner/events/[eventId]/purchases/route.ts` | `tests/f03-purchase-gateway.test.ts` (30 threads), `tests/f05-partner-api.test.ts` | `SYNCED` |
| **R08** | Processamento assíncrono do gateway: aprovação → `confirmed`; recusa → `declined` e liberação atômica da vaga | F03, F04, F05, F06 | AC-F03.3, AC-F04.2, XF-02, XF-07, XF-09, XF-11 | `docs/features/F03/contract.md`, `docs/features/F04/contract.md`, `docs/features/F06/contract.md` | `src/worker/payment-processor.ts`, `src/worker/index.ts`, `src/lib/gateway/simulator.ts`, `src/lib/tickets/purchase.ts` | `tests/f03-purchase-gateway.test.ts`, `tests/f04-storefront.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |
| **R09** | Código único por ingresso (`TKT-...`); área "Meus Ingressos" exibe evento, status, data e código | F03, F04, F05, F06 | AC-F03.1, AC-F04.2, AC-F05.4, XF-03, XF-12 | `docs/features/F03/contract.md`, `docs/features/F04/contract.md`, `docs/features/F05/contract.md` | `src/lib/ids.ts`, `src/lib/tickets/my-tickets.ts`, `src/lib/tickets/labels.ts`, `src/app/my-tickets/page.tsx`, `src/app/api/my-tickets/route.ts`, `src/app/api/partner/tickets/[ticketId]/route.ts` | `tests/f03-purchase-gateway.test.ts`, `tests/f04-storefront.test.ts`, `tests/f05-partner-api.test.ts` | `SYNCED` |
| **R10** | Check-in operacional na ordem exata de precedência com mensagens literais exigidas | F06 | AC-F06.1, XF-12, XF-13 | `docs/features/F06/contract.md` (C-F06-1) | `src/lib/events/operations.ts`, `src/app/api/organizer/events/[id]/checkin/route.ts` | `tests/f06-operations.test.ts` | `SYNCED` |
| **R11** | Cancelamento irreversível de evento; estorno automático (`refunded`) em até 10s e guarda estrita contra confirmação tardia do gateway | F03, F06 | AC-F03.4, AC-F06.3, XF-10, XF-11, XF-12, XF-13 | `docs/features/F03/contract.md`, `docs/features/F06/contract.md` (C-F06-3) | `src/lib/events/operations.ts`, `src/worker/payment-processor.ts`, `src/app/api/organizer/events/[id]/cancel/route.ts` | `tests/f03-purchase-gateway.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |
| **R12** | Painel unificado de métricas operacionais e financeiras (vitrine + API parceira) | F06 | AC-F06.2, XF-12, XF-13 | `docs/features/F06/contract.md` (C-F06-2) | `src/lib/events/operations.ts`, `src/app/api/organizer/events/[id]/dashboard/route.ts`, `src/components/organizer/OrganizerDashboardClient.tsx` | `tests/f06-operations.test.ts` | `SYNCED` |
| **R13** | Isolamento estrito por organizador; bloqueio de participantes e visitantes em rotas operacionais | F01, F02, F06 | AC-F01.4, AC-F02.4, XF-01, XF-03, XF-05 | `docs/features/F01/contract.md`, `docs/features/F02/contract.md`, `docs/features/F06/contract.md` | `src/lib/auth.ts`, `src/lib/auth-utils.ts`, `src/lib/events/service.ts`, `src/app/organizer/page.tsx`, `src/app/organizer/events/[id]/page.tsx` | `tests/f01-foundation.test.ts`, `tests/f02-events.test.ts`, `tests/f06-operations.test.ts` | `SYNCED` |

---

## 2. Matriz Completa de Código Fonte (`src/**`) → Feature & Responsabilidade

Mapeamento exaustivo de 100% dos arquivos de código fonte em `src/` para suas respectivas features e testes:

| Arquivo de Código Fonte | Feature | Regras | Responsabilidade Principal na Feature | Suíte de Testes Associada |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/api/auth/login/route.ts` | F01 | R13 | Autenticação de organizadores e participantes com JWT e cookies seguros | `tests/f01-foundation.test.ts` |
| `src/app/api/auth/logout/route.ts` | F01 | R13 | Invalidação de sessão e limpeza de cookies HTTP-only | `tests/f01-foundation.test.ts` |
| `src/app/api/auth/me/route.ts` | F01 | R13 | Resolução de identidade e perfil do usuário logado | `tests/f01-foundation.test.ts` |
| `src/app/api/auth/register/route.ts` | F01 | R13 | Cadastro de novos participantes com hash de senha seguro | `tests/f01-foundation.test.ts` |
| `src/app/api/health/route.ts` | F01 | — | Endpoint de healthcheck do sistema, conexão PostgreSQL e Redis | `tests/f01-foundation.test.ts` |
| `src/app/api/my-tickets/route.ts` | F04 | R09 | Consulta paginada dos ingressos adquiridos pelo participante logado | `tests/f04-storefront.test.ts` |
| `src/app/api/organizer/events/[id]/cancel/route.ts` | F06 | R11, R13 | Cancelamento atômico irreversível de evento e disparo de estornos | `tests/f06-operations.test.ts` |
| `src/app/api/organizer/events/[id]/checkin/route.ts` | F06 | R10, R13 | Validação de check-in com mensagens literais e transição de estado | `tests/f06-operations.test.ts` |
| `src/app/api/organizer/events/[id]/dashboard/route.ts` | F06 | R05, R12, R13 | Agregação unificada de métricas (confirmados, pendentes, check-ins, receita) | `tests/f06-operations.test.ts` |
| `src/app/api/organizer/events/[id]/publish/route.ts` | F02 | R02, R13 | Publicação de evento rascunho tornando-o disponível para venda | `tests/f02-events.test.ts` |
| `src/app/api/organizer/events/[id]/route.ts` | F02 | R01, R03, R13 | Consulta e edição de dados e lotação de evento existente | `tests/f02-events.test.ts` |
| `src/app/api/organizer/events/route.ts` | F02 | R01, R02, R13 | Listagem e criação de novos eventos para o organizador autenticado | `tests/f02-events.test.ts` |
| `src/app/api/partner/events/[eventId]/purchases/route.ts` | F05 | R02, R05, R06, R07 | Checkout de ingressos via API externa de parceiros (contrato fixo) | `tests/f05-partner-api.test.ts` |
| `src/app/api/partner/events/route.ts` | F05 | R02, R05 | Listagem de eventos públicos disponíveis para venda via API de parceiros | `tests/f05-partner-api.test.ts` |
| `src/app/api/partner/tickets/[ticketId]/route.ts` | F05 | R09 | Consulta pública de status e detalhes do ingresso para parceiros | `tests/f05-partner-api.test.ts` |
| `src/app/api/purchases/route.ts` | F03 | R06, R07 | Ponto de entrada de compra web com reserva atômica e enfileiramento BullMQ | `tests/f03-purchase-gateway.test.ts` |
| `src/app/layout.tsx` | F01 | — | Layout raiz da aplicação Next.js com Navbar e providers de sessão | `tests/f01-foundation.test.ts` |
| `src/app/login/page.tsx` | F01 | R13 | Página de login com formulário e redirecionamento por perfil | `tests/f01-foundation.test.ts` |
| `src/app/my-tickets/page.tsx` | F04 | R09 | Interface web do participante para listagem de ingressos comprados | `tests/f04-storefront.test.ts` |
| `src/app/organizer/events/[id]/page.tsx` | F02 | R04, R13 | Interface de gestão detalhada do evento (edição, publicação, métricas) | `tests/f02-events.test.ts` |
| `src/app/organizer/page.tsx` | F02 | R04, R13 | Painel principal do organizador com listagem de seus eventos | `tests/f02-events.test.ts` |
| `src/app/page.tsx` | F04 | R02, R07 | Vitrine pública com listagem de eventos disponíveis e esgotados | `tests/f04-storefront.test.ts` |
| `src/app/register/page.tsx` | F01 | R13 | Página de registro de novos participantes | `tests/f01-foundation.test.ts` |
| `src/components/LoginForm.tsx` | F01 | R13 | Componente de formulário de login com feedback visual e tratamento de erro | `tests/f01-foundation.test.ts` |
| `src/components/LogoutButton.tsx` | F01 | R13 | Botão de logout com chamada de invalidação de sessão | `tests/f01-foundation.test.ts` |
| `src/components/Navbar.tsx` | F01 | R13 | Barra de navegação responsiva com itens contextuais por papel de usuário | `tests/f01-foundation.test.ts` |
| `src/components/RegisterForm.tsx` | F01 | R13 | Componente de formulário de cadastro de participantes | `tests/f01-foundation.test.ts` |
| `src/components/organizer/EventManageClient.tsx` | F02 | R01, R03, R04 | Painel cliente para edição de evento, publicação e alteração de lotação | `tests/f02-events.test.ts` |
| `src/components/organizer/OrganizerDashboardClient.tsx` | F06 | R04, R10, R11, R12 | Interface de operações: check-in manual, cancelamento e painel de vendas | `tests/f06-operations.test.ts` |
| `src/components/storefront/EventPurchaseCard.tsx` | F04 | R02, R06, R07 | Card do evento na vitrine com botão de compra ou etiqueta 'Esgotado' | `tests/f04-storefront.test.ts` |
| `src/components/storefront/StorefrontClient.tsx` | F04 | R02, R07 | Componente cliente de renderização e busca de eventos na vitrine | `tests/f04-storefront.test.ts` |
| `src/components/storefront/formatters.ts` | F04 | — | Funções utilitárias de formatação monetária (BRL) e data/hora | `tests/f04-storefront.test.ts` |
| `src/db/index.ts` | F01 | — | Instância de conexão com PostgreSQL via Drizzle ORM e pool seguro | `tests/f01-foundation.test.ts` |
| `src/db/migrate.ts` | F01 | — | Script de execução automática de migrações SQL no banco | `tests/f01-foundation.test.ts` |
| `src/db/schema.ts` | F01 | R01–R13 | Esquema de tabelas Drizzle (`users`, `events`, `tickets`, `purchases`, `audit_logs`) | `tests/f01-foundation.test.ts` |
| `src/db/seed.ts` | F01 | R13 | Seed idempotente com organizadores (A e B) e participantes padrão | `tests/f01-foundation.test.ts` |
| `src/lib/auth-utils.ts` | F01 | R13 | Funções utilitárias de hashing de senha (`bcrypt`) e verificação | `tests/f01-foundation.test.ts` |
| `src/lib/auth.ts` | F01 | R13 | Emissão e validação de JWT, extração de claims e verificação de role | `tests/f01-foundation.test.ts` |
| `src/lib/events/operations.ts` | F06 | R10, R11, R12 | Lógica de negócio de check-in, cancelamento com estorno e agregação de métricas | `tests/f06-operations.test.ts` |
| `src/lib/events/service.ts` | F02 | R01, R02, R03, R05 | Consultas e mutações de eventos no banco com validação de regras | `tests/f02-events.test.ts` |
| `src/lib/events/utils.ts` | F02 | R05 | Utilitários de cálculo de vagas disponíveis, ocupadas e status | `tests/f02-events.test.ts` |
| `src/lib/events/validation.ts` | F02 | R01, R03 | Schemas Zod de validação de criação e atualização de eventos | `tests/f02-events.test.ts` |
| `src/lib/gateway/simulator.ts` | F03 | R08 | Gateway de pagamento simulado com regras determinísticas por número de cartão | `tests/f03-purchase-gateway.test.ts` |
| `src/lib/ids.ts` | F01 | R09 | Geradores determinísticos de identificadores únicos (`evt_`, `tkt_`, `pur_`) | `tests/f01-foundation.test.ts` |
| `src/lib/logger.ts` | F01 | RNF-LGPD | Logger estruturado Pino com mascaramento obrigatório de dados sensíveis | `tests/f01-foundation.test.ts` |
| `src/lib/partner-auth.ts` | F05 | R13 | Autenticação por chave de API de parceiros (`x-api-key`) | `tests/f05-partner-api.test.ts` |
| `src/lib/partner-validation.ts` | F05 | R06, R07 | Schemas Zod de validação de payload para requisições de parceiros | `tests/f05-partner-api.test.ts` |
| `src/lib/queue.ts` | F03 | R06 | Fila BullMQ conectada ao Redis para enfileiramento de processamento de compras | `tests/f03-purchase-gateway.test.ts` |
| `src/lib/tickets/labels.ts` | F04 | R09 | Mapeamento de status de ingressos para textos amigáveis em português | `tests/f04-storefront.test.ts` |
| `src/lib/tickets/my-tickets.ts` | F04 | R09 | Consulta otimizada dos ingressos do participante logado | `tests/f04-storefront.test.ts` |
| `src/lib/tickets/purchase.ts` | F03 | R05, R06, R07 | Motor de reserva atômica de ingressos com `SELECT ... FOR UPDATE` | `tests/f03-purchase-gateway.test.ts` |
| `src/lib/tickets/queries.ts` | F04 | R05, R09 | Consultas auxiliares de ingressos e agregação de dados | `tests/f04-storefront.test.ts` |
| `src/worker/index.ts` | F03 | R08 | Ponto de entrada do worker BullMQ de background | `tests/f03-purchase-gateway.test.ts` |
| `src/worker/payment-processor.ts` | F03 | R08, R11 | Processador de fila que chama o gateway e atualiza status de ingresso e compra | `tests/f03-purchase-gateway.test.ts` |

---

## 3. Matriz de Suítes de Testes (`tests/**`) ↔ Features

| Arquivo de Teste | Feature(s) Coberta(s) | Quantidade de Testes | Regras Validadas |
| :--- | :--- | :--- | :--- |
| `tests/f01-foundation.test.ts` | F01 | 12 testes | R13, RNF-LGPD (Harness, Auth, Roles, Logger) |
| `tests/f02-events.test.ts` | F02 | 10 testes | R01, R02, R03, R04, R05, R13 |
| `tests/f03-purchase-gateway.test.ts` | F03 | 14 testes | R02, R03, R05, R06, R07 (30 threads concorrentes), R08, R09, R11 |
| `tests/f04-storefront.test.ts` | F04 | 9 testes | R02, R05, R06, R07, R08, R09 |
| `tests/f05-partner-api.test.ts` | F05 | 11 testes | R02, R03, R05, R06, R07, R08, R09, Contrato Fixo |
| `tests/f06-operations.test.ts` | F06 | 8 testes | R03, R04, R05, R08, R09, R10, R11, R12, R13 |

---

## 4. Auditoria de Cobertura e Rastreabilidade

- **Total de Regras Mapeadas:** 13/13 (100%)
- **Total de Features Mapeadas:** 6/6 (100%)
- **Total de Arquivos Fonte Rastreados:** 54/54 (100% de `src/**`)
- **Total de Suítes de Testes Mapeadas:** 6/6 (100% de `tests/**`)
- **Drift de Código e Documentação:** `0 drift` (Totalmente Sincronizado)
