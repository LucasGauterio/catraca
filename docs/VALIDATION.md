# VALIDATION — Status dos Gates e Fluxo do Avaliador (Main)

- **Status Geral:** `PASS`
- **Data da Validação Final na `main`:** `2026-11-25T15:58:27-03:00`
- **Repositório:** `https://github.com/LucasGauterio/catraca`

## 1. Relatórios Independentes por Feature (Imutáveis — 1 commit cada)
- **F01:** `APPROVED` — [docs/features/F01/reports/eval-20261125-1040.md](features/F01/reports/eval-20261125-1040.md) ([PR #1](https://github.com/LucasGauterio/catraca/pull/1))
- **F02:** `APPROVED` — [docs/features/F02/reports/eval-001.md](features/F02/reports/eval-001.md) ([PR #3](https://github.com/LucasGauterio/catraca/pull/3))
- **F03:** `APPROVED` — [docs/features/F03/reports/eval-001.md](features/F03/reports/eval-001.md) ([PR #2](https://github.com/LucasGauterio/catraca/pull/2))
- **F04:** `APPROVED` — [docs/features/F04/reports/eval-001.md](features/F04/reports/eval-001.md) ([PR #4](https://github.com/LucasGauterio/catraca/pull/4))
- **F05:** `APPROVED` — [docs/features/F05/reports/eval-001.md](features/F05/reports/eval-001.md) ([PR #5](https://github.com/LucasGauterio/catraca/pull/5))
- **F06:** `APPROVED` — [docs/features/F06/reports/eval-001.md](features/F06/reports/eval-001.md) ([PR #6](https://github.com/LucasGauterio/catraca/pull/6))

## 2. Evidência das Waves Paralelas (Timestamps Sobrepostos no GitHub)
- **Wave 2 (`F02` + `F03`):** PR #2 (`13:50:51Z`–`14:00:35Z`) e PR #3 (`13:52:44Z`–`14:06:48Z`) — primeiro commit de cada PR anterior ao último commit do outro.
- **Wave 3 (`F04` + `F05`):** PR #4 (`14:08:43Z`–`14:24:18Z`) e PR #5 (`14:09:13Z`–`18:38:26Z`) — primeiro commit de cada PR anterior ao último commit do outro.

## 3. Fluxo Completo do Avaliador na `main` (Passos 1 a 18)
- **Passos 1–4:** `npm run up` + health OK; rascunho fora da vitrine/API; data passada rejeitada (`422`); publicado visível com `availableSeats: 2`, `priceCents: 10000`.
- **Passos 5–8:** Compra web (`0001`) `pendente → confirmado`; compra API (`0004`) `pending` ocupa vaga (`availableSeats: 0`), vitrine exibe `Ingressos esgotados` e API retorna `409 sold_out`; após 45s `T2` vira `declined`, vaga é liberada (`availableSeats: 1`), `T3` (`0001`) confirmado.
- **Passos 9–11:** Reduzir lotação abaixo das ocupadas rejeitado; preço R$ 150,00 e lotação 3 aceitos; painel exato (`Confirmados 3`, `Pendentes 0`, `Check-ins 0→1`, `Vagas disponíveis 0`, `Receita R$ 350,00`, `Estornados 0`); mensagens de check-in literais (`Entrada liberada`, `Ingresso já utilizado`, `Ingresso não confirmado`, `Ingresso inválido para este evento`); isolamento R13 validado para Organizador B, participante e visitante + check-in cruzado `C3` rejeitado.
- **Passos 12–14:** Cancelamento irreversível de E3 com `T5` lento (`0003`) e `T6` rápido (`0001`): sai da vitrine e API, compra API retorna `404 event_not_available`, edição bloqueada, `T6 → refunded`, `T5 → cancelled`, e após 45s `T5` permanece `cancelled`; check-in retorna `Evento cancelado`; painel mostra `0 / 0 / 0 / 0 / R$ 0,00 / 1`.
- **Passo 15:** 2 rodadas independentes (`E4` e `E5`, lotação 5) com 30 compras simultâneas cada → exatamente **`5x 202` e `25x 409 sold_out`** em ambas, painel `Confirmados 5` e `Vagas disponíveis 0`.
- **Passo 16:** 401 `unauthorized` (sem chave e chave errada nas 3 rotas), 422 `invalid_request` (`cardNumber: "123"`), 404 `ticket_not_found`.
- **Passo 17:** `npm run gates` (`tsc`, `eslint`, 6 arquivos / 64 testes Vitest incluindo concorrência no PostgreSQL) **PASS**; `npm run down` (`CONTAINERS_AFTER_DOWN: []`); segundo `npm run up` com seed idempotente **PASS** (`{"status":"ok","db":"connected","redis":"connected"}`).
- **Passo 18:** Todos os 6 relatórios imutáveis com 1 commit único, `docs/project-state.json` atualizado com todas as features `completed`, `AGENTS.md`, `CLAUDE.md` e `README.md` sincronizados na `main`.
