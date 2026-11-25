# Plan — F04: Vitrine Pública e Área do Participante ("Meus Ingressos")

1. Criar helper de rótulos de status PT-BR (`src/lib/tickets/labels.ts`: `pending → pendente`, `confirmed → confirmado`, `declined → recusado`, `cancelled → cancelado`, `refunded → estornado`) e formatação de moeda BRL (`R$ 100,00`).
2. Criar rotas `POST /api/purchases` e `GET /api/my-tickets` delegando ao serviço `purchaseTicket` de `F03`.
3. Atualizar `src/app/page.tsx` (Vitrine pública com apenas eventos publicados, formulário de compra e exibição de `Ingressos esgotados` quando sem vaga).
4. Criar `src/app/my-tickets/page.tsx` ("Meus ingressos" exibindo evento, status em português e código).
5. Escrever testes automatizados em `tests/f04-storefront.test.ts` cobrindo R02 (rascunho oculto, publicado visível), R06/R08/R09 (compra pela vitrine nasce `pendente`, confirma com `0001` e aparece em "Meus ingressos") e R07 (`Ingressos esgotados`).
