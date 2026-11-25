# Knowledge Base & Architectural Learnings — Catraca

Este documento registra aprendizados consolidados, padrões arquiteturais e soluções técnicas adotadas no projeto **Catraca** para reutilização e governança contínua.

---

## 1. Concorrência e Reserva Atômica de Ingressos (`R07`)

- **Problema:** Sob alta concorrência (ex.: 30 requisições simultâneas para um evento com apenas 5 vagas), requisições paralelas podiam ler a mesma contagem de vagas e exceder a lotação máxima (overbooking).
- **Solução Adotada:** Utilização de transação PostgreSQL com bloqueio explícito de linha:
  ```sql
  SELECT * FROM events WHERE id = $1 FOR UPDATE;
  ```
- **Aprendizado:** O bloqueio deve englobar a verificação da contagem `occupied_seats = count(pending + confirmed)` e a inserção da compra + ingresso antes do commit. Requisições que excedem a capacidade recebem imediatamente `409 Conflict` com código `sold_out`.
- **Referência:** `src/lib/tickets/purchase.ts`, `docs/adrs/ADR-002-concurrency-r07-for-update.md`.

---

## 2. Gateway Assíncrono com BullMQ & Resposta Imediata (`R06`, `R08`)

- **Problema:** Gateways de pagamento externos possuem latência imprevisível (ou simulação com atraso de até 45s). Esperar a resposta do gateway antes de responder ao cliente causa timeout HTTP no storefront e nas APIs de parceiros.
- **Solução Adotada:** Compra nasce como `pending` na transação do banco (já ocupando a vaga), responde `202 Accepted` imediatamente ao cliente e enfileira um job BullMQ no Redis.
- **Aprendizado:** O worker em background (`src/worker/payment-processor.ts`) consome o job, invoca a simulação do gateway e atualiza o ingresso para `confirmed` ou `declined`. Se recusado, a vaga é liberada automaticamente.
- **Referência:** `src/lib/queue.ts`, `src/lib/gateway/simulator.ts`, `src/worker/payment-processor.ts`.

---

## 3. Guarda Contra Resposta Tardia do Gateway em Eventos Cancelados (`R11`)

- **Problema:** Se um organizador cancela um evento enquanto compras ainda estão pendentes de processamento na fila do gateway, uma aprovação tardia do gateway poderia incorretamente mudar o ingresso para `confirmed` em um evento já cancelado.
- **Solução Adotada:** Durante o cancelamento do evento, todos os ingressos pendentes são marcados como `cancelled` e os confirmados como `refunded`. O processador de pagamentos verifica atomicamente o status do evento e do ingresso antes de aplicar qualquer confirmação. Se o evento já estiver `cancelled`, o processador descarta a confirmação e mantém o ingresso como `cancelled`.
- **Referência:** `src/worker/payment-processor.ts`, `src/lib/events/operations.ts`, `docs/adrs/ADR-003-async-gateway-bullmq-cancellation-guard.md`.

---

## 4. Isolamento Estrito de Perfis e Segurança (`R13`)

- **Problema:** Tentativas de acesso horizontal (Organizador B acessando eventos do Organizador A) ou vertical (Participante ou Visitante acessando endpoints e páginas operacionais `/organizer`).
- **Solução Adotada:** Verificação de claim `role === "organizer"` e filtro de autorização obrigatório `WHERE organizer_id = $userId` em todas as consultas SQL de mutação e leitura gerencial.
- **Aprendizado:** Visitantes e participantes recebem redirecionamento ou `403 Forbidden` ao acessar rotas sob `/organizer` ou `/api/organizer/*`.
- **Referência:** `src/lib/auth.ts`, `src/lib/auth-utils.ts`, `src/lib/events/service.ts`.

---

## 5. Mascaramento Obrigatório de Dados Sensíveis (LGPD)

- **Problema:** Logs de auditoria ou requisição contendo senhas, tokens de autenticação ou números de cartão de crédito violavam as boas práticas de segurança e privacidade.
- **Solução Adotada:** O logger da aplicação (`src/lib/logger.ts`) utiliza filtros automáticos de mascaramento que substituem campos como `password`, `cardNumber`, `cvv` e `token` por `[LGPD_REDACTED]`.
- **Referência:** `src/lib/logger.ts`, `tests/f01-foundation.test.ts`.
