# Evaluation Report — F02 (`eval-001`)

## Metadata
- **Date (ISO-8601):** `2026-11-25T14:06:00Z`
- **Feature:** `F02` — Gestão de Eventos e Área do Organizador
- **Branch:** `feat/f02-events`
- **Evaluated Commit:** `ff98f552e0d8526d7fcfb0df8ef7c97e69496e7c`
- **Tool:** `Google Antigravity (AGY) — worker-evaluator`
- **Model:** `Gemini 4 Neon (Medium)`
- **Overall Verdict:** `APPROVED`

---

## Environment & Harness Gates

| Gate / Check | Command Executed | Objective Evidence | Verdict |
| --- | --- | --- | --- |
| **Environment Startup** | `npm run up` (in `E:\Projects\catraca-wt-f02`) | Exit code `0`; containers `postgres`, `redis`, `app`, `worker` healthy; migrations applied (`db_migrations_applied`); idempotent seed completed (`usersCount: 3`, `partnerApiKeySeeded: "[LGPD_REDACTED]"`). | **PASS** |
| **Healthcheck** | `GET http://localhost:3000/api/health` | `HTTP/1.1 200 OK` — `{"status":"ok","db":"connected","redis":"connected"}` | **PASS** |
| **Quality Gates** | `npm run gates` (in `E:\Projects\catraca-wt-f02`) | Exit code `0`: `tsc --noEmit` passed, `eslint src tests` passed, Vitest passed (`2 passed (2)`, `18 passed (18)`: `tests/f02-events.test.ts` 10 tests, `tests/f01-foundation.test.ts` 8 tests). | **PASS** |
| **Environment Teardown** | `npm run down` (in `E:\Projects\catraca-wt-f02`) | Exit code `0`: all containers and network `catraca-wt-f02_default` stopped and removed; port `3000` freed. | **PASS** |

---

## Contract Verification Summary (`docs/features/F02/contract.md`)

| Item ID | PRD Criterion | Command / Check Executed | Objective Evidence | Verdict |
| --- | --- | --- | --- | --- |
| **C-F02-1** | `AC-F02.1` (`R01`, `R02`) | Login as Organizador A (`organizador.a@catraca.local`); `POST /api/organizer/events` with future date (+30d), yesterday's date (-1d), `capacity: 0`, and `priceCents: 0`. | Future event created with `HTTP 201` (`id: "evt_62e573d580c8df67fdfcadf4"`, `status: "draft"`, `occupiedSeats: 0`, `availableSeats: 5`). Past date rejected with `HTTP 422` (`{"error":"invalid_input","message":"A data de início do evento deve estar no futuro."}`). `capacity: 0` and `priceCents: 0` also rejected with `HTTP 422`. | **PASS** |
| **C-F02-2** | `AC-F02.2` (`R02`, `R04`) | As Organizador A: `GET /organizer/events/{id}`, `POST /api/organizer/events/{id}/publish`, `PATCH /api/organizer/events/{id}` with valid updated fields (`name`, `startsAt`, `location`, `capacity: 4`, `priceCents: 12000`), and re-fetch `GET /organizer/events/{id}`. | Initial `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` returned `HTTP 200` containing `"Festival Catraca QA"`. `POST .../publish` returned `HTTP 200` with `"status":"published"`. `PATCH` returned `HTTP 200` with updated fields (`name: "Festival Catraca QA Editado"`, `location: "Arena Central Norte"`, `capacity: 4`, `priceCents: 12000`). Subsequent `GET /organizer/events/{id}` returned `HTTP 200` containing updated name and location. | **PASS** |
| **C-F02-3** | `AC-F02.3` (`R03`, `R05`) | Insert 2 `confirmed` tickets (`tkt_qa_01`, `tkt_qa_02`, `price_cents = 12000`) for `evt_62e573d580c8df67fdfcadf4` via `psql`; attempt `PATCH` with `capacity: 1`; then `PATCH` with `capacity: 3` and `priceCents: 15000`; query PostgreSQL `tickets` and `events`. | `PATCH` with `capacity: 1` rejected with `HTTP 409` (`{"error":"capacity_below_occupied","message":"A lotação não pode ser menor que o total de vagas ocupadas (2)."}`). `PATCH` with `capacity: 3, priceCents: 15000` accepted with `HTTP 200` (`occupiedSeats: 2`, `availableSeats: 1`). DB confirmed `events.price_cents = 15000` while both existing tickets (`tkt_qa_01`, `tkt_qa_02`) retained `price_cents = 12000`. | **PASS** |
| **C-F02-4** | `AC-F02.4`, `XF-01` (`R13`) | Authenticate as Organizador B (`organizador.b@catraca.local`), Participant (`participante@catraca.local`), and Unauthenticated Visitor; test `/api/organizer/events`, `/api/organizer/events/{id_de_A}`, `/organizer`, and `/organizer/events/{id_de_A}` (plus `PATCH` and `POST .../publish` as Org B). | Org B: `GET /api/organizer/events` returned `200 {"events":[]}`; `GET`/`PATCH`/`POST .../publish` on A's event returned `404 {"error":"not_found","message":"Evento não encontrado."}`; `GET /organizer/events/{id_de_A}` rendered `"Evento não encontrado"` with `leaks=[]`. Participant: API routes returned `403`, `/organizer` redirected `307 -> /`, `/organizer/events/{id_de_A}` rendered `"Acesso negado"` with `leaks=[]`. Visitor: API routes returned `401`, `/organizer` redirected `307 -> /login`, `/organizer/events/{id_de_A}` rendered `"Acesso negado"` with `leaks=[]`. Zero leakage across all actors. | **PASS** |

---

## Detailed Execution Evidence

### 1. `C-F02-1` — Criação de Evento e Validações (`R01`, `R02`)
- **Login Organizador A:**
  - `POST /api/auth/login` → `200` `{"user":{"id":"usr_organizer_a","name":"Organizador A","email":"organizador.a@catraca.local","role":"organizer"}}`
- **Criação com data futura (+30 dias):**
  - `POST /api/organizer/events` → `201`
  - Body: `{"event":{"id":"evt_62e573d580c8df67fdfcadf4","organizerId":"usr_organizer_a","name":"Festival Catraca QA","startsAt":"2026-12-25T14:04:11.694Z","location":"Arena Central","capacity":5,"priceCents":10000,"status":"draft","createdAt":"2026-11-25T14:04:11.704Z","updatedAt":"2026-11-25T14:04:11.704Z","occupiedSeats":0,"availableSeats":5}}`
- **Criação com data de ontem (-1 dia):**
  - `POST /api/organizer/events` → `422` `{"error":"invalid_input","message":"A data de início do evento deve estar no futuro."}`
- **Validações adicionais (`R01`):**
  - `capacity: 0` → `422` `{"error":"invalid_input","message":"A lotação máxima deve ser um número inteiro maior ou igual a 1."}`
  - `priceCents: 0` → `422` `{"error":"invalid_input","message":"O preço do ingresso deve ser maior que zero."}`

### 2. `C-F02-2` — Gestão, Edição e Publicação (`R02`, `R04`)
- **Página própria `/organizer/events/evt_62e573d580c8df67fdfcadf4` (antes da edição):**
  - `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` → `HTTP 200`, `CONTAINS_NAME ("Festival Catraca QA"): true`
- **Publicação:**
  - `POST /api/organizer/events/evt_62e573d580c8df67fdfcadf4/publish` → `200` `{"event":{"id":"evt_62e573d580c8df67fdfcadf4",...,"status":"published",...}}`
- **Edição válida:**
  - `PATCH /api/organizer/events/evt_62e573d580c8df67fdfcadf4` → `200` `{"event":{"id":"evt_62e573d580c8df67fdfcadf4","name":"Festival Catraca QA Editado","startsAt":"2027-01-09T14:04:34.980Z","location":"Arena Central Norte","capacity":4,"priceCents":12000,"status":"published","occupiedSeats":0,"availableSeats":4,...}}`
- **Página própria após edição:**
  - `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` → `HTTP 200`, `CONTAINS_EDITED_NAME ("Festival Catraca QA Editado"): true`, `CONTAINS_LOCATION ("Arena Central Norte"): true`

### 3. `C-F02-3` — Lotação vs. Vagas Ocupadas e Imutabilidade de Preço em Ingressos Emitidos (`R03`, `R05`)
- **Seed de 2 ingressos `confirmed` no PostgreSQL:**
  - `INSERT 0 2` (`tkt_qa_01`, `tkt_qa_02`, ambos com `price_cents = 12000`, `status = 'confirmed'`).
- **Tentativa de redução de lotação para `1` (< 2 ocupadas):**
  - `PATCH /api/organizer/events/evt_62e573d580c8df67fdfcadf4` (`capacity: 1`) → `409` `{"error":"capacity_below_occupied","message":"A lotação não pode ser menor que o total de vagas ocupadas (2)."}`
- **Atualização de lotação para `3` e preço para `15000`:**
  - `PATCH /api/organizer/events/evt_62e573d580c8df67fdfcadf4` (`capacity: 3, priceCents: 15000`) → `200` `{"event":{...,"capacity":3,"priceCents":15000,"status":"published","occupiedSeats":2,"availableSeats":1}}`
- **Verificação direta no PostgreSQL:**
```text
    id     |  status   | price_cents 
-----------+-----------+-------------
 tkt_qa_01 | confirmed |       12000
 tkt_qa_02 | confirmed |       12000
(2 rows)

              id              | capacity | price_cents |  status   
------------------------------+----------+-------------+-----------
 evt_62e573d580c8df67fdfcadf4 |        3 |       15000 | published
(1 row)
```

### 4. `C-F02-4` & `XF-01` — Isolamento Estrito entre Organizadores, Participante e Visitante (`R13`)
Tokens verificados para vazamento (`secretTokens`): `["Festival Catraca QA", "Arena Central Norte", "tkt_qa_01", "CAT-QA-0001"]`.

- **Organizador B (`organizador.b@catraca.local`):**
  - `GET /api/organizer/events` → `200` `{"events":[]}`, `leaks=[]`
  - `GET /organizer` → `200`, `leaks=[]`
  - `GET /api/organizer/events/evt_62e573d580c8df67fdfcadf4` → `404` `{"error":"not_found","message":"Evento não encontrado."}`, `leaks=[]`
  - `PATCH /api/organizer/events/evt_62e573d580c8df67fdfcadf4` → `404` `{"error":"not_found","message":"Evento não encontrado."}`, `leaks=[]`
  - `POST /api/organizer/events/evt_62e573d580c8df67fdfcadf4/publish` → `404` `{"error":"not_found","message":"Evento não encontrado."}`, `leaks=[]`
  - `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` → `200`, texto visível `"Evento não encontrado — O evento solicitado não existe ou você não tem permissão para gerenciá-lo."`, `leaks=[]`
- **Participante (`participante@catraca.local`):**
  - `GET /api/organizer/events` → `403` `{"error":"forbidden","message":"Acesso restrito a organizadores."}`, `leaks=[]`
  - `GET /api/organizer/events/evt_62e573d580c8df67fdfcadf4` → `403` `{"error":"forbidden","message":"Acesso restrito a organizadores."}`, `leaks=[]`
  - `GET /organizer` → `307` (`Location: /`), `leaks=[]`
  - `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` → `200`, texto visível `"Acesso negado — Você não tem permissão para acessar a gestão deste evento."`, `leaks=[]`
- **Visitante não autenticado:**
  - `GET /api/organizer/events` → `401` `{"error":"unauthorized","message":"Autenticação necessária."}`, `leaks=[]`
  - `GET /api/organizer/events/evt_62e573d580c8df67fdfcadf4` → `401` `{"error":"unauthorized","message":"Autenticação necessária."}`, `leaks=[]`
  - `GET /organizer` → `307` (`Location: /login`), `leaks=[]`
  - `GET /organizer/events/evt_62e573d580c8df67fdfcadf4` → `200`, texto visível `"Acesso negado — Você não tem permissão para acessar a gestão deste evento."`, `leaks=[]`

---

## Final Verdict
- **Overall Verdict:** `APPROVED`
- **Summary:** All 4 contract items (`C-F02-1` through `C-F02-4`, including cross-feature isolation `XF-01`), environment startup/teardown, healthcheck, and automated gates (`tsc`, `eslint`, `vitest`) passed with 100% conformance and zero defects observed.
