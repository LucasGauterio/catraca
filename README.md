# Catraca — MVP de Venda de Ingressos

Plataforma de venda de ingressos para eventos pequenos construída em modo autônomo multi-agente (`agy-ensemble`) a partir de [brief.md](brief.md).

## Como Rodar

### Pré-requisitos
- **Docker** + **Docker Compose**
- **Git**
- **Node.js LTS** (v20+)

### Comandos do Harness
- **Subir tudo (clone limpo + seed automática):** `npm run up`
- **Derrubar tudo (containers e portas):** `npm run down`
- **Rodar gates (typecheck, lint e testes automatizados):** `npm run gates`

## Endereços
- **Produto (`$WEB`):** `http://localhost:3000`
- **API de Parceiros (`$API`):** `http://localhost:3000`

## Credenciais (Seed Idempotente)
- **Organizador A:** `organizador.a@catraca.local` / `SenhaOrgA!123`
- **Organizador B:** `organizador.b@catraca.local` / `SenhaOrgB!123`
- **Participante:** `participante@catraca.local` / `SenhaPart!123`
- **Chave da API de Parceiros (`$KEY`):** `catraca-partner-key-2026`

## Mapa dos Artefatos
- **Porta de entrada para agentes:** [AGENTS.md](AGENTS.md) ([CLAUDE.md](CLAUDE.md) aponta para `AGENTS.md`)
- **PRD:** [docs/PRD.md](docs/PRD.md)
- **Estado do projeto:** [docs/project-state.json](docs/project-state.json)
- **Arquitetura:** [docs/RFC.md](docs/RFC.md), [docs/FDD.md](docs/FDD.md), [docs/adrs/](docs/adrs/)
- **Features (spec, plano, contrato e relatórios):**
  - `F01`: [docs/features/F01/](docs/features/F01/)
  - `F02`: [docs/features/F02/](docs/features/F02/)
  - `F03`: [docs/features/F03/](docs/features/F03/)
  - `F04`: [docs/features/F04/](docs/features/F04/)
  - `F05`: [docs/features/F05/](docs/features/F05/)
  - `F06`: [docs/features/F06/](docs/features/F06/)
- **PRs das Waves Paralelas:** *(serão vinculados à medida que cada wave paralela for mergeada)*

## Decisões Técnicas
- **Stack:** Next.js (App Router, TypeScript strict) + PostgreSQL 16 (Drizzle ORM + `pg`) + Redis 7 + BullMQ em Docker Compose.
- **Garantia de R07 sob concorrência:** Lock exclusivo de linha (`SELECT ... FOR UPDATE`) na tabela `events` dentro de transação ACID antes da contagem de ingressos `pending + confirmed` e inserção do novo ingresso.
- **Gateway assíncrono:** Worker BullMQ dedicado em container separado sobre Redis, com atraso simulado por final de cartão (`0001`–`0004` e demais) e guarda SQL condicional (`WHERE t.status = 'pending' AND e.status = 'published'`) para impedir alteração pós-cancelamento (R11).
- **Avaliação independente:** Cada feature é avaliada por um subagente dedicado com contexto isolado (`worker-evaluator`), produzindo um relatório imutável por execução em `docs/features/FNN/reports/`.
