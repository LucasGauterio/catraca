# Requisição Consolidada Oficial — Catraca MVP

> Síntese oficial pós-Etapa 1.0 (Entrevista de Presunções concluída com 100% de definições fechadas). Substitui o prompt bruto como fonte única de verdade para todo o pipeline `agy-ensemble`.

## 1. Produto e Escopo
Construir do zero o MVP **Catraca** (venda de ingressos para eventos pequenos), atendendo integralmente às regras **R01 a R13**, ao **Gateway de Pagamento Simulado** (cartões de 16 dígitos, finais `0001`–`0004` e demais finais), ao **Contrato Fixo da API de Parceiros** (`/api/partner/*` com `X-Api-Key`) e aos **18 passos do Fluxo do Avaliador** descritos em `brief.md`.

## 2. Decisões Fechadas (Etapa 1.0)
- **Stack Técnica:** Fullstack **Next.js (App Router)** em TypeScript (`strict: true`, zero `any`) + **PostgreSQL 16** (via Drizzle ORM + `pg`) + **Redis 7 + BullMQ** em containers Docker Compose.
- **Repositório e Fluxo de PRs:** Repositório público no GitHub `https://github.com/LucasGauterio/catraca`, com entregas organizadas em waves e pelo menos uma wave paralela integrada via Pull Requests reais com timestamps de commits sobrepostos.
- **Concorrência (R07) e Gateway Assíncrono (R08/R11):**
  - R07 garantida por transação PostgreSQL com **Row-Level Lock** (`SELECT ... FOR UPDATE` na linha do evento) + contagem atômica de vagas ocupadas (`pending` + `confirmed`).
  - Gateway simulado assíncrono executado por **worker dedicado BullMQ sobre Redis**, com atraso configurável por variável de ambiente para testes locais e padrão oficial (`2–5s` para `0001`/`0002`/outros; `30–40s` para `0003`/`0004`) ativo por default.
- **Harness Mínimo (Comando Único):** Scripts `npm` na raiz (`npm run up`, `npm run down`, `npm run gates`) orquestrando Docker Compose, compatíveis com Linux, macOS e WSL sem depender de `make`.
- **NFR-0 e LGPD (Lei nº 13.709/2018):** Modo local self-contained — logs JSON estruturados com redação `[LGPD_REDACTED]` de PII (e-mail, senha, número de cartão), tabela ROPA documentada no RFC, sem segredos hardcoded (variáveis em `.env.example` com defaults seguros para clone limpo em 1 comando), mantendo 100% de fidelidade aos contratos do `brief.md`.
- **Avaliação Independente:** Cada feature (`F01`–`F06`) é implementada por um agente dedicado e avaliada por um agente independente (`worker-evaluator`) com contexto isolado, gerando relatórios imutáveis sob `docs/features/FNN/reports/`.
