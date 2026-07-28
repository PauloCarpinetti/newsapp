# ADR 0004: Idempotência e isolamento de falhas no pipeline de geração de digests

**Status**: Accepted
**Data**: 2026-07-28 (spec 007)
**Specs relacionadas**: 002, 003, 005, 007

## Contexto

O pipeline de geração de digests (`GET /api/cron/generate`) é o primeiro job agendado/processamento em lote do projeto: uma única execução pode processar múltiplos usuários, cada um envolvendo chamadas de rede (scraping de fontes) e uma chamada paga à API da OpenAI. Dois riscos concretos motivaram este ADR, ambos levantados explicitamente no briefing técnico que originou a spec 007: (1) uma falha isolada (uma fonte, ou um usuário inteiro) não deveria travar o restante da execução; e (2) disparos duplicados do Cron (retry da plataforma, dois agendamentos sobrepostos, chamada manual repetida) não deveriam gerar digests duplicados nem gastar tokens duas vezes para o mesmo dia.

## Decisão

**Isolamento de falhas em duas camadas independentes**, ambas usando `Promise.allSettled` (nunca `Promise.all`) exatamente nos pontos onde uma falha parcial não deve propagar:
- Por fonte, dentro de `aggregateSources` (`scraperService.ts`): cada fonte é buscada de forma isolada; uma fonte rejeitada é registrada via `console.warn` e descartada, sem impedir que as demais fontes do mesmo usuário sejam agregadas.
- Por usuário, na rota (`route.ts`): `processUser` nunca lança para fora de si mesma (seu próprio try/catch marca o digest como `failed`), mas o `Promise.allSettled` externo é uma segunda camada de segurança contra qualquer falha inesperada antes mesmo da criação do documento `processing`.

**Idempotência diária sem índice composto**: em vez de uma query com filtro composto (`where("createdAt", ">=", inícioDoDia).where("status", "in", [...])`, que exigiria criar um índice composto manualmente no Firestore Console), `processUser` busca apenas o digest mais recente do usuário (`orderBy("createdAt", "desc").limit(1)`, índice de campo único automático) e compara a data em código de aplicação. Se o mais recente for de hoje e não tiver falhado, a execução é pulada.

**Proteção de custo antes da chamada de IA**: se a agregação de fontes não retornar nenhum texto utilizável, o digest é marcado `failed` diretamente — a API da OpenAI nunca é chamada sem conteúdo para resumir.

## Alternativas Consideradas

- **`Promise.all` (como no esqueleto técnico original fornecido)**: rejeitada — qualquer fonte ou usuário que lance derrubaria toda a agregação/lote, violando o Princípio IV da constitution (falhas assíncronas não devem bloquear o restante).
- **Índice composto do Firestore para a checagem de idempotência**: rejeitada em favor de uma query mais simples (só `orderBy` em `createdAt`) mais a comparação de data em código — evita exigir provisionamento manual de infraestrutura (criar o índice) em um projeto solo sem pipeline de deploy dedicado para isso.
- **Fila/mecanismo de deduplicação externo (ex.: lock distribuído, fila com deduplicação nativa)**: rejeitada como complexidade desproporcional para o volume de usuários esperado nesta fase do projeto; a checagem por "digest mais recente" cobre o caso real (retry/disparo duplicado na mesma hora), não o caso de alta concorrência em escala.

## Consequências

- Um usuário com todas as fontes quebradas ainda recebe um digest (`failed`, com `errorMessage` claro) em vez de ficar sem nenhum registro do que aconteceu.
- A checagem de idempotência é uma leitura extra por usuário a cada execução do Cron (uma query de índice único, barata) — aceitável no volume atual.
- Falhas de fonte individuais ficam visíveis nos logs do servidor (`console.warn`), mas não são persistidas em lugar nenhum do Firestore — se uma fonte específica falhar consistentemente, isso só é detectável via logs, não via uma métrica/dashboard. Aceitável por ora; se o volume de usuários crescer, vale revisitar (ex.: persistir quais fontes falharam em cada digest).
- O padrão (duas camadas de `Promise.allSettled` + checagem de "mais recente" para idempotência) é o modelo a seguir para qualquer processamento em lote futuro do projeto.
