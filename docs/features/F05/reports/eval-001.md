# Evaluation Report — F05: API de Parceiros (Contrato Fixo)

- **Date:** `2026-11-25T18:38:00Z`
- **Feature:** `F05` — API de Parceiros (Contrato Fixo)
- **Branch:** `feat/f05-partner-api`
- **Evaluated Commit:** `1a071ebc9a050d1ee3d24f663a94aa36906c4abf`
- **Tool:** `Google Antigravity (AGY) — worker-evaluator`
- **Model:** `Gemini 4 Neon (Medium)`
- **Overall Verdict:** `APPROVED`

---

## Pré-requisitos e Quality Gates

| Check | Command | Objective Evidence | Verdict |
| --- | --- | --- | --- |
| **Environment Up & Healthcheck** | `npm run up` + `curl.exe -i http://localhost:3000/api/health` | Docker Compose stack (`postgres`, `redis`, `app`, `worker`) healthy; migrations & idempotent seed applied; `GET /api/health` returned `HTTP/1.1 200 OK` with `{"status":"ok","db":"connected","redis":"connected"}`. | **PASS** |
| **Static & Automated Gates** | `npm run gates` | Exit code `0`: `tsc --noEmit` PASS, `eslint src tests` PASS, `vitest run` PASS (`4 passed (4)`, `47 passed (47)`, including `tests/f05-partner-api.test.ts` with 17 tests). | **PASS** |
| **Environment Teardown** | `npm run down` | Exit code `0`: all containers (`app`, `worker`, `redis`, `postgres`) and network `catraca-wt-f05_default` stopped and removed cleanly. | **PASS** |

---

## Contract Verification Matrix

| Item ID | PRD Criterion Mapped | Command / Check Executed | Objective Evidence | Verdict |
| --- | --- | --- | --- | --- |
| **C-F05-1** | `AC-F05.1`, `XF-04` | Called all 3 partner routes (`GET /api/partner/events`, `POST /api/partner/events/any/purchases`, `GET /api/partner/tickets/any`) both without `X-Api-Key` and with `X-Api-Key: wrong-key` (including `POST` with invalid `{}` body to confirm `401` before `422`), then called `GET /api/partner/events` with `X-Api-Key: catraca-partner-key-2026`. | All 6 unauthenticated/invalid-key requests returned `HTTP 401` with exact body `{"error":"unauthorized"}`. Authenticated `GET /api/partner/events` with `$KEY` returned `HTTP 200` with JSON array (`count: 3`). | **PASS** |
| **C-F05-2** | `AC-F05.2`, `XF-08` (`R02`, `R05`) | Logged in as Organizador A (`organizador.a@catraca.local`), created a draft event (`evt_c4fb4388b2e844cf5dc5f88e`) and a published event (`evt_7bbbcdc9260ff0fb3fe80bb1`, `capacity: 2`, `priceCents: 10000`). Called `GET /api/partner/events` with `$KEY` and `POST /api/partner/events/{draftId}/purchases` with valid body. | Draft event did NOT appear in `GET /api/partner/events` (`draftAppearsInPartnerList: false`). Published event appeared with exact keys `["availableSeats","id","name","priceCents","startsAt"]`: `{"id":"evt_7bbbcdc9260ff0fb3fe80bb1","name":"Eval F05 Published Event","startsAt":"2027-06-02T20:00:00.000Z","priceCents":10000,"availableSeats":2}`. Purchase on draft returned `HTTP 404` with exact body `{"error":"event_not_available"}`. | **PASS** |
| **C-F05-3** | `AC-F05.3`, `XF-09` (`R06`, `R07`, `R08`) | (1) `POST /api/partner/events/evt_nonexistent_check_order/purchases` with `cardNumber: "123"` and with invalid email (`422` before `404`); (2) valid body on nonexistent event (`404`); (3) valid purchase with `4000000000000002` (fast decline 2–5s) on capacity-2 published event, checking immediate seat decrement and release after 6.5s; (4) created 2 fresh published capacity-5 events (`E4`: `evt_5dfcbe9fdc69b99f6fc33fd6`, `E5`: `evt_3fe7931de00ba916f3a2488c`) and fired 30 concurrent `POST` requests (`4000000000000001`) against each via `Promise.all`. | (1) Invalid card & invalid email on nonexistent event both returned `HTTP 422` `{"error":"invalid_request"}` (`422` before `404` confirmed). (2) Valid body on nonexistent event returned `HTTP 404` `{"error":"event_not_available"}`. (3) Fast-decline purchase returned `HTTP 202` `{"ticketId":"tkt_c79563e32f97","code":"K8YGWXB8","status":"pending"}`; `availableSeats` immediately dropped `2 -> 1`; after 6.5s, `GET /api/partner/tickets/tkt_c79563e32f97` returned `status: "declined"` and `availableSeats` returned to `2`. (4) Round 1 (`E4`): **5x `HTTP 202`**, **25x `HTTP 409` `{"error":"sold_out"}`**, `0` other, `availableSeats: 0`. Round 2 (`E5`): **5x `HTTP 202`**, **25x `HTTP 409` `{"error":"sold_out"}`**, `0` other, `availableSeats: 0`. | **PASS** |
| **C-F05-4** | `AC-F05.4` (`R09`) | Called `GET /api/partner/tickets/tkt_nonexistent` and `GET /api/partner/tickets/tkt_ccec0cf8335c` (partner-bought ticket from `E4` after 6.5s worker confirmation) with `$KEY`. Also inspected `src/app/api/partner/tickets/[ticketId]/route.ts` to verify no channel filter restricts web storefront tickets. | Nonexistent ticket returned `HTTP 404` with exact body `{"error":"ticket_not_found"}`. Existing ticket returned `HTTP 200` with exact keys `["checkedIn","code","eventId","status","ticketId"]`: `{"ticketId":"tkt_ccec0cf8335c","code":"5BDZALGL","eventId":"evt_5dfcbe9fdc69b99f6fc33fd6","status":"confirmed","checkedIn":false}`. Route delegates to channel-agnostic `getTicketById(ticketId)` (covered for both `web` and `partner` channels in `tests/f05-partner-api.test.ts`). | **PASS** |

---

## Summary

All 4 contract verification items (`C-F05-1` through `C-F05-4`), all cross-feature integrations (`XF-04`, `XF-08`, `XF-09`), and all quality gates (`npm run up`, `npm run gates`, `npm run down`) passed with 100% conformance against the live Docker Compose stack and fixed Partner API contract. No defects or contract deviations were found.

**Verdict:** `APPROVED`
