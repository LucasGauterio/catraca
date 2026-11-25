# Spec — F06: Check-in, Painel de Gestão e Cancelamento Irreversível

## Decisões Técnicas
- **Serviço de Operações do Organizador (`src/lib/events/operations.ts`):**
  1. **Check-in (`performCheckIn(organizerId, eventId, code)` — R10, R13):**
     - Verifica propriedade do evento (`event.organizer_id === organizerId`); senão `404`.
     - Dentro de transação `FOR UPDATE` na linha do evento e do ingresso:
       1. Busca ingresso por `code` (case-insensitive trim ou exato em maiúsculo). Se não existir ou `ticket.event_id !== eventId` → retorna `{ ok: false, message: "Ingresso inválido para este evento" }`.
       2. Se `event.status === 'cancelled'` → retorna `{ ok: false, message: "Evento cancelado" }`.
       3. Se `ticket.status !== 'confirmed'` → retorna `{ ok: false, message: "Ingresso não confirmado" }`.
       4. Se `ticket.checked_in === true` → retorna `{ ok: false, message: "Ingresso já utilizado" }`.
       5. Atualiza `checked_in = true, checked_in_at = NOW()` e retorna `{ ok: true, message: "Entrada liberada" }`.
  2. **Painel (`getEventDashboard(organizerId, eventId)` — R12, R03, R05, R13):**
     - Agrega sobre TODOS os ingressos do evento (vitrine + API):
       - `confirmed`: `COUNT(*) WHERE status = 'confirmed'`
       - `pending`: `COUNT(*) WHERE status = 'pending'`
       - `checkedIn`: `COUNT(*) WHERE status = 'confirmed' AND checked_in = true`
       - `availableSeats`: `event.status === 'cancelled' ? 0 : Math.max(0, event.capacity - (confirmed + pending))`
       - `revenueCents`: `COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)`
       - `refunded`: `COUNT(*) WHERE status = 'refunded'`
  3. **Cancelamento Irreversível (`cancelEvent(organizerId, eventId)` — R11, R13):**
     - Transação `SELECT ... FROM events WHERE id = $1 FOR UPDATE`.
     - Verifica propriedade e que `status === 'published'`.
     - Atualiza `events SET status = 'cancelled', updated_at = NOW()`.
     - Atualiza `tickets SET status = 'refunded', updated_at = NOW() WHERE event_id = $1 AND status = 'confirmed'`.
     - Atualiza `tickets SET status = 'cancelled', updated_at = NOW() WHERE event_id = $1 AND status = 'pending'`.
     - Efeito imediato (< 1s, bem abaixo do limite de 10s). Resposta tardia do worker BullMQ (`F03`) é bloqueada pelo `WHERE t.status = 'pending' AND e.status = 'published'`.
- **Rotas de API (`src/app/api/organizer/events/[id]/...`):**
  - `GET /api/organizer/events/[id]/dashboard`
  - `POST /api/organizer/events/[id]/checkin` (`{ code }`)
  - `POST /api/organizer/events/[id]/cancel`
- **Integração na UI `/organizer/events/[id]`:**
  - Painel com os 6 cards: **Confirmados**, **Pendentes**, **Check-ins**, **Vagas disponíveis**, **Receita** (`R$ X,XX`) e **Estornados**.
  - Seção de Check-in com campo de código e exibição da mensagem exata retornada por R10 (ou exibição direta de `Evento cancelado` / tratamento na lista quando cancelado).
  - Botão "Cancelar evento" (somente quando `published`), removendo/desabilitando o formulário de edição e republicação após o cancelamento (**R11**).
