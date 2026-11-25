# Evaluation Report — F06 (`eval-001`)

| Field | Value |
| --- | --- |
| **Date (ISO-8601)** | `2026-11-25T18:49:00Z` |
| **Feature** | `F06` — Check-in, Painel de Gestão e Cancelamento Irreversível |
| **Branch** | `feat/f06-operations` |
| **Evaluated Commit** | `f3e2d30fa9de1a8784e5f86280240890a78a967f` |
| **Tool** | `Google Antigravity (AGY) — worker-evaluator` |
| **Model** | `Gemini 4 Neon (Medium)` |
| **Overall Verdict** | **APPROVED** |

---

## 1. Environment & Automated Gates

| Check | Command | Objective Evidence | Verdict |
| --- | --- | --- | --- |
| **Environment Up** | `npm run up` | Exit code `0`. Built `catraca-app:latest`, started `postgres-1`, `redis-1`, `app-1`, `worker-1`, applied migrations (`db_migrations_applied`) and idempotent seed (`usersCount: 3`, `partnerApiKeySeeded: "[LGPD_REDACTED]"`). | **PASS** |
| **Healthcheck** | `curl.exe -sS -i http://localhost:3000/api/health` | `HTTP/1.1 200 OK` — `{"status":"ok","db":"connected","redis":"connected"}`. | **PASS** |
| **Quality Gates** | `npm run gates` | Exit code `0`. `tsc --noEmit` (PASS), `eslint src tests` (PASS), `vitest run` (`6 passed (6)`, `64 passed (64)`, including `tests/f06-operations.test.ts (9 tests)`). | **PASS** |
| **Environment Down** | `npm run down` | Exit code `0`. Stopped and removed all containers (`app-1`, `worker-1`, `postgres-1`, `redis-1`) and network `catraca-wt-f06_default`. | **PASS** |

---

## 2. Contract Verification Matrix (`docs/features/F06/contract.md`)

### `C-F06-1` — Check-in Validation Matrix (`AC-F06.1`, `XF-12`, `XF-13`, `R10`)
- **PRD Criteria Mapped:** `AC-F06.1 (R10)`, `XF-12 (F04 → F06)`, `XF-13 (F05 → F06)`
- **Check Executed:**
  1. Authenticated as Organizador A (`organizador.a@catraca.local`), created and published `E1` (`evt_de92091e22b2de23ae489937`, `capacity: 2`, `priceCents: 10000`).
  2. Authenticated as Participant (`participante@catraca.local`), purchased ticket `C1` (`T6X36J58`, `tkt_3bfcf802fd9d`) via `POST /api/purchases` with card `4000000000000001`.
  3. Purchased ticket `C2` (`XKXK9GVW`, `tkt_83dbe2dd5e12`) via Partner API (`POST /api/partner/events/{E1}/purchases`, `X-Api-Key: catraca-partner-key-2026`) with fast-decline card `4000000000000002`. Waited 6s until `C1` became `confirmed` and `C2` became `declined`.
  4. Authenticated as Organizador B (`organizador.b@catraca.local`), created and published `E2` (`evt_96811228c604ae31e7fa3067`, `capacity: 1`, `priceCents: 2000`), purchased `C3` (`3595PC2U`, `tkt_9124fe37190f`) via Partner API (`4000000000000001`), waited 6s until `confirmed`.
  5. Executed `POST /api/organizer/events/{E1}/checkin` as Organizador A for `C1` (1st time), `C1` (2nd time), `C2` (declined), `ZZZZZZZZ` (nonexistent), and `C3` (belongs to `E2`). Also verified a `pending` ticket (`C5` = `5K7FJY4S` on `E3` before cancellation).
- **Objective Evidence:**
  - `C1` (1st time): `HTTP 200` `{"ok":true,"message":"Entrada liberada"}`
  - `C1` (2nd time): `HTTP 200` `{"ok":false,"message":"Ingresso já utilizado"}`
  - `C2` (declined): `HTTP 200` `{"ok":false,"message":"Ingresso não confirmado"}`
  - `C5` (pending, on `E3` pre-cancel): `HTTP 200` `{"ok":false,"message":"Ingresso não confirmado"}`
  - `ZZZZZZZZ` (nonexistent): `HTTP 200` `{"ok":false,"message":"Ingresso inválido para este evento"}`
  - `C3` (belongs to `E2`): `HTTP 200` `{"ok":false,"message":"Ingresso inválido para este evento"}`
- **Verdict:** **PASS**

---

### `C-F06-2` — Organizer Dashboard & Historical Revenue (`AC-F06.2`, `XF-10`, `XF-12`, `XF-13`, `R03`, `R05`, `R12`)
- **PRD Criteria Mapped:** `AC-F06.2 (R03, R05, R12)`, `XF-10 (F02 → F06)`, `XF-12 (F04 → F06)`, `XF-13 (F05 → F06)`
- **Check Executed:**
  1. On `E1` (`evt_de92091e22b2de23ae489937`, initially `capacity: 2`, `priceCents: 10000`), confirmed 1 storefront ticket (`C1`, `R$ 100,00`) and 1 Partner API ticket (`T3` = `tkt_18cec572770c`, `R$ 100,00`), plus 1 declined Partner API ticket (`T2`).
  2. Patched `E1` via `PATCH /api/organizer/events/{E1}` as Organizador A to `capacity: 3`, `priceCents: 15000` (`HTTP 200`, `occupiedSeats: 2`, `availableSeats: 1`).
  3. Purchased 1 more ticket (`T4` = `tkt_9ba59d70af7f`) via Partner API (`4000000000000001`), waited 6s until `confirmed`.
  4. Checked `GET /api/organizer/events/{E1}/dashboard` before and after checking in `C1`, and inspected SSR HTML of `GET /organizer/events/{E1}`.
- **Objective Evidence:**
  - Dashboard before check-in: `HTTP 200` `{"confirmed":3,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":35000,"revenueFormatted":"R$ 350,00","refunded":0}`
  - Dashboard after check-in of `C1`: `HTTP 200` `{"confirmed":3,"pending":0,"checkedIn":1,"availableSeats":0,"revenueCents":35000,"revenueFormatted":"R$ 350,00","refunded":0}`
  - UI `GET /organizer/events/evt_de92091e22b2de23ae489937`: `HTTP 200` containing `Confirmados`, `Estornados`, and `350,00`.
- **Verdict:** **PASS**

---

### `C-F06-3` — Irreversible Cancellation & Late Gateway Guard (`AC-F06.3`, `XF-10`, `XF-11`, `XF-12`, `XF-13`, `R11`)
- **PRD Criteria Mapped:** `AC-F06.3 (R11)`, `XF-10 (F02 → F06)`, `XF-11 (F03 → F06)`, `XF-12 (F04 → F06)`, `XF-13 (F05 → F06)`
- **Check Executed:**
  1. Created and published `E3` (`evt_b50de4bfdc81ea44c3b00624`, `capacity: 5`, `priceCents: 5000`) as Organizador A.
  2. Purchased `T5` (`tkt_efd87eb48029`, code `5K7FJY4S`) with slow-approve card `4000000000000003` (30–40s) and `T6` (`tkt_4c66eb3adfc7`, code `X2FPN92A`) with fast-approve card `4000000000000001` via Partner API.
  3. At `t = 6.0s`, verified `T6` was `confirmed` while `T5` was still `pending`.
  4. Cancelled `E3` via `POST /api/organizer/events/{E3}/cancel` at `t = 6.1s` (response time `10ms`, well below the 10s limit).
  5. Immediately verified storefront absence (`GET /`), Partner API absence (`GET /api/partner/events`), Partner purchase rejection (`POST /api/partner/events/{E3}/purchases`), edit rejection (`PATCH /api/organizer/events/{E3}`), re-publish rejection (`POST /api/organizer/events/{E3}/publish`), ticket statuses (`T6` → `refunded`, `T5` → `cancelled`), check-in on `E3` with `C6` (`Evento cancelado`), and `E3` dashboard.
  6. Waited until `t = 46.0s` (past the 30–40s gateway window) and re-checked `GET /api/partner/tickets/{T5}` and BullMQ worker logs.
- **Objective Evidence:**
  - Pre-cancel (`t = 6.0s`): `T5` `status: "pending"`, `T6` `status: "confirmed"`.
  - `POST /api/organizer/events/evt_b50de4bfdc81ea44c3b00624/cancel` (`10ms`, `t = 6.1s`): `HTTP 200` `{"status":"cancelled","refundedCount":1,"cancelledCount":1}`
  - `GET /`: `HTTP 200`, `E3` ID and unique name absent (`true`).
  - `GET /api/partner/events`: `HTTP 200`, `E3` absent (`true`).
  - `POST /api/partner/events/evt_b50de4bfdc81ea44c3b00624/purchases`: `HTTP 404` `{"error":"event_not_available"}`
  - `PATCH /api/organizer/events/evt_b50de4bfdc81ea44c3b00624`: `HTTP 409` `{"error":"event_cancelled","message":"Eventos cancelados não podem ser editados."}`
  - `POST /api/organizer/events/evt_b50de4bfdc81ea44c3b00624/publish`: `HTTP 409` `{"error":"event_cancelled","message":"Eventos cancelados não podem ser publicados."}`
  - Immediate `GET /api/partner/tickets/tkt_4c66eb3adfc7` (`T6`): `HTTP 200` `{"ticketId":"tkt_4c66eb3adfc7","code":"X2FPN92A","eventId":"evt_b50de4bfdc81ea44c3b00624","status":"refunded","checkedIn":false}`
  - Immediate `GET /api/partner/tickets/tkt_efd87eb48029` (`T5`): `HTTP 200` `{"ticketId":"tkt_efd87eb48029","code":"5K7FJY4S","eventId":"evt_b50de4bfdc81ea44c3b00624","status":"cancelled","checkedIn":false}`
  - `POST /api/organizer/events/evt_b50de4bfdc81ea44c3b00624/checkin` (`C6`): `HTTP 200` `{"ok":false,"message":"Evento cancelado"}`
  - `GET /api/organizer/events/evt_b50de4bfdc81ea44c3b00624/dashboard`: `HTTP 200` `{"confirmed":0,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":0,"revenueFormatted":"R$ 0,00","refunded":1}`
  - Post-45s `GET /api/partner/tickets/tkt_efd87eb48029` (`T5`, `t = 46.0s`): `HTTP 200` `{"ticketId":"tkt_efd87eb48029","code":"5K7FJY4S","eventId":"evt_b50de4bfdc81ea44c3b00624","status":"cancelled","checkedIn":false}`
  - Worker log confirming late approval ignored by R11 guard:
    `{"timestamp":"2026-11-25T18:48:21.824Z","level":"info","message":"payment_job_ignored_by_guard","meta":{"ticketId":"tkt_efd87eb48029","cardLast4":"0003","outcome":"confirmed","delayMs":36752,"reason":"ticket_not_pending_or_event_not_published"}}`
  - UI `GET /organizer/events/evt_b50de4bfdc81ea44c3b00624`: `HTTP 200` rendering `Cancelado` and `Evento cancelado`.
- **Verdict:** **PASS**

---

### `C-F06-4` — Organizer Isolation & Authorization (`XF-05`, `R13`)
- **PRD Criteria Mapped:** `XF-05 (F01 → F06)`, `R13`
- **Check Executed:** Attempted `GET /dashboard`, `POST /checkin`, and `POST /cancel` on Organizador A's event `E1` (`evt_de92091e22b2de23ae489937`) as Organizador B, seed Participant, and unauthenticated Visitor.
- **Objective Evidence:**
  - **Organizador B** (`organizador.b@catraca.local`):
    - `GET /api/organizer/events/evt_de92091e22b2de23ae489937/dashboard` → `HTTP 404` `{"error":"not_found","message":"Evento não encontrado."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/checkin` → `HTTP 404` `{"error":"not_found","message":"Evento não encontrado."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/cancel` → `HTTP 404` `{"error":"not_found","message":"Evento não encontrado."}`
  - **Participant** (`participante@catraca.local`):
    - `GET /api/organizer/events/evt_de92091e22b2de23ae489937/dashboard` → `HTTP 403` `{"error":"forbidden","message":"Acesso restrito a organizadores."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/checkin` → `HTTP 403` `{"error":"forbidden","message":"Acesso restrito a organizadores."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/cancel` → `HTTP 403` `{"error":"forbidden","message":"Acesso restrito a organizadores."}`
  - **Unauthenticated Visitor**:
    - `GET /api/organizer/events/evt_de92091e22b2de23ae489937/dashboard` → `HTTP 401` `{"error":"unauthorized","message":"Autenticação necessária."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/checkin` → `HTTP 401` `{"error":"unauthorized","message":"Autenticação necessária."}`
    - `POST /api/organizer/events/evt_de92091e22b2de23ae489937/cancel` → `HTTP 401` `{"error":"unauthorized","message":"Autenticação necessária."}`
  - Zero event data (`Eval F06 Event E1`, `35000`, ticket codes) leaked in any response body.
- **Verdict:** **PASS**

---

## 3. Summary & Conclusion
All 4 contract items (`C-F06-1`, `C-F06-2`, `C-F06-3`, `C-F06-4`) and all automated quality gates (`tsc`, `eslint`, `vitest`: 64/64 tests) passed with objective live execution evidence against the Docker Compose stack. **Overall Verdict: APPROVED.**
