# Spec — F02: Gestão de Eventos e Área do Organizador

## Decisões Técnicas
- **Rotas de API do Organizador (`src/app/api/organizer/events/**`):**
  - `GET /api/organizer/events`: exige `role === 'organizer'`, retorna apenas eventos com `organizer_id === session.user.id`.
  - `POST /api/organizer/events`: cria evento em `status = 'draft'` (**R02**). Valida `name` (não vazio), `startsAt` (`new Date(startsAt) > new Date()`, **R01**), `location` (não vazio), `capacity` (inteiro `>= 1`, **R01**), `priceCents` (inteiro `> 0`, **R01**).
  - `GET /api/organizer/events/[id]`: exige `role === 'organizer'` e `event.organizer_id === user.id`; caso contrário retorna `404` sem expor nenhum dado (**R13**).
  - `PATCH /api/organizer/events/[id]`: exige propriedade (**R13**); rejeita se `event.status === 'cancelled'` (**R11**); valida `startsAt > now` (**R01**); dentro de transação `FOR UPDATE`, conta vagas ocupadas (`pending` + `confirmed`) e rejeita `capacity < occupied` (**R03**, **R05**); atualização de `price_cents` afeta apenas `events.price_cents` (compras futuras, **R03**).
  - `POST /api/organizer/events/[id]/publish`: exige propriedade (**R13**); só permite transição `draft → published` (**R02**); rejeita se `cancelled` (**R11**).
- **Páginas UI do Organizador:**
  - `/organizer`: lista exclusiva de eventos do organizador + formulário de criação de evento (nome, data/hora, local, lotação, preço em reais convertido para centavos).
  - `/organizer/events/[id]` (**R04**): página dedicada de gestão. Se não autenticado como organizador ou se o evento pertencer a outro organizador, NÃO renderiza nenhum dado do evento (retorna tela de acesso negado / não encontrado sem vazar nome, números ou ingressos — **R13**). Contém formulário de edição, botão "Publicar evento" (quando `draft`), e slots extensíveis para Painel/Check-in/Cancelamento (`F06`).
- **Serviço de Domínio (`src/lib/events/service.ts`):** Funções puras/transacionais isoladas para criação, edição, publicação e listagem por organizador.
