# RFC — Arquitetura Técnica Catraca MVP

## 1. Resumo Arquitetural
O sistema **Catraca** adota uma arquitetura **Fullstack TypeScript** baseada em **Next.js (App Router)**, **PostgreSQL 16** (Drizzle ORM + `pg`) e **Redis 7 + BullMQ**, totalmente containerizada via **Docker Compose** para garantir subida determinística em 1 comando (`npm run up`) em Linux, macOS e WSL.

- **Web & API (`$WEB` e `$API`):** `http://localhost:3000` (Next.js App Router servindo tanto as páginas React quanto as rotas REST `/api/*` e `/api/partner/*`).
- **Worker Assíncrono (`worker`):** Processo Node.js dedicado em container separado rodando `BullMQ Worker` conectado ao Redis e ao PostgreSQL para processar pagamentos simulados sem bloquear requisições HTTP.
- **Banco de Dados (`postgres`):** PostgreSQL 16 com transações ACID e travas de linha (`SELECT ... FOR UPDATE`).
- **Fila (`redis`):** Redis 7 com persistência para enfileiramento confiável de jobs do gateway simulado.

## 2. Garantindo R07 sob Concorrência (Zero Overselling)
Para eliminar qualquer condição de corrida sob rajadas simultâneas (ex.: 30 requisições paralelas para 5 vagas):
1. Toda compra (seja pela vitrine ou pela API de parceiros) passa por uma única função de domínio `purchaseTicket()` em `src/lib/tickets/purchase.ts`.
2. Dentro de `db.transaction(async (tx) => { ... })`, executamos:
   ```sql
   SELECT id, status, capacity, price_cents
   FROM events
   WHERE id = $1
   FOR UPDATE;
   ```
   O lock exclusivo de linha serializa no banco de dados todas as compras concorrentes para o mesmo evento, enquanto eventos distintos continuam totalmente paralelos.
3. Com a linha travada, verificamos `status === 'published'` (caso contrário, erro `event_not_available`).
4. Contamos as vagas ocupadas:
   ```sql
   SELECT COUNT(*)::int AS occupied
   FROM tickets
   WHERE event_id = $1 AND status IN ('pending', 'confirmed');
   ```
5. Se `occupied >= capacity`, abortamos com `sold_out` (`409`).
6. Caso contrário, inserimos o ingresso com `status = 'pending'`, `price_cents = event.price_cents` e código único alfanumérico de 8 caracteres.
7. Somente após o `COMMIT` bem-sucedido enfileiramos o job na fila BullMQ `payment-gateway` (com `jobId = ticket.id` para idempotência).

## 3. Gateway Simulado Assíncrono & Guarda de Cancelamento (R08 + R11)
- Ao receber um job `{ ticketId, cardLast4 }`, o worker determina o resultado e atraso:
  - `0001`: `confirmed`, atraso `2000–5000ms` (padrão)
  - `0002`: `declined`, atraso `2000–5000ms` (padrão)
  - `0003`: `confirmed`, atraso `30000–40000ms` (padrão)
  - `0004`: `declined`, atraso `30000–40000ms` (padrão)
  - Qualquer outro final: `declined`, atraso `2000–5000ms` (padrão)
- Variável opcional `GATEWAY_DELAY_SCALE` (default `1`) permite acelerar testes unitários/integração automatizados sem alterar o modo padrão exigido pelo avaliador (`1`).
- Ao finalizar o atraso, o worker executa uma atualização **condicional e atômica**:
  ```sql
  UPDATE tickets t
  SET status = $1, updated_at = NOW()
  FROM events e
  WHERE t.id = $2
    AND t.event_id = e.id
    AND t.status = 'pending'
    AND e.status = 'published';
  ```
  Se o evento já tiver sido cancelado (ou o ingresso já tiver virado `cancelled`/`refunded`), `0` linhas são afetadas — garantindo **R11** mesmo quando o cartão lento `0003` responde 45 segundos depois!

## 4. Segurança e Conformidade LGPD (Mandato NFR-0 Self-Contained)
- **Senhas:** Hash forte via `scrypt` (`node:crypto`) com salt aleatório de 16 bytes e comparação em tempo constante (`timingSafeEqual`).
- **Sessões:** Token criptográfico de 32 bytes armazenado em cookie `HttpOnly`, `SameSite=Lax`, validado na tabela `sessions`.
- **Cartão de Crédito:** O número do cartão **nunca é persistido** em banco de dados nem gravado em logs; apenas os últimos 4 dígitos são enviados ao job simulado para decisão de resposta.
- **Redação de Logs:** Logger JSON (`src/lib/logger.ts`) substitui automaticamente campos `password`, `cardNumber`, `email`, `buyerEmail`, `apiKey` por `[LGPD_REDACTED]`.

### Tabela ROPA (Registro de Operações de Tratamento — Lei nº 13.709/2018)
| Dado Pessoal | Finalidade | Base Legal (LGPD) | Minimização (Art. 6º) | Retenção |
| --- | --- | --- | --- | --- |
| Nome e E-mail (Participante/Organizador) | Autenticação, emissão e consulta de ingressos | Execução de contrato (Art. 7º, V) | Apenas campos estritamente necessários | Vigência da conta/evento |
| `buyerEmail` (API Parceiros) | Identificação do comprador no ingresso parceiro | Execução de contrato (Art. 7º, V) | Sem vínculo obrigatório a senha/perfil | Vigência do evento |
| Número do cartão (16 dígitos) | Simulação efêmera de autorização | Execução de contrato (Art. 7º, V) | **Não persistido**; apenas `last4` efêmero na fila | 0s em disco |
