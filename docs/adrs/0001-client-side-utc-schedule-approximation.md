# ADR 0001: Aproximação client-side para conversão de horário local em `schedule.targetHourUTC`

**Status**: Accepted
**Data**: 2026-07-27 (retroativa — decisão originalmente tomada na spec 003, 2026-07-25)
**Specs relacionadas**: 002, 003, 005

## Contexto

O futuro Cron Job de entrega de digests (fora do escopo até o momento) precisa saber em qual hora UTC disparar o resumo de cada usuário. O usuário só escolhe um horário local (`HH:MM`) e o app resolve seu fuso IANA via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Converter horário local + fuso em hora UTC de forma totalmente correta, ano todo, exige tratar transições de horário de verão (DST) — um problema clássico normalmente resolvido com uma biblioteca de fusos horários (`date-fns-tz`, `luxon`) ou uma API de calendário.

## Decisão

Implementar `calculateTargetHourUTC(localTime, timezone)` (`src/lib/utils/time.ts`) como uma função pura, usando somente a API nativa `Intl.DateTimeFormat` (sem dependência nova): calcula o offset UTC do fuso informado *para a data de hoje* e aplica essa correção ao horário local desejado. É precisa para a maioria dos casos, mas não reavalia o offset para a data futura exata em que o digest de fato vai rodar — perto de uma transição de DST, o resultado pode ficar até 1 hora errado para quem observa horário de verão.

## Alternativas Consideradas

- **Biblioteca de fuso horário (`date-fns-tz`/`luxon`)**: rejeitada por ora — dependência nova para uma funcionalidade v1, num projeto que ainda não tem o Cron Job que consumiria o valor com essa precisão.
- **Cálculo definitivo feito no momento do envio pelo backend**: adiado como melhoria futura, documentado como fora de escopo desde a spec 002/003 — o Cron Job (ainda não especificado) é o lugar natural para recalcular a hora exata na data real do envio.

## Consequências

- `schedule.targetHourUTC` pode ficar impreciso em até 1 hora para usuários em fusos com DST, em datas próximas a uma transição.
- A função é isomórfica (roda igual no client e no server) e coberta por testes unitários (`time.test.ts`) cobrindo múltiplos fusos, incluindo offsets de meia hora e virada de meia-noite — o que existe hoje está correto para a data de cálculo, a limitação é sobre datas futuras distantes.
- Reavaliar esta decisão antes de implementar o Cron Job de disparo de digests (spec futura do Épico 2).
