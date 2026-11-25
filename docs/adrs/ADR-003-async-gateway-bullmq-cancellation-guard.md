# ADR-003: Gateway Assíncrono (BullMQ) e Guarda contra Resposta Tardia (R11)

## Status
Accepted

## Context
Compras devem responder imediatamente como `pending` (R06), aguardar resposta assíncrona do gateway simulado (2–5s ou 30–40s conforme o final do cartão) e nunca ter seu status alterado por resposta tardia após cancelamento do evento (R11).

## Decision
1. Após commit do ingresso `pending`, enfileirar job na fila BullMQ `payment-gateway` com `jobId = ticketId`.
2. O cancelamento de evento executa em transação única com `FOR UPDATE` na linha do evento, marcando `events.status = 'cancelled'`, `tickets` `confirmed` → `refunded` e `pending` → `cancelled` (latência < 1s, muito abaixo do limite de 10s).
3. Ao concluir o delay, o worker BullMQ aplica `UPDATE tickets ... WHERE t.status = 'pending' AND e.status = 'published'`, descartando automaticamente qualquer resposta tardia.

## Consequences
- Zero race condition entre cancelamento e callback tardio (ex.: cartão `0003` após 45s permanece `cancelled`).
- Atraso configurável via `GATEWAY_DELAY_SCALE` para suítes de testes rápidas, mantendo `1` (padrão oficial) no Docker Compose.
