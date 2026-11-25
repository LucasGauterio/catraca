# Spec — F05: API de Parceiros (Contrato Fixo)

## Decisões Técnicas
- **Autenticação de Parceiro (`src/lib/partner-auth.ts`):**
  - Lê cabeçalho `X-Api-Key`, calcula `SHA-256` hex e consulta `api_keys` (`active = true`).
  - Sem cabeçalho ou chave inválida → retorna imediatamente `401` com `{"error":"unauthorized"}`.
- **Rota 1 — `GET /api/partner/events` (`src/app/api/partner/events/route.ts`):**
  - Exige `X-Api-Key` (`401`).
  - Delega para `listPublishedEventsWithSeats()` (`F03`), retornando `200` com array JSON contendo exatamente:
    `{ id, name, startsAt, priceCents, availableSeats }`.
- **Rota 2 — `POST /api/partner/events/[eventId]/purchases` (`src/app/api/partner/events/[eventId]/purchases/route.ts`):**
  - Ordem estrita de verificação conforme `brief.md`:
    1. `X-Api-Key` → `401 {"error":"unauthorized"}`
    2. Parse JSON + validação `buyerEmail` (formato válido) e `cardNumber` (`/^\d{16}$/`) → `422 {"error":"invalid_request"}`
    3. `purchaseTicket(..., channel: 'partner', userId: null)`:
       - `event_not_available` (inexistente, `draft` ou `cancelled`) → `404 {"error":"event_not_available"}`
       - `sold_out` → `409 {"error":"sold_out"}`
    4. Sucesso → `202 {"ticketId":"...","code":"...","status":"pending"}`.
- **Rota 3 — `GET /api/partner/tickets/[ticketId]` (`src/app/api/partner/tickets/[ticketId]/route.ts`):**
  - Exige `X-Api-Key` (`401`).
  - Consulta `getTicketById(ticketId)` (funciona para ingressos da vitrine e da API).
  - Não encontrado → `404 {"error":"ticket_not_found"}`.
  - Encontrado → `200 {"ticketId":"...","code":"...","eventId":"...","status":"...","checkedIn":false}`.
