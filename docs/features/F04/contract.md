# Contract — F04: Vitrine Pública e Área do Participante ("Meus Ingressos")

## Pré-requisitos de Ambiente
- `F01`, `F02` e `F03` mergeadas na `main` e ambiente ativo via `npm run up`.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F04-1** | AC-F04.1, XF-06 (R02) | Criar evento em rascunho via F02 e verificar `GET /`; publicar evento e verificar `GET /` novamente | Rascunho não aparece na vitrine; após publicar, aparece com nome, preço e vagas disponíveis. |
| **C-F04-2** | AC-F04.2, XF-03, XF-07 (R06, R08, R09) | Cadastrar participante (F01), comprar ingresso via `POST /api/purchases` / vitrine com cartão `4000000000000001`, consultar `/my-tickets` imediatamente e novamente após até 5s | Aparece `pendente` inicialmente e `confirmado` em até 5s com nome do evento, status e código único. |
| **C-F04-3** | AC-F04.3, XF-07 (R07) | Esgotar vagas do evento e verificar vitrine `/` e resposta de `POST /api/purchases` | Vitrine exibe literalmente `Ingressos esgotados` e tentativa de compra é recusada com `sold_out`. |

## Mapeamento PRD → Contrato
- `AC-F04.1 (R02)` → `C-F04-1`
- `AC-F04.2 (R06, R08, R09)` → `C-F04-2`
- `AC-F04.3 (R07)` → `C-F04-3`
- `XF-03 (F01 → F04)` → `C-F04-2`
- `XF-06 (F02 → F04)` → `C-F04-1`
- `XF-07 (F03 → F04)` → `C-F04-2`, `C-F04-3`
