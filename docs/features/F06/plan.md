# Plan — F06: Check-in, Painel de Gestão e Cancelamento Irreversível

1. Implementar `src/lib/events/operations.ts` (`performCheckIn`, `getEventDashboard`, `cancelEvent`).
2. Criar rotas REST: `GET /api/organizer/events/[id]/dashboard`, `POST /api/organizer/events/[id]/checkin` e `POST /api/organizer/events/[id]/cancel`.
3. Integrar Painel (6 métricas R12), Check-in (R10) e Cancelamento irreversível (R11 + bloqueio de edição) na página `/organizer/events/[id]`.
4. Escrever testes automatizados em `tests/f06-operations.test.ts` cobrindo todos os 5 ramos de R10 na ordem exata, receita com preço histórico R03/R12, unificação vitrine+API, isolamento R13 e cancelamento R11 com guarda contra resposta tardia do gateway.
