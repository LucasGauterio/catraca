# ADR-002: Garantia de Lotação sob Concorrência (R07) via PostgreSQL Row-Level Lock

## Status
Accepted

## Context
Na primeira tentativa do projeto, 112 ingressos foram vendidos para um show de 100 lugares sob pico de vendas. O avaliador dispara 30 compras simultâneas em 2 eventos distintos de lotação 5 e exige exatamente 5 respostas `202` e 25 `409 sold_out`.

## Decision
Toda compra executa uma transação PostgreSQL que adquire lock exclusivo na linha do evento (`SELECT ... FROM events WHERE id = $1 FOR UPDATE`), conta `tickets` com `status IN ('pending', 'confirmed')` dentro da mesma transação, rejeita com `sold_out` se `occupied >= capacity`, e insere o novo ingresso `pending` antes do `COMMIT`.

## Consequences
- Garantia matemática de zero overselling (ACID) sem depender de locks em memória (que falhariam entre múltiplas instâncias).
- Contenção restrita ao escopo de um único evento; eventos distintos mantêm paralelismo total.
