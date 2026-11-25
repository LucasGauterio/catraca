# Plan — F03: Motor de Reservas Concorrentes e Gateway Simulado Assíncrono (BullMQ)

1. Implementar `src/lib/gateway/simulator.ts` com a tabela exata de cartões (`0001`–`0004` e demais) e suporte a `GATEWAY_DELAY_SCALE`.
2. Implementar `src/lib/tickets/purchase.ts` com validação de 16 dígitos, transação `SELECT ... FOR UPDATE`, geração de código único (R09), snapshot de `price_cents` (R03) e enfileiramento BullMQ.
3. Implementar `src/lib/tickets/queries.ts` (`getEventAvailableSeats`, `listPublishedEventsWithSeats`, `getTicketById`).
4. Implementar `src/worker/payment-processor.ts` com atualização condicional (`status = 'pending' AND event.status = 'published'`) e conectá-lo ao `src/worker/index.ts`.
5. Escrever testes automatizados em `tests/f03-purchase-gateway.test.ts` cobrindo validação de cartão, rajada concorrente de 30 compras simultâneas para lotação 5 (2 rodadas em eventos distintos = `5x ok / 25x sold_out`), aprovação/recusa e guarda contra resposta tardia pós-cancelamento.
