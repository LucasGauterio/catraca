# Design System — Catraca MVP (Code-First)

## Tokens Visuais
- **Estilo:** Funcional, limpo, alto contraste, responsivo, sem dependências de design externo (Tailwind CSS v4 / CSS utilitário limpo).
- **Cores Semânticas:**
  - Primária: `#0f172a` (Slate 900) / Ação `#2563eb` (Blue 600)
  - Sucesso (`confirmado`, `Entrada liberada`): `#15803d` / `#dcfce7`
  - Alerta (`pendente`): `#b45309` / `#fef3c7`
  - Erro/Cancelado (`recusado`, `cancelado`, `estornado`, `Ingressos esgotados`): `#b91c1c` / `#fee2e2`
- **Inventário de Telas & Componentes:**
  - `/` (Vitrine Pública — `Server-connected`): lista de eventos publicados com preço em `R$`, vagas disponíveis, botão Comprar ou badge `Ingressos esgotados`.
  - `/login` e `/register` (`Server-connected`): autenticação de participante/organizador e cadastro de participante.
  - `/my-tickets` (`Server-connected`): lista de ingressos do participante com nome do evento, rótulo de status em português e código único.
  - `/organizer` (`Server-connected`): listagem exclusiva dos eventos do organizador autenticado + formulário de criação de evento.
  - `/organizer/events/[id]` (`Server-connected`): edição (bloqueada se cancelado), botão Publicar (se rascunho), botão Cancelar Evento (se publicado), Painel com os 6 indicadores (R12) e formulário de Check-in (R10).
