# Spec — F01: Plataforma, Harness, Banco de Dados, Seed e Autenticação

## Decisões Técnicas
- **Framework:** Next.js 15 (App Router, TypeScript `strict: true`, Tailwind CSS).
- **Banco de Dados:** PostgreSQL 16 + `pg` + `drizzle-orm` (schema central em `src/db/schema.ts`, cliente em `src/db/index.ts`, migrations SQL aplicadas automaticamente via `src/db/migrate.ts`).
- **Fila:** Redis 7 + `bullmq` (conexão base em `src/lib/queue.ts`, container `worker` rodando `src/worker/index.ts`).
- **Docker Compose:** Serviços `postgres`, `redis`, `app` (porta `3000`, healthcheck `/api/health`) e `worker` (build compartilhado com entrypoint dedicado do worker).
- **Harness Scripts (`package.json`):**
  - `npm run up` → `node scripts/up.mjs` (sobe `docker compose up -d --build`, aguarda `/api/health` responder `200`, aplica migrations e roda seed idempotente dentro do container `app`).
  - `npm run down` → `node scripts/down.mjs` (executa `docker compose down --remove-orphans`, garantindo que nenhum container do projeto fique ativo e nenhuma porta fique aberta).
  - `npm run gates` → `node scripts/gates.mjs` (roda `tsc --noEmit`, `npm run lint` e `npm test` usando `vitest`).
- **Autenticação & RBAC (`src/lib/auth.ts`):**
  - Hash `scrypt` (`node:crypto`) + `timingSafeEqual`.
  - Sessões na tabela `sessions` com cookie `catraca_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`).
  - Rotas: `POST /api/auth/register` (sempre cria `role = 'participant'`), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - Páginas: `/login`, `/register`, navbar global com estado de sessão e links contextuais (`Vitrine`, `Meus ingressos`, `Área do Organizador`, `Entrar`/`Sair`).
  - Guard `requireOrganizer()` / `requireParticipant()` para rotas de API e Server Components (base de **R13**).
- **Seed Idempotente (`src/db/seed.ts`):**
  - `ON CONFLICT (email) DO UPDATE` para Organizador A (`organizador.a@catraca.local` / `SenhaOrgA!123`), Organizador B (`organizador.b@catraca.local` / `SenhaOrgB!123`), Participante (`participante@catraca.local` / `SenhaPart!123`).
  - `ON CONFLICT (key_hash) DO NOTHING` para Partner API Key (`catraca-partner-key-2026`).
- **Logger LGPD (`src/lib/logger.ts`):** JSON estruturado em stdout substituindo chaves sensíveis (`password`, `cardNumber`, `email`, `buyerEmail`, `apiKey`, `token`) por `[LGPD_REDACTED]`.
