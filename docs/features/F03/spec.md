# Spec — F03: Motor de Reservas Concorrentes e Gateway Simulado Assíncrono (BullMQ)

## Decisões Técnicas
- **Serviço Transacional de Compra (`src/lib/tickets/purchase.ts`):**
  - Valida `cardNumber` com regex `/^\d{16}$/` e `buyerEmail` válido ANTES de abrir transação ou criar ingresso (**R06** / Gateway).
  - Dentro de `db.transaction`:
    1. Executa `SELECT id, status, capacity, price_cents FROM events WHERE id = $1 FOR UPDATE`.
    2. Se não encontrado ou `status !== 'published'`, retorna erro tipado `event_not_available` (**R02**, **R11**).
    3. Executa `SELECT COUNT(*)::int AS occupied FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')` (**R05**).
    4. Se `occupied >= capacity`, retorna erro tipado `sold_out` (**R07**).
    5. Gera `ticketId = 'tkt_' + randomBytes(6).toString('hex')` e `code` único alfanumérico de 8 caracteres (`[A-Z2-9]`, sem ambiguidade, retry em colisão **R09**).
    6. Insere ingresso com `status = 'pending'`, `price_cents = event.price_cents` (**R03**), `channel` (`'web' | 'partner'`), `user_id` opcional.
  - Pós-`COMMIT`: enfileira job BullMQ na fila `payment-gateway` (`{ ticketId, cardLast4: cardNumber.slice(-4) }`, `jobId: ticketId`) sem aguardar processamento (**R06**).
- **Simulador de Gateway (`src/lib/gateway/simulator.ts`):**
  - Regras por `cardLast4`:
    - `0001`: `confirmed`, atraso aleatório entre `2000ms` e `5000ms`
    - `0002`: `declined`, atraso aleatório entre `2000ms` e `5000ms`
    - `0003`: `confirmed`, atraso aleatório entre `30000ms` e `40000ms`
    - `0004`: `declined`, atraso aleatório entre `30000ms` e `40000ms`
    - Qualquer outro: `declined`, atraso aleatório entre `2000ms` e `5000ms`
  - Escala opcional `GATEWAY_DELAY_SCALE` (default `1`) para acelerar testes automatizados mantendo o modo padrão oficial no Docker Compose.
- **Worker BullMQ (`src/worker/payment-processor.ts` + registro em `src/worker/index.ts`):**
  - Executa delay do simulador e aplica SQL condicional:
    `UPDATE tickets t SET status = $1, updated_at = NOW() FROM events e WHERE t.id = $2 AND t.event_id = e.id AND t.status = 'pending' AND e.status = 'published'`.
  - Garante que resposta tardia pós-cancelamento nunca altera `cancelled`/`refunded` (**R11**).
- **Consultas (`src/lib/tickets/queries.ts`):**
  - `getEventAvailableSeats(eventId)`: `0` se cancelado; senão `Math.max(0, capacity - occupied)` (**R05**).
  - `listPublishedEventsWithSeats()`: retorna eventos publicados e não cancelados com `availableSeats`.
  - `getTicketById(ticketId)`: retorna ingresso de qualquer canal (**R09**).
