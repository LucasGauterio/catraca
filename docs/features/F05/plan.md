# Plan — F05: API de Parceiros (Contrato Fixo)

1. Implementar `src/lib/partner-auth.ts` (validação de `X-Api-Key` via SHA-256 na tabela `api_keys`).
2. Implementar `src/app/api/partner/events/route.ts` (`GET /api/partner/events`).
3. Implementar `src/app/api/partner/events/[eventId]/purchases/route.ts` (`POST /api/partner/events/{eventId}/purchases` com ordem exata `401 → 422 → 404 → 409 → 202`).
4. Implementar `src/app/api/partner/tickets/[ticketId]/route.ts` (`GET /api/partner/tickets/{ticketId}`).
5. Escrever testes automatizados em `tests/f05-partner-api.test.ts` cobrindo todas as rotas, códigos de erro, ordem de validação e teste HTTP concorrente (2 rodadas de 30 requisições simultâneas em lotação 5 = `5x 202` e `25x 409`).
