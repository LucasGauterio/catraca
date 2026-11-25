# Spec — F04: Vitrine Pública e Área do Participante ("Meus Ingressos")

## Decisões Técnicas
- **Rotas de API do Participante (`src/app/api/purchases/route.ts`, `src/app/api/my-tickets/route.ts`):**
  - `POST /api/purchases`: exige usuário autenticado (`participant` ou `organizer`? Apenas usuário autenticado com sessão — participante na vitrine), recebe `{ eventId, cardNumber }`, delega para `purchaseTicket({ eventId, buyerEmail: user.email, cardNumber, channel: 'web', userId: user.id })` de `F03`. Retorna `202` em sucesso, `409 { error: 'sold_out', message: 'Ingressos esgotados' }` sem vaga, `422` se cartão inválido, `404` se evento indisponível.
  - `GET /api/my-tickets`: exige sessão autenticada, retorna ingressos do usuário (`WHERE user_id = session.user.id`) com nome do evento, status e código único (**R09**).
- **Vitrine Pública (`src/app/page.tsx` + componente cliente de compra):**
  - Acessível sem login (Visitante) e com login (Participante).
  - Lista exclusivamente eventos publicados e não cancelados (`listPublishedEventsWithSeats` de `F03`, **R02**).
  - Para cada evento: nome, data/hora, local, preço formatado em reais (`R$ 100,00`), vagas disponíveis.
  - Quando `availableSeats === 0` (ou se a compra retornar `sold_out`), exibe literalmente `Ingressos esgotados` (**R07**).
  - Formulário de compra (número do cartão de 16 dígitos) para participante logado; visitantes veem link para entrar/cadastrar.
- **Página "Meus ingressos" (`src/app/my-tickets/page.tsx`):**
  - Lista todos os ingressos comprados pelo participante autenticado com: nome do evento, rótulo de status em português (`pendente`, `confirmado`, `recusado`, `cancelado`, `estornado`) e código único (**R09**).
  - Recarregar a página consulta o estado atualizado do banco (não requer WebSocket).
