# Contract — F05: API de Parceiros (Contrato Fixo)

## Pré-requisitos de Ambiente
- `F01`, `F02` e `F03` mergeadas na `main` e ambiente ativo via `npm run up`.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F05-1** | AC-F05.1, XF-04 | Chamar as 3 rotas sem `X-Api-Key` e com `X-Api-Key: errada` | Todas respondem `401` com `{"error":"unauthorized"}`; com `$KEY` da seed, autenticam. |
| **C-F05-2** | AC-F05.2, XF-08 (R02, R05) | Criar evento draft e evento publicado (F02), chamar `GET /api/partner/events` | Apenas publicado aparece com `id`, `name`, `startsAt`, `priceCents`, `availableSeats`; compra no draft retorna `404 {"error":"event_not_available"}`. |
| **C-F05-3** | AC-F05.3, XF-09 (R06, R07, R08) | Enviar `cardNumber: "123"` (`422`), evento inexistente (`404`), compra válida (`202 pending`), 30 compras simultâneas em 2 eventos de lotação 5, e compra `0004` verificando liberação de vaga | `422 invalid_request`, `404 event_not_available`, `202 pending`; nas 2 rajadas exatamente `5x 202` e `25x 409 sold_out`; recusa libera vaga. |
| **C-F05-4** | AC-F05.4 (R09) | Chamar `GET /api/partner/tickets/{ticketId}` para ingresso inexistente (`404`), ingresso da API e ingresso da vitrine | Inexistente retorna `404 {"error":"ticket_not_found"}`; existentes retornam `200` com `ticketId`, `code`, `eventId`, `status`, `checkedIn`. |

## Mapeamento PRD → Contrato
- `AC-F05.1` → `C-F05-1`
- `AC-F05.2 (R02, R05)` → `C-F05-2`
- `AC-F05.3 (R06, R07)` → `C-F05-3`
- `AC-F05.4 (R09)` → `C-F05-4`
- `XF-04 (F01 → F05)` → `C-F05-1`
- `XF-08 (F02 → F05)` → `C-F05-2`
- `XF-09 (F03 → F05)` → `C-F05-3`
