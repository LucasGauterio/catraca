# Plan — F02: Gestão de Eventos e Área do Organizador

1. Implementar `src/lib/events/service.ts` com validações de R01, R02, R03 (incluindo verificação transacional `capacity >= occupied`), R13 (ownership) e bloqueio de edição se `cancelled`.
2. Implementar rotas REST: `GET/POST /api/organizer/events`, `GET/PATCH /api/organizer/events/[id]` e `POST /api/organizer/events/[id]/publish`.
3. Implementar UI `/organizer` (`src/app/organizer/page.tsx` + componente cliente de criação/listagem) e `/organizer/events/[id]` (`src/app/organizer/events/[id]/page.tsx` + formulário de edição/publicação).
4. Escrever testes automatizados em `tests/f02-events.test.ts` cobrindo R01 (data passada rejeitada), R02 (nasce rascunho + publicação), R03 (reduzir lotação abaixo de ocupadas rejeitado, aumentar aceito), R04 (URL própria) e R13 (isolamento entre Organizador A, B, participante e visitante).
