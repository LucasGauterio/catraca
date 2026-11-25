# Contract — F01: Plataforma, Harness, Banco de Dados, Seed e Autenticação

## Pré-requisitos de Ambiente
- Docker Engine + Docker Compose ativos.
- Node.js LTS instalado no host.

## Itens Verificáveis

| Item | Critério PRD | Verificação Executável | Critério de Aprovação |
| --- | --- | --- | --- |
| **C-F01-1** | AC-F01.1 | Executar `npm run up` e depois `curl -sf http://localhost:3000/api/health` | Comando sai com código `0` e `/api/health` retorna `200` com `status: "ok"` e `db: "connected"`. |
| **C-F01-2** | AC-F01.2 | Executar `npm run down`, verificar `docker compose ps` vazio e porta `3000` fechada, depois executar `npm run up` novamente | Nenhum container ativo após `down`; segundo `up` conclui com código `0` sem erro na seed. |
| **C-F01-3** | AC-F01.3 | Executar `npm run gates` | Typecheck, lint e testes automatizados concluem com código `0`. |
| **C-F01-4** | AC-F01.4 (R13) | Testar cadastro de participante (`POST /api/auth/register`), login de Organizador A/B (`POST /api/auth/login`), logout e tentativa de acesso a `/organizer` como visitante e como participante | Cadastro e logins funcionam; `/organizer` bloqueia visitante e participante (redirect ou `403`). |
| **C-F01-5** | AC-F01.5 | Verificar teste automatizado do `logger.ts` passando `password`, `cardNumber` e `email` | Saída JSON contém `[LGPD_REDACTED]` e não contém nenhum valor sensível em claro. |

## Mapeamento PRD → Contrato
- `AC-F01.1` → `C-F01-1`
- `AC-F01.2` → `C-F01-2`
- `AC-F01.3` → `C-F01-3`
- `AC-F01.4 (R13)` → `C-F01-4`
- `AC-F01.5` → `C-F01-5`
