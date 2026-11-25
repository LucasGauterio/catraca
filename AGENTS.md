# Catraca — AGENTS.md (Porta de Entrada para Agentes)

Este documento é a porta de entrada oficial para qualquer agente que opere no repositório **Catraca** (MVP de venda de ingressos).

## Comandos do Harness Mínimo

| Ação | Comando | O que faz |
| --- | --- | --- |
| **Subir tudo** | `npm run up` | Sobe PostgreSQL 16, Redis 7, Next.js App (`http://localhost:3000`) e BullMQ Worker via Docker Compose, aguarda healthcheck, aplica migrations e executa seed idempotente. |
| **Derrubar tudo** | `npm run down` | Encerra e remove todos os containers e redes iniciados pelo projeto (`docker compose down --remove-orphans`), liberando todas as portas. |
| **Rodar gates** | `npm run gates` | Executa checagem de tipos TypeScript (`tsc --noEmit`), lint e suíte completa de testes automatizados (unitários + integração/concorrência). |

## Endereços e Credenciais da Seed (Ambiente Local)
- **Produto (`$WEB`):** `http://localhost:3000`
- **API de Parceiros (`$API`):** `http://localhost:3000`
- **Organizador A:** `organizador.a@catraca.local` / `SenhaOrgA!123`
- **Organizador B:** `organizador.b@catraca.local` / `SenhaOrgB!123`
- **Participante (seed):** `participante@catraca.local` / `SenhaPart!123`
- **Chave da API de Parceiros (`$KEY`):** `catraca-partner-key-2026`

## Regras Inegociáveis do Projeto
1. **Brief (`brief.md`) é lei:** Regras **R01 a R13**, contrato fixo da API de parceiros (`/api/partner/*`), comportamento do gateway simulado (finais `0001`–`0004` e demais) e mensagens exatas de check-in e vitrine.
2. **Concorrência (R07):** Toda compra DEVE passar pelo serviço transacional com `SELECT ... FOR UPDATE` na linha do evento. Nunca validar lotação fora de transação.
3. **Gateway Assíncrono & Cancelamento (R08/R11):** O worker BullMQ só atualiza ingressos com `status = 'pending'` cujo evento esteja `'published'`. Cancelamento é irreversível.
4. **Avaliação Independente:** Quem implementa uma feature NUNCA a avalia. Cada feature (`F01`–`F06`) é avaliada por agente com contexto isolado (`worker-evaluator`), gerando um relatório imutável em `docs/features/FNN/reports/` (nunca editado após commit).
5. **Qualidade & LGPD (NFR-0):** TypeScript `strict: true`, zero `any`, logs JSON estruturados com `[LGPD_REDACTED]` para PII e cartões (cartão nunca persistido em disco).
6. **Sincronia de Documentação:** `README.md` e `docs/project-state.json` devem refletir a realidade na branch `main`.

## Mapa dos Artefatos
- **Brief original:** [brief.md](brief.md)
- **Requisição Consolidada:** [docs/CONSOLIDATED_REQUEST.md](docs/CONSOLIDATED_REQUEST.md)
- **PRD (Features, Grafo, Waves e Critérios):** [docs/PRD.md](docs/PRD.md)
- **Arquitetura (RFC / FDD / Design System / ADRs):** [docs/RFC.md](docs/RFC.md), [docs/FDD.md](docs/FDD.md), [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md), `docs/adrs/`
- **Estado do Projeto:** [docs/project-state.json](docs/project-state.json)
- **Rastreabilidade & Validação:** [docs/TRACKER.md](docs/TRACKER.md), [docs/VALIDATION.md](docs/VALIDATION.md)
- **Specs, Planos, Contratos e Relatórios por Feature:**
  - `docs/features/F01/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
  - `docs/features/F02/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
  - `docs/features/F03/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
  - `docs/features/F04/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
  - `docs/features/F05/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
  - `docs/features/F06/` (`spec.md`, `plan.md`, `contract.md`, `reports/`)
