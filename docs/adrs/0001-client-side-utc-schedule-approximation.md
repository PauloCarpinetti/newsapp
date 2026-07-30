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

## Revisão — 2026-07-30 (pós spec 007, pipeline em produção)

O Cron Job (spec 007) foi implementado e validado em produção. Reavaliando esta decisão com o pipeline real rodando, o escopo do risco é mais amplo do que a redação original sugeria:

`targetHourUTC` é calculado **uma única vez**, no momento em que o usuário salva `/settings` (`POST /api/settings` → `calculateTargetHourUTC`), e persistido como um inteiro de hora sem nenhuma noção de data. O Cron (`GET /api/cron/generate`) compara esse inteiro fixo contra `new Date().getUTCHours()` a cada execução, indefinidamente, até o usuário salvar as preferências de novo. Ou seja: o risco não é só "perto de uma transição de DST" — é uma janela de **até ~7-8 meses seguidos** (a duração típica do horário de verão em fusos que o observam) em que o digest chega 1 hora adiantado ou atrasado do horário local real que o usuário escolheu, começando exatamente na transição de DST mais próxima após o último save.

**Decisão**: manter a aproximação como está — sem introduzir `date-fns-tz`/`luxon` nem um recálculo periódico automático — pelas mesmas razões de escopo da decisão original (projeto solo, sem reclamação de usuário real, dependência nova não justificada pelo volume atual). O que muda é a natureza da decisão: deixa de ser "acurácia aceitável perto de uma borda rara" e passa a ser "temos um limite conhecido e documentado, não descoberto por acidente depois". Fica registrado como candidato a spec futura caso o projeto ganhe usuários reais e o desalinhamento de 1h vire uma reclamação de verdade — a correção mais simples seria o próprio Cron recalcular `targetHourUTC` sob demanda a partir de `schedule.localTime`/`schedule.timezone` a cada execução, em vez de confiar no valor persistido.
