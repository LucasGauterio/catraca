# Contract — F06: Check-in, Painel de Gestão e Cancelamento Irreversível

## Pré-requisitos de Ambiente
- `F01`, `F02`, `F03`, `F04` e `F05` mergeadas na `main` e ambiente ativo via `npm run up`.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F06-1** | AC-F06.1, XF-12, XF-13 (R10) | Exercitar check-in no evento E1 com: código confirmado da vitrine (1ª vez e 2ª vez), código recusado/pendente, código inexistente (`ZZZZZZZZ`) e código de outro evento | Mensagens exatas: `Entrada liberada`, `Ingresso já utilizado`, `Ingresso não confirmado`, `Ingresso inválido para este evento`. |
| **C-F06-2** | AC-F06.2, XF-10, XF-12, XF-13 (R03, R05, R12) | Comprar ingressos via vitrine e API a R$ 100,00, alterar preço para R$ 150,00, comprar mais 1 via API, fazer 1 check-in e conferir o painel | Painel exibe exatamente `Confirmados 3`, `Pendentes 0`, `Check-ins 1`, `Vagas disponíveis 0`, `Receita R$ 350,00`, `Estornados 0`. |
| **C-F06-3** | AC-F06.3, XF-10, XF-11, XF-12, XF-13 (R11) | Em evento publicado com 1 ingresso `confirmed` (`0001`) e 1 `pending` lento (`0003`), cancelar evento antes de 30s; verificar vitrine, API (`404 event_not_available`), edição bloqueada, status em <=10s (`refunded`/`cancelled`), status após 45s (permanece `cancelled`), check-in (`Evento cancelado`) e painel (`Receita R$ 0,00`, `Estornados 1`, `Vagas disponíveis 0`) | Todas as invariantes de R11 mantidas antes e após a resposta tardia do gateway. |
| **C-F06-4** | XF-05 (R13) | Tentar acessar `/api/organizer/events/{id_de_A}/dashboard`, `/checkin` e `/cancel` como Organizador B, participante e visitante | Acesso negado (`401`/`403`/`404`) sem vazar dados do evento de A. |

## Mapeamento PRD → Contrato
- `AC-F06.1 (R10)` → `C-F06-1`
- `AC-F06.2 (R03, R05, R12)` → `C-F06-2`
- `AC-F06.3 (R11)` → `C-F06-3`
- `XF-05 (F01 → F06)` → `C-F06-4`
- `XF-10 (F02 → F06)` → `C-F06-2`, `C-F06-3`
- `XF-11 (F03 → F06)` → `C-F06-3`
- `XF-12 (F04 → F06)` → `C-F06-1`, `C-F06-2`, `C-F06-3`
- `XF-13 (F05 → F06)` → `C-F06-1`, `C-F06-2`, `C-F06-3`
