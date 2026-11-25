# Contract — F03: Motor de Reservas Concorrentes e Gateway Simulado Assíncrono (BullMQ)

## Pré-requisitos de Ambiente
- `F01` mergeada na `main`, containers `postgres`, `redis`, `app` e `worker` ativos via `npm run up`.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F03-1** | AC-F03.1 (R05, R06, R09) | Executar testes de `purchaseTicket` com cartão inválido (`123`) e cartão válido (`4000000000000001`) | Cartão inválido rejeitado antes de criar ingresso; compra válida nasce `pending` com código único e decrementa `availableSeats` imediatamente. |
| **C-F03-2** | AC-F03.2 (R07) | Executar 2 rodadas de 30 chamadas simultâneas a `purchaseTicket` em 2 eventos distintos de lotação 5 | Em ambas as rodadas: exatamente `5` sucessos e `25` `sold_out`; contagem final no banco = `5`. |
| **C-F03-3** | AC-F03.3, XF-02 (R08) | Validar processamento assíncrono via BullMQ worker para `0001` (aprova 2–5s), `0002` (recusa 2–5s e libera vaga), `0003` (30–40s), `0004` (30–40s) e outro final (recusa 2–5s) | Status atualizados corretamente e vaga liberada quando recusado. |
| **C-F03-4** | AC-F03.4 (R11) | Simular callback tardio do processador de pagamento em ingresso já `cancelled` ou evento `cancelled` | `0` linhas alteradas; status permanece `cancelled`. |

## Mapeamento PRD → Contrato
- `AC-F03.1 (R05, R06, R09)` → `C-F03-1`
- `AC-F03.2 (R07)` → `C-F03-2`
- `AC-F03.3 (R08)` → `C-F03-3`
- `AC-F03.4 (R11)` → `C-F03-4`
- `XF-02 (F01 → F03)` → `C-F03-3`
