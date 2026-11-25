# CONTEXT.md — Catraca MVP

- **Repositório:** `https://github.com/LucasGauterio/catraca`
- **Stack:** Next.js (App Router, TypeScript strict) + PostgreSQL 16 (Drizzle ORM + `pg`) + Redis 7 + BullMQ + Docker Compose.
- **Portas:** `$WEB` = `http://localhost:3000`, `$API` = `http://localhost:3000`.
- **Waves:**
  - Wave 1: `F01` (Harness, Infra, DB Schema, Seed, Auth/RBAC, LGPD Logger)
  - Wave 2 (Paralela): `F02` (Gestão de Eventos) + `F03` (Motor de Reservas `FOR UPDATE` + Gateway BullMQ)
  - Wave 3 (Paralela): `F04` (Vitrine + Meus Ingressos) + `F05` (API de Parceiros Contrato Fixo)
  - Wave 4: `F06` (Check-in R10 + Painel R12 + Cancelamento Irreversível R11)
- **Estado atual:** Consultar [docs/project-state.json](docs/project-state.json).
