# Project Plan — Catraca (Sistema de Ingressos e Gestão de Eventos)

## 1. Visão Geral da Arquitetura e Engenharia em Ondas

O projeto **Catraca** foi executado seguindo a metodologia Documentation-First do `agy-ensemble`, estruturado em 4 ondas sucessivas e paralelas com worktrees isoladas e governança estrita de branches:

```
[Wave 1: F01] ───► [Wave 2: F02 + F03 (Paralelo)] ───► [Wave 3: F04 + F05 (Paralelo)] ───► [Wave 4: F06]
```

---

## 2. Estrutura de Ondas e Features

### Wave 1: Fundação, Harness e Autenticação
- **Feature F01:** Plataforma, Harness, Banco de Dados, Seed e Autenticação
  - **Status:** `COMPLETED`
  - **Entrega:** PostgreSQL 16 + Redis 7 em Docker, migrações Drizzle, seed idempotente com Organizador A e B, autenticação JWT HTTP-only, logger estruturado com mascaramento LGPD e endpoint `/api/health`.
  - **PR:** [#1](https://github.com/LucasGauterio/catraca/pull/1) | **Relatório:** `docs/features/F01/reports/eval-20261125-1040.md`

### Wave 2: Gestão de Eventos & Motor Concorrente de Reservas (Paralelo)
- **Feature F02:** Gestão de Eventos e Área do Organizador
  - **Status:** `COMPLETED`
  - **Entrega:** CRUD de eventos (criação com data futura `R01`, edição de lotação `>=` ocupadas `R03`), publicação de rascunhos `R02`, página de gestão `/organizer/events/[id]` `R04` e isolamento estrito `R13`.
  - **PR:** [#3](https://github.com/LucasGauterio/catraca/pull/3) | **Relatório:** `docs/features/F02/reports/eval-001.md`
- **Feature F03:** Motor de Reservas Concorrentes e Gateway Simulado Assíncrono
  - **Status:** `COMPLETED`
  - **Entrega:** Motor de reserva atômica com `SELECT FOR UPDATE` contra overbooking sob concorrência (30 threads validadas), gateway assíncrono via BullMQ, resposta `202 pending` imediata `R06` e guarda contra confirmação tardia `R11`.
  - **PR:** [#2](https://github.com/LucasGauterio/catraca/pull/2) | **Relatório:** `docs/features/F03/reports/eval-001.md`

### Wave 3: Storefront de Vendas & API de Parceiros (Paralelo)
- **Feature F04:** Storefront de Vendas e Checkout de Ingressos
  - **Status:** `COMPLETED`
  - **Entrega:** Vitrine pública `/` com listagem de eventos disponíveis e etiqueta "Ingressos esgotados" `R07`, fluxo de compra web do participante e página `/my-tickets` com código único do ingresso `R09`.
  - **PR:** [#4](https://github.com/LucasGauterio/catraca/pull/4) | **Relatório:** `docs/features/F04/reports/eval-001.md`
- **Feature F05:** API de Parceiros (Validação e Check-in com Contrato Fixo)
  - **Status:** `COMPLETED`
  - **Entrega:** API REST de parceiros autenticada via `x-api-key` com contrato fixo estrito: `GET /api/partner/events`, `POST /api/partner/events/:id/purchases`, `GET /api/partner/tickets/:id`.
  - **PR:** [#5](https://github.com/LucasGauterio/catraca/pull/5) | **Relatório:** `docs/features/F05/reports/eval-001.md`

### Wave 4: Operações do Organizador & Encerramento
- **Feature F06:** Operações do Organizador (Check-in, Cancelamento com Estorno e Painel Unificado)
  - **Status:** `COMPLETED`
  - **Entrega:** Check-in operacional com mensagens literais `R10`, cancelamento irreversível com estorno em até 10s `R11` e painel unificado com todas as métricas operacionais e financeiras `R12`.
  - **PR:** [#6](https://github.com/LucasGauterio/catraca/pull/6) | **Relatório:** `docs/features/F06/reports/eval-001.md`

---

## 3. Rastreabilidade de Artefatos

Todos os requisitos e decisões encontram-se documentados e sincronizados:
- `docs/PRD.md` — Requisitos de Produto e Critérios de Aceite
- `docs/RFC.md` — Arquitetura Técnica e Decisões de Sistema
- `docs/FDD.md` — Especificação Detalhada de Features
- `docs/DESIGN_SYSTEM.md` — Primitives de UI, cores e acessibilidade
- `docs/adrs/` — ADRs 001, 002 e 003 (Stack, Concorrência e Gateway Assíncrono)
- `docs/TRACKER.md` — Matriz Bidirecional (Regras ↔ Código ↔ Testes)
- `docs/VALIDATION.md` — Relatório Final de Validação na `main`
