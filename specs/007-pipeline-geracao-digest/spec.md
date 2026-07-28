# Épico 2 (Motor da IA) — Pipeline de Geração Automática de Digests

**Short name:** pipeline-geracao-digest

**Feature Branch**: `007-pipeline-geracao-digest`

**Created**: 2026-07-28

**Status**: Draft

## Resumo
Implementar o pipeline completo que transforma as preferências já coletadas (specs 002-006: tópicos, fontes, horário) em um digest de fato: um Cron Job horário identifica quem deve receber o resumo agora, agrega o conteúdo das fontes configuradas, gera um resumo estruturado via GPT-4o-mini e persiste o resultado em `users/{uid}/digests` — a subcoleção que a spec 002 já previa mas nunca chegou a definir. Arquiteturalmente, o pipeline é dividido em módulos com responsabilidade única (camada de dados, serviço de agregação, serviço de IA), evitando concentrar tudo na rota da API.

## Contexto e Motivação
Todas as specs anteriores prepararam os insumos (autenticação, perfil, tópicos, fontes, horário) mas nenhuma delas efetivamente gera um digest — é a peça que faltava para o produto entregar valor real. A ordem de execução é o ponto mais sensível: agregação e geração de IA mal orquestradas geram dois riscos concretos — estourar o tempo limite da função serverless quando muitos usuários caem na mesma hora, e gastar tokens da API de IA desnecessariamente (fontes que falham, conteúdo vazio, ou reprocessamento duplicado do mesmo usuário).

## Objetivos
- Selecionar automaticamente, a cada hora, os usuários cujo `schedule.targetHourUTC` bate com a hora UTC corrente.
- Agregar o conteúdo das fontes de cada usuário em paralelo, com isolamento de falhas por fonte e truncamento de texto para conter custo de tokens.
- Gerar um resumo estruturado (JSON) via GPT-4o-mini, usando os tópicos e a personalização de prompt do usuário.
- Persistir o resultado (ou a falha) em `users/{uid}/digests`, nunca deixando um digest preso indefinidamente em processamento.
- Evitar reprocessamento duplicado e chamadas à IA sem conteúdo útil para resumir.
- Separar claramente as responsabilidades em módulos (camada de dados, serviço de agregação, serviço de IA), em vez de concentrar tudo na rota do Cron Job.

## Escopo (In Scope)
- `src/app/api/cron/generate/route.ts` (novo): rota `GET` protegida por segredo, aciona o pipeline para a hora corrente.
- `src/lib/services/scraperService.ts` (novo): agregação de fontes `rss` e `website` (busca real de conteúdo), com truncamento por fonte e isolamento de falhas.
- `src/lib/services/aiService.ts` (novo): geração do resumo estruturado via API do modelo configurado pelo usuário (`config.gptModel`, default `gpt-4o-mini`).
- `src/lib/schemas/digestSchema.ts` (novo): schema/tipos do conteúdo estruturado do digest (`intro` + `sections`).
- `src/lib/firebase/admin.ts`: reaproveitado sem mudanças (specs 005/006).
- `vercel.json` (novo): agendamento do Cron Job (a cada hora).
- `.env.local.example`: nova variável `CRON_SECRET`.

## Fora de Escopo
- Interface de usuário para visualizar os digests gerados (página de leitura) — spec futura.
- Suporte real a fontes do tipo `twitter`: por decisão explícita desta spec, fontes `twitter` são reconhecidas mas tratadas como não suportadas por enquanto — falham de forma isolada (sem derrubar o digest do usuário), documentadas como limitação conhecida. Implementar via API paga do X é uma decisão de produto para uma spec futura.
- Precisão total de horário de verão no cálculo de `targetHourUTC` — já documentado como limitação conhecida na ADR 0001, não é reaberto aqui.
- Envio por e-mail/push/qualquer canal de notificação do digest pronto — esta spec só gera e persiste o conteúdo.
- Rate limiting/retry sofisticado entre múltiplas execuções do Cron (ex.: backoff exponencial) — o mecanismo de idempotência (RF-12) cobre o caso comum de disparo duplicado; otimizações adicionais ficam para quando houver escala real que justifique.

## Dados (Data Dictionary)

Nova subcoleção `users/{uid}/digests/{digestId}` (prevista desde a spec 002, definida formalmente aqui):

- `createdAt` (Timestamp): Not Null, imutável (`serverTimestamp()` quando criado).
- `status` (String): Not Null, um de `'processing' | 'completed' | 'failed'`.
- `isRead` (Boolean): Not Null, default `false`.
- `content` (Map, Nullable — só preenchido quando `status === 'completed'`):
  - `intro` (String): resumo introdutório curto.
  - `sections` (Array<Map>): cada item com `title` (String) e `summary` (String), agrupados por tópico de interesse do usuário.
- `tokensUsed` (Number, Nullable): total de tokens consumidos na chamada de IA, preenchido quando `status === 'completed'`.
- `errorMessage` (String, Nullable): preenchido apenas quando `status === 'failed'`.

## Requisitos Funcionais (Testáveis)

### US1 — Pipeline Completo do Digest (caminho feliz)
RF-1: Um endpoint `GET /api/cron/generate` MUST existir, exigindo o header `Authorization: Bearer <CRON_SECRET>`; requisições sem o segredo correto MUST retornar `401` sem iniciar qualquer processamento.
- Aceitação: Chamar o endpoint sem o header, ou com um valor incorreto, retorna `401` e nenhum documento é criado/alterado no Firestore.

RF-2: Ao ser acionado com sucesso, o sistema MUST consultar `users` filtrando por `schedule.targetHourUTC` igual à hora UTC corrente.
- Aceitação: Apenas usuários com `targetHourUTC` igual à hora atual são processados; usuários com outros horários não geram nenhum digest nessa execução.

RF-3: Para cada usuário elegível, o sistema MUST criar um documento em `users/{uid}/digests` com `status: 'processing'` antes de iniciar a agregação, usando `serverTimestamp()` para `createdAt`.
- Aceitação: Um digest com `status: 'processing'` existe assim que o processamento do usuário começa, antes de qualquer chamada externa (scraping ou IA).

RF-4: O sistema MUST buscar o conteúdo de todas as fontes `rss` e `website` do usuário em paralelo.
- Aceitação: O tempo total de agregação das fontes de um usuário é proporcional ao tempo da fonte mais lenta, não à soma de todas (evidência de paralelismo real, não sequencial).

RF-5: O texto extraído de cada fonte individual MUST ser truncado a um limite máximo de caracteres antes de ser combinado com as demais fontes.
- Aceitação: Nenhum texto de fonte individual enviado à IA excede o limite configurado, independentemente do tamanho da página/feed original.

RF-6: O sistema MUST enviar o texto agregado, os tópicos (`config.topics`) e a personalização de prompt (`config.promptCustomization`) do usuário para a API do modelo configurado (`config.gptModel`), exigindo uma saída estruturada compatível com o schema `intro` + `sections`.
- Aceitação: A resposta da IA é validada contra o schema estruturado antes de ser persistida; uma resposta fora do formato esperado é tratada como falha (RF-11), não persistida como sucesso.

RF-7: Ao concluir com sucesso, o sistema MUST atualizar o digest para `status: 'completed'`, preenchendo `content` e `tokensUsed`.
- Aceitação: Após uma execução bem-sucedida, o documento do digest tem `status: 'completed'`, `content.intro` e `content.sections` não vazios, e `tokensUsed` maior que zero.

RF-8: O endpoint MUST retornar um resumo da execução (quantos usuários foram processados) sem expor dados sensíveis de usuários individuais na resposta.
- Aceitação: A resposta do endpoint não contém e-mails, tokens ou conteúdo bruto de fontes — apenas contagens/status agregados.

### US2 — Resiliência a Falhas Parciais
RF-9: A falha ao buscar uma fonte individual MUST NOT interromper a agregação das demais fontes do mesmo usuário.
- Aceitação: Se uma das fontes de um usuário falhar (timeout, URL inválida, erro HTTP), as demais fontes continuam sendo agregadas normalmente, e o digest é gerado com o conteúdo disponível.

RF-10: A falha ao processar um usuário (agregação ou geração de IA) MUST NOT interromper o processamento dos demais usuários da mesma execução do Cron Job.
- Aceitação: Numa execução com múltiplos usuários elegíveis, uma falha total em um usuário não impede que os demais recebam seus digests normalmente.

RF-11: Quando a geração de um digest falhar (agregação sem conteúdo útil, erro da API de IA, ou resposta fora do schema esperado), o documento correspondente MUST ser atualizado para `status: 'failed'` com `errorMessage`, nunca deixado em `status: 'processing'`.
- Aceitação: Toda execução do pipeline para um usuário termina com o digest em `completed` ou `failed` — nunca preso em `processing` após a execução do Cron Job terminar.

### US3 — Proteção Contra Reprocessamento e Custos
RF-12: O sistema MUST NOT criar um novo digest para um usuário que já tenha um digest com `status: 'completed'` ou `status: 'processing'` criado no mesmo dia (fuso UTC).
- Aceitação: Disparar o endpoint duas vezes na mesma hora para o mesmo conjunto de usuários resulta em apenas um digest por usuário para aquele dia — a segunda chamada não cria duplicata nem gasta tokens novamente.

RF-13: Se a agregação de fontes não retornar nenhum texto utilizável (todas as fontes falharam ou estavam vazias), o sistema MUST NOT chamar a API de IA — o digest é marcado como `failed` diretamente.
- Aceitação: Um usuário cujas fontes falham completamente tem seu digest marcado como `failed`, e nenhuma chamada à API de IA é registrada para ele.

## Critérios de Sucesso
- SC-1: Uma execução do Cron Job processa todos os usuários elegíveis da hora corrente e retorna, sem exceder o tempo limite da função serverless.
- SC-2: Nenhuma chamada à API de IA acontece sem texto agregado disponível (RF-13).
- SC-3: Uma falha isolada em uma fonte ou em um usuário não impede que os demais usuários da mesma execução recebam seu digest (RF-9, RF-10).
- SC-4: Requisições sem o segredo correto nunca disparam processamento nem geram custo de tokens.
- SC-5: Nenhum digest permanece em `status: 'processing'` após a execução do Cron Job que o criou terminar.
- SC-6: Disparos duplicados do Cron para a mesma hora não geram digests duplicados nem custo de tokens duplicado.

## Cenários de Aceitação
1. Cenário: Geração bem-sucedida
   - Dado um usuário com `targetHourUTC` igual à hora atual, tópicos e ao menos uma fonte RSS/website válida configurados
   - Quando o Cron Job for acionado com o segredo correto
   - Então um digest é criado com `status: 'processing'`, depois atualizado para `completed` com `content` e `tokensUsed` preenchidos

2. Cenário: Fonte individual falha, digest ainda é gerado
   - Dado um usuário com duas fontes configuradas, uma inválida e uma válida
   - Quando o pipeline processar esse usuário
   - Então o digest é gerado normalmente com o conteúdo da fonte válida, sem falhar por causa da fonte inválida

3. Cenário: Todas as fontes falham
   - Dado um usuário cujas fontes configuradas falham todas
   - Quando o pipeline processar esse usuário
   - Então o digest é marcado como `failed`, e nenhuma chamada à API de IA é feita

4. Cenário: Requisição não autorizada
   - Dado um segredo ausente ou incorreto no header `Authorization`
   - Quando `GET /api/cron/generate` for chamado
   - Então a resposta é `401` e nenhum digest é criado

5. Cenário: Disparo duplicado na mesma hora
   - Dado um usuário que já tem um digest `completed` criado hoje
   - Quando o Cron Job for acionado novamente na mesma hora (ou hora seguinte, mesmo dia)
   - Então nenhum novo digest é criado para esse usuário

6. Cenário: Falha em um usuário não afeta os demais
   - Dado dois usuários elegíveis na mesma execução, um com fontes que causam erro na IA e outro com tudo funcionando
   - Quando o Cron Job processar ambos
   - Então o usuário com erro recebe um digest `failed` e o outro recebe um digest `completed`, ambos na mesma execução

## Entidades Chave
- `Digest` — documento em `users/{uid}/digests/{digestId}`, representando uma execução do pipeline para um usuário em um dia (ver Dados acima).
- `UserProfile.config` — já existente (spec 002), consumido como entrada do pipeline (`topics`, `sources`, `promptCustomization`, `gptModel`).
- `UserProfile.schedule` — já existente (spec 002/003), `targetHourUTC` é o critério de seleção do Cron Job.

## Assunções
- O projeto será implantado em uma plataforma compatível com `vercel.json`/Vercel Cron Jobs para o disparo automático; localmente, o endpoint é testado manualmente (`curl` com o segredo correto), como já praticado nas specs 005/006.
- Fontes `rss` são feeds XML válidos; fontes `website` são páginas HTML acessíveis publicamente (sem paywall/login).
- O texto agregado, mesmo truncado por fonte, cabe dentro da janela de contexto do `gpt-4o-mini` junto com o prompt de sistema e as preferências do usuário — não há necessidade de chunking/sumarização em múltiplas etapas nesta versão.
- `config.gptModel` já existe no perfil (spec 002, default `gpt-4o-mini`) mas não há UI para o usuário alterá-lo — o pipeline apenas respeita o valor armazenado.

## Dependências
- Conclusão das specs 002 (`config.topics`/`config.sources`/`config.promptCustomization`/`config.gptModel`), 003/005 (`schedule.targetHourUTC` calculado e persistido) e 005/006 (`src/lib/firebase/admin.ts`, padrão de endpoint autenticado).
- `OPENAI_API_KEY` (já previsto em `.env.local.example` desde a spec 001, nunca usado até agora).
- Nova variável `CRON_SECRET` para proteger o endpoint do Cron Job.
- Bibliotecas novas para parsing de RSS e extração de texto de HTML (a escolha específica fica para `plan.md`).

## Riscos e Mitigações
- Risco: Muitos usuários elegíveis na mesma hora fazem a execução do Cron Job exceder o tempo limite da função serverless.
  - Mitigação: Processamento por usuário isolado (RF-10) evita que um usuário lento bloqueie os demais; o tempo limite da rota é configurado explicitamente (`plan.md`) para o máximo permitido pela plataforma. Escala maior que isso (centenas de usuários por hora) é um problema de infraestrutura fora do escopo de um projeto de portfólio nesta fase.
  - Reaproveita a limitação já documentada na ADR 0001 sobre a granularidade horária do agendamento.
- Risco: Gasto de tokens com conteúdo vazio, fontes falhas ou reprocessamento duplicado.
  - Mitigação: RF-13 (não chama IA sem conteúdo) e RF-12 (idempotência diária) cobrem os dois casos mais prováveis de desperdício.
- Risco: Resposta da IA fora do formato esperado quebrar a renderização futura do digest.
  - Mitigação: RF-6 exige validação da resposta estruturada contra o schema antes de persistir; falha de formato é tratada como falha do pipeline (RF-11), não como sucesso parcial.
- Risco: Scraping de páginas HTML capturar muito ruído (menus, rodapés, anúncios) em vez do conteúdo relevante.
  - Mitigação: Estratégia de extração de texto documentada em `plan.md`; qualidade "boa o suficiente" é aceitável nesta fase — não é objetivo desta spec extração de conteúdo com qualidade de leitor de artigos.

## Artefatos Criados
- `specs/007-pipeline-geracao-digest/spec.md`
- `.specify/feature.json` apontando para `specs/007-pipeline-geracao-digest`

## Próximos Passos
- Rodar `/speckit.plan` para gerar `plan.md`, detalhando os módulos de serviço, a escolha de bibliotecas de parsing, o schema estruturado da IA e a configuração do `vercel.json`.
- Gerar `tasks.md` com `/speckit.tasks`.
- Implementar `scraperService.ts`, `aiService.ts`, `digestSchema.ts` e a rota `api/cron/generate`.

*Gerado em: 2026-07-28*
