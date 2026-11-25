# Catraca — MVP de Venda de Ingressos

Plataforma de venda de ingressos para eventos pequenos construída do zero em modo autônomo multi-agente (`agy-ensemble`) a partir de [brief.md](brief.md), com especificações conectadas, entregas em waves paralelas via Pull Requests e avaliação independente por feature.

---

## Como Rodar

### Pré-requisitos
- **Docker** + **Docker Compose**
- **Git**
- **Node.js LTS** (v20+)

### Comandos do Harness
Os scripts `npm run up` e `npm run down` utilizam exclusivamente módulos nativos do Node.js (zero dependências npm prévias), funcionando diretamente a partir de um clone limpo:

| Ação | Comando | Descrição |
| --- | --- | --- |
| **Subir tudo** | `npm run up` | Sobe PostgreSQL 16, Redis 7, Next.js App e BullMQ Worker via Docker Compose, aguarda `GET /api/health`, aplica migrations e executa a seed idempotente. |
| **Derrubar tudo** | `npm run down` | Encerra e remove todos os containers e redes iniciados pelo projeto (`docker compose down --remove-orphans`), liberando todas as portas. |
| **Rodar gates** | `npm run gates` | Instala dependências se necessário (`npm ci`), roda `tsc --noEmit` (`strict: true`), `eslint src tests` (`no-explicit-any`) e a suíte completa de testes automatizados (`vitest run`). |

> **Variáveis de ambiente (`.env.example`):** Todas possuem defaults locais seguros em `docker-compose.yml` para permitir subida limpa em 1 comando sem nenhuma chave externa de pagamento (`DATABASE_URL`, `REDIS_URL`, `GATEWAY_DELAY_SCALE=1`, `PARTNER_API_KEY=catraca-partner-key-2026`).

---

## Endereços
- **Produto (`$WEB`):** `http://localhost:3000`
- **API de Parceiros (`$API`):** `http://localhost:3000`

### Rotas Principais
- **Vitrine Pública:** `/`
- **Autenticação:** `/login`, `/register`
- **Meus Ingressos (Participante):** `/my-tickets`
- **Área do Organizador:** `/organizer` e `/organizer/events/[id]`
- **API de Parceiros (Contrato Fixo):**
  - `GET /api/partner/events`
  - `POST /api/partner/events/{eventId}/purchases`
  - `GET /api/partner/tickets/{ticketId}`

---

## Credenciais (Seed Idempotente)
- **Organizador A:** `organizador.a@catraca.local` / `SenhaOrgA!123`
- **Organizador B:** `organizador.b@catraca.local` / `SenhaOrgB!123`
- **Participante (seed):** `participante@catraca.local` / `SenhaPart!123`
- **Chave da API de Parceiros (`$KEY`):** `catraca-partner-key-2026`

---

## Mapa dos Artefatos
- **Porta de entrada para agentes:** [AGENTS.md](AGENTS.md) ([CLAUDE.md](CLAUDE.md) aponta para `AGENTS.md`)
- **PRD (Features, Grafo, Waves e Critérios R01–R13):** [docs/PRD.md](docs/PRD.md)
- **Estado do Projeto:** [docs/project-state.json](docs/project-state.json)
- **Arquitetura e Decisões:** [docs/RFC.md](docs/RFC.md), [docs/FDD.md](docs/FDD.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), [docs/adrs/](docs/adrs/)
- **Rastreabilidade & Validação:** [docs/TRACKER.md](docs/TRACKER.md), [docs/VALIDATION.md](docs/VALIDATION.md)

### Features (Spec, Plano, Contrato e Relatórios Imutáveis)
| Feature | Wave | Pasta | Relatório Mais Recente | PR |
| --- | --- | --- | --- | --- |
| **F01** — Plataforma, Harness, DB, Seed e Auth | Wave 1 | [docs/features/F01/](docs/features/F01/) | [eval-20261125-1040.md](docs/features/F01/reports/eval-20261125-1040.md) | [PR #1](https://github.com/LucasGauterio/catraca/pull/1) |
| **F02** — Gestão de Eventos e Área do Organizador | Wave 2 (paralela) | [docs/features/F02/](docs/features/F02/) | [eval-001.md](docs/features/F02/reports/eval-001.md) | [PR #3](https://github.com/LucasGauterio/catraca/pull/3) |
| **F03** — Motor de Reservas Concorrentes e Gateway BullMQ | Wave 2 (paralela) | [docs/features/F03/](docs/features/F03/) | [eval-001.md](docs/features/F03/reports/eval-001.md) | [PR #2](https://github.com/LucasGauterio/catraca/pull/2) |
| **F04** — Vitrine Pública e Meus Ingressos | Wave 3 (paralela) | [docs/features/F04/](docs/features/F04/) | [eval-001.md](docs/features/F04/reports/eval-001.md) | [PR #4](https://github.com/LucasGauterio/catraca/pull/4) |
| **F05** — API de Parceiros (Contrato Fixo) | Wave 3 (paralela) | [docs/features/F05/](docs/features/F05/) | [eval-001.md](docs/features/F05/reports/eval-001.md) | [PR #5](https://github.com/LucasGauterio/catraca/pull/5) |
| **F06** — Check-in, Painel e Cancelamento Irreversível | Wave 4 | [docs/features/F06/](docs/features/F06/) | [eval-001.md](docs/features/F06/reports/eval-001.md) | [PR #6](https://github.com/LucasGauterio/catraca/pull/6) |

### PRs das Waves Paralelas
- **Wave 2 (Paralela — `F02` + `F03` em git worktrees simultâneas):**
  - [PR #2 — feat(F03): Motor de Reservas Concorrentes e Gateway Simulado Assíncrono (BullMQ)](https://github.com/LucasGauterio/catraca/pull/2)
  - [PR #3 — feat(F02): Gestão de Eventos e Área do Organizador](https://github.com/LucasGauterio/catraca/pull/3)
- **Wave 3 (Paralela — `F04` + `F05` em git worktrees simultâneas):**
  - [PR #4 — feat(F04): Vitrine Pública e Área do Participante (Meus Ingressos)](https://github.com/LucasGauterio/catraca/pull/4)
  - [PR #5 — feat(F05): API de Parceiros (Contrato Fixo)](https://github.com/LucasGauterio/catraca/pull/5)

---

## Decisões Técnicas
- **Stack (`ADR-001`):** **Next.js 15 (App Router, TypeScript `strict: true`) + PostgreSQL 16 (Drizzle ORM + `pg`) + Redis 7 + BullMQ** em Docker Compose. Um único endereço (`http://localhost:3000`) serve `$WEB` e `$API` sem fricção de CORS; Drizzle + `pg` evita binários nativos frágeis entre Linux/macOS/Alpine e expõe controle SQL direto para locks transacionais.
- **Garantia de R07 sob Concorrência (`ADR-002`):** Tanto a vitrine (`POST /api/purchases`) quanto a API de parceiros (`POST /api/partner/events/{eventId}/purchases`) chamam o mesmo serviço transacional `purchaseTicket()` (`src/lib/tickets/purchase.ts`), que adquire lock exclusivo na linha do evento (`SELECT ... FROM events WHERE id = $1 FOR UPDATE`), conta ingressos com `status IN ('pending', 'confirmed')` dentro da transação ACID, rejeita com `sold_out` se `occupied >= capacity` e só insere o ingresso `pending` antes do `COMMIT`.
- **Gateway Assíncrono e Guarda Pós-Cancelamento (`ADR-003`):** Após o `COMMIT`, um job é enfileirado na fila BullMQ `payment-gateway` (`jobId = ticketId`, passando apenas `cardLast4` — número do cartão nunca é persistido em disco nem em logs). O container `worker` (`concurrency: 20`) simula os atrasos oficiais (`0001`/`0002`/outros: 2–5s; `0003`/`0004`: 30–40s; configurável via `GATEWAY_DELAY_SCALE` para testes locais, padrão `1`) e atualiza o ingresso com guarda SQL condicional `WHERE t.status = 'pending' AND e.status = 'published'`, garantindo que respostas tardias nunca alterem ingressos `cancelled`/`refunded` após cancelamento (R11).
- **Isolamento da Avaliação Independente:** Cada feature (`F01`–`F06`) foi implementada por um subagente `catraca-implementer` em sua própria git worktree/branch e posteriormente avaliada por um subagente `worker-evaluator` recém-instanciado (contexto zerado, proibido de alterar código-fonte), que executou o contrato contra o ambiente real e commitou um relatório imutável em `docs/features/FNN/reports/` antes do merge do PR.
