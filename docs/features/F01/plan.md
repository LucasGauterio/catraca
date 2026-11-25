# Plan — F01: Plataforma, Harness, Banco de Dados, Seed e Autenticação

1. Inicializar `package.json`, `tsconfig.json` (`strict: true`), `next.config.ts`, `vitest.config.ts`, `eslint.config.mjs` e estrutura `src/`.
2. Criar `src/db/schema.ts` (tabelas `users`, `sessions`, `events`, `tickets`, `api_keys`), `src/db/index.ts`, `src/db/migrate.ts` (SQL idempotente `CREATE TABLE IF NOT EXISTS` + índices) e `src/db/seed.ts`.
3. Criar `src/lib/logger.ts` (redação `[LGPD_REDACTED]`), `src/lib/auth.ts` (scrypt + sessões + guards RBAC) e `src/lib/queue.ts` (conexão Redis/BullMQ).
4. Criar `src/worker/index.ts` (bootstrap do worker BullMQ pronto para receber processadores de pagamento na F03).
5. Criar rotas `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` e páginas `/`, `/login`, `/register`, `/organizer` (guard inicial R13).
6. Criar `Dockerfile`, `docker-compose.yml`, `.env.example` e scripts `scripts/up.mjs`, `scripts/down.mjs`, `scripts/gates.mjs`.
7. Escrever testes automatizados em `tests/f01-foundation.test.ts` (logger redaction, hashing, seed idempotency, auth guards) e validar `npm run up`, `npm run gates`, `npm run down` + segundo `npm run up`.
