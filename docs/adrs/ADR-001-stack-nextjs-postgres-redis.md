# ADR-001: Stack Fullstack Next.js (App Router) + PostgreSQL 16 + Redis/BullMQ

## Status
Accepted

## Context
O brief exige subida em um único comando em máquinas com Linux/macOS, Docker, Git e Node.js LTS, além de vitrine web, área do organizador, API REST de parceiros com contrato fixo e processamento assíncrono de gateway de pagamento.

## Decision
Adotar **Next.js (App Router)** com TypeScript estrito, **PostgreSQL 16** com **Drizzle ORM (`pg`)**, e **Redis 7 + BullMQ** orquestrados via **Docker Compose** e scripts `npm` (`npm run up`, `npm run down`, `npm run gates`).

## Consequences
- Único endereço base (`http://localhost:3000`) serve `$WEB` e `$API` sem problemas de CORS.
- Drizzle ORM + `pg` elimina binários nativos frágeis entre Linux/macOS/Alpine e permite SQL explícito para `SELECT ... FOR UPDATE`.
- Worker BullMQ em container separado garante processamento assíncrono real, isolado do ciclo HTTP.
