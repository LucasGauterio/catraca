# Contract — F02: Gestão de Eventos e Área do Organizador

## Pré-requisitos de Ambiente
- `F01` mergeada na `main` e ambiente ativo via `npm run up`.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F02-1** | AC-F02.1 (R01, R02) | Como Organizador A, criar evento com data futura (sucesso em `draft`) e tentar criar evento com data de ontem | Evento futuro criado com `status = "draft"`; data no passado rejeitada (`400`/`422`). |
| **C-F02-2** | AC-F02.2 (R02, R04) | Acessar `/organizer/events/{id}`, editar campos válidos e publicar evento | Página própria carrega corretamente; após publicar, `status` passa para `"published"`. |
| **C-F02-3** | AC-F02.3 (R03, R05) | Com vagas ocupadas > 1, tentar reduzir lotação para valor menor que ocupadas; depois aumentar lotação e alterar preço | Redução rejeitada (`409`/`422`); aumento e mudança de preço aceitos sem alterar `price_cents` de ingressos já emitidos. |
| **C-F02-4** | AC-F02.4, XF-01 (R13) | Autenticar como Organizador B (seed de F01), listar `/organizer` e abrir diretamente `/organizer/events/{id_de_A}` e `/api/organizer/events/{id_de_A}`; repetir como participante e visitante | Lista de B não mostra evento de A; acesso direto não exibe nenhum dado de A (nome, números ou ingressos). |

## Mapeamento PRD → Contrato
- `AC-F02.1 (R01, R02)` → `C-F02-1`
- `AC-F02.2 (R02, R04)` → `C-F02-2`
- `AC-F02.3 (R03, R05)` → `C-F02-3`
- `AC-F02.4 (R13)` → `C-F02-4`
- `XF-01 (F01 → F02)` → `C-F02-4`
