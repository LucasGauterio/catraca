# TRACKER — Rastreabilidade Regras (R01–R13) ↔ Features ↔ Contratos

| Regra | Descrição Resumida | Feature(s) | Critérios no PRD | Contrato(s) |
| --- | --- | --- | --- | --- |
| **R01** | Campos do evento + data futura na criação e edição | F02 | AC-F02.1, XF-01 | `docs/features/F02/contract.md` |
| **R02** | Evento nasce rascunho; só publicado e não cancelado aparece e vende | F02, F03, F04, F05 | AC-F02.1, AC-F02.2, AC-F04.1, AC-F05.2, XF-06, XF-08 | F02, F04, F05 |
| **R03** | Lotação `>=` ocupadas; mudança de preço só vale para compras futuras | F02, F03, F06 | AC-F02.3, AC-F06.2, XF-08, XF-10 | F02, F05, F06 |
| **R04** | Página de gestão própria `/organizer/events/[id]` | F02, F06 | AC-F02.2, XF-10 | F02, F06 |
| **R05** | Vagas ocupadas = `pending + confirmed`; disponíveis = `lotação - ocupadas` (0 se cancelado) | F02, F03, F04, F05, F06 | AC-F02.3, AC-F03.1, AC-F05.2, AC-F06.2, XF-07, XF-09 | F02, F03, F04, F05, F06 |
| **R06** | Compra de 1 ingresso nasce `pending`, ocupa vaga e responde sem esperar gateway | F03, F04, F05 | AC-F03.1, AC-F04.2, AC-F05.3, XF-02, XF-07, XF-09 | F03, F04, F05 |
| **R07** | Sem vaga: `Ingressos esgotados` / `409 sold_out`; nunca exceder lotação sob concorrência | F03, F04, F05 | AC-F03.2, AC-F04.3, AC-F05.3, XF-07, XF-09 | F03, F04, F05 |
| **R08** | Gateway aprova → `confirmed`; recusa → `declined` e libera vaga | F03, F04, F05, F06 | AC-F03.3, AC-F04.2, XF-02, XF-07, XF-09, XF-11 | F03, F04, F05, F06 |
| **R09** | Código único por ingresso; "Meus ingressos" mostra evento, status e código | F03, F04, F05, F06 | AC-F03.1, AC-F04.2, AC-F05.4, XF-03, XF-12 | F03, F04, F05, F06 |
| **R10** | Check-in na ordem exata com mensagens literais | F06 | AC-F06.1, XF-12, XF-13 | F06 |
| **R11** | Cancelamento irreversível; estorno/cancelamento em até 10s; guarda contra resposta tardia | F03, F06 | AC-F03.4, AC-F06.3, XF-10, XF-11, XF-12, XF-13 | F03, F06 |
| **R12** | Painel unificado (vitrine + API): Confirmados, Pendentes, Check-ins, Disponíveis, Receita, Estornados | F06 | AC-F06.2, XF-12, XF-13 | F06 |
| **R13** | Isolamento estrito de organizador + bloqueio de participante/visitante na área de organizador | F01, F02, F06 | AC-F01.4, AC-F02.4, XF-01, XF-03, XF-05 | F01, F02, F06 |
