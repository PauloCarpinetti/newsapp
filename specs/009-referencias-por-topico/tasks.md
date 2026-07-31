# Tasks: Resumos Detalhados e Referências por Tópico

**Input**: Design documents from `/specs/009-referencias-por-topico/`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Preservar a URL de cada item agregado até a IA, sem quebrar o pipeline existente. Nenhuma dependência nova é necessária nesta spec, então não há uma fase de Setup separada.

**⚠️ CRITICAL**: Nenhum trabalho de US1/US2/US3 pode começar até esta fase estar completa.

- [x] T001 Add `references: z.array(z.string()).max(3)` to each section object in `src/lib/schemas/digestSchema.ts`.
- [x] T002 Refactor `src/lib/services/scraperService.ts`: introduce `AggregatedItem = { text: string; url: string | null }`; rewrite `extractFromRss` to return one `AggregatedItem` per feed entry (`url: item.link ?? null`, `MAX_CHARS_PER_ITEM = 300` per item) and `extractFromWebsite` to return a single-element array (`url` = the source's own URL, `MAX_CHARS_PER_SOURCE = 3000` unchanged); rewrite `aggregateSources` to `flatMap` the fulfilled results into `AggregatedItem[]`, preserving the existing `Promise.allSettled` per-source failure isolation and `console.warn` on rejection (ADR 0004). Verified live: a real RSS feed (G1) + a real website source produced 11 items, 10 with real per-article `item.link` URLs (truncated to 300 chars each) and 1 website item with the source's own URL (3000 chars).
- [x] T003 [P] Add `formatItemsForPrompt(items: AggregatedItem[]): string` to `src/lib/services/aiService.ts` (pure function — one `[Fonte N]` block per item with an explicit `URL: ...` line).
- [x] T004 Update `generateDigestWithAI`'s signature in `aiService.ts` to accept `items: AggregatedItem[]` instead of `rawText: string`, using `formatItemsForPrompt(items)` as the `user` message content (no prompt wording change yet — plumbing only).
- [x] T005 Update `src/app/api/cron/generate/route.ts`: rename the `aggregateSources` call site's result to `items`, change the "no usable content" guard from `!rawText.trim()` to `items.length === 0`, and pass `items` into `generateDigestWithAI`. Verified via `tsc`/`build`; the route's own hour-gating meant no real user matched the current UTC hour during testing, so this specific call site wasn't exercised live through the HTTP endpoint — the underlying functions it calls were (T002/T004 live verification).
- [x] T006 [P] Run `npm test` and confirm `scraperService.test.ts` (`truncateText`) still passes unchanged. Confirmed: 29/29 tests passing across all 4 suites. Also found and fixed a pre-existing gap while wiring this up: no `vitest.config.ts` existed, so the `@/*` path alias (used by `aiService.ts`) wasn't resolvable by Vitest — added `vitest.config.ts` with the alias, matching `tsconfig.json`.

**Checkpoint**: O pipeline compila e roda ponta a ponta com itens estruturados, com comportamento equivalente ao anterior — antes de qualquer mudança de prompt ou UI.

---

## Phase 2: User Story - Resumos Mais Detalhados (Priority: P1)

**Goal**: Os resumos por tópico ganham mais profundidade, sem inventar conteúdo.

**Independent Test**: Gerar um digest real e comparar o detalhamento de `sections[].summary` com um digest anterior à spec, mantendo fidelidade ao conteúdo agregado.

- [x] T007 [US1] Add the "resumo mais detalhado" instruction line to the system prompt in `aiService.ts` (RF-1).
- [x] T008 [US1] Manual validation: chamado `aggregateSources`/`generateDigestWithAI` diretamente com fontes reais (RSS do G1 + website) e `OPENAI_API_KEY` real. Resumos gerados têm 3-5 frases com contexto real (nomes, eventos, motivação), claramente mais detalhados que o formato anterior de 1-2 frases — sem inventar fatos fora do conteúdo agregado. Não foi disparado via `/api/cron/generate` real porque nenhum usuário de teste tinha `schedule.targetHourUTC` batendo com a hora corrente no momento do teste; a lógica exercitada é idêntica (mesma função chamada pela rota).

**Checkpoint**: Resumos novos são perceptivelmente mais detalhados, sem regressão de fidelidade ao conteúdo agregado.

---

## Phase 3: User Story - Referências por Tópico (Priority: P1)

**Goal**: Cada seção ganha até 3 referências reais, com garantia de código (não só de prompt) contra URLs inventadas.

**Independent Test**: Gerar um digest com uma mistura de fontes RSS e website; conferir no Firestore que cada `sections[].references` só contém URLs reais, no máximo 3, vazio quando não há fonte relevante com URL.

- [x] T009 [US2] Add the reference-citation-rule line to the system prompt in `aiService.ts`: até 3 URLs por seção, citadas apenas entre as fornecidas nas linhas `URL: ...`, nunca inventadas, lista vazia quando nenhuma se encaixa (RF-2, RF-3, RF-4).
- [x] T010 [US2] Implement `filterKnownReferences(references: string[], knownUrls: Set<string>): string[]` (pure function) in `aiService.ts` — filtra pra manter só URLs conhecidas e limita a 3 (RF-3, defesa em profundidade).
- [x] T011 [US2] Wire `filterKnownReferences` into `generateDigestWithAI`'s post-processing: montar `knownUrls` a partir de `items.map(i => i.url)` (descartando `null`) e aplicar o filtro a `sections[].references` antes de retornar `content` (RF-3, RF-5).
- [x] T012 [P] Write `src/lib/services/aiService.test.ts`: `formatItemsForPrompt` formata itens com e sem URL corretamente; `filterKnownReferences` mantém só URLs conhecidas, corta em 3, e devolve lista vazia para entrada vazia/sem correspondência. 8 testes, todos passando.
- [x] T013 [US2] Manual validation: chamado o pipeline real (mesmo teste do T008) com uma fonte RSS (G1) e uma website (Jovem Pan) misturadas. As 2 seções geradas trouxeram `references` (2 URLs cada, dentro do limite de 3) e toda URL retornada correspondia exatamente a uma URL real da lista agregada (2 artigos G1 numa seção; 1 artigo G1 + a URL da fonte website na outra) — nenhuma URL inventada. Não persistido em Firestore real (chamada direta às funções, não via a rota `/api/cron/generate` — ver nota do T005); a garantia de "sem invenção" é a mesma testada em T012 e reproduzida aqui com dados reais.

**Checkpoint**: Nenhuma URL inventada chega a ser persistida, mesmo que a IA não siga a instrução do prompt à risca.

---

## Phase 4: User Story - Exibição das Referências (Priority: P1)

**Goal**: A caixa colapsável de referências aparece na dashboard, fechada por padrão, sem quebrar digests antigos.

**Independent Test**: Abrir `/dashboard` com um digest cujo tópico tem referências — ver a caixa fechada, expandir, clicar num link e confirmar que abre em nova aba.

- [x] T014 [US3] Create `src/components/digests/DigestReferences.tsx`: `<details>/<summary>` nativo (fechado por padrão, sem `open`), fundo `bg-surface-variant`/`text-on-surface-variant` (mesmo par de tokens do `DigestSkeleton`), retorna `null` quando `references.length === 0` (RF-6, RF-7, RF-9).
- [x] T015 [US3] Each link inside `DigestReferences` opens in a new tab (`target="_blank" rel="noopener noreferrer"`) (RF-8).
- [x] T016 [US3] Wire `<DigestReferences references={section.references ?? []} />` into `src/app/dashboard/page.tsx`'s per-section rendering block, right after the `DigestMarkdown` summary (RF-6, RF-9; `?? []` cobre o Cenário 5 — digest antigo sem o campo).
- [ ] T017 [US3] Manual validation: um tópico com referências mostra o accordion fechado por padrão e expande ao clicar; um tópico sem referências não mostra nenhuma caixa; um digest gerado antes desta spec (sem o campo `references`) continua renderizando normalmente. **Não verificado** — exige login real com Google no `/dashboard`, que só Paulo pode fazer; código revisado (mesmo padrão de `<details>` nativo + `?? []` sem lógica condicional arriscada), mas sem confirmação visual ao vivo ainda.

**Checkpoint**: Os 5 cenários de aceitação da spec funcionam ponta a ponta na dashboard real.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [x] T018 [P] Add a note in `README.md`'s "Funcionalidades atuais" describing the more detailed summaries and per-topic references.
- [x] T019 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass. All four green (29/29 tests, 0 lint warnings, build succeeded).
- [ ] T020 [P] Manual end-to-end validation of the 5 acceptance scenarios in spec.md (RSS references, website-only reference, topic without any URL, expand interaction, old digest without the field). Scenarios 1-3 (data correctness) verified live via direct pipeline calls (T008/T013). Scenarios 4-5 (UI interaction, old-digest compatibility) still need Paulo's live check on `/dashboard` — same gap as T017.
- [ ] T021 [P] After merge, write ADR 0007 (`docs/adrs/0007-*.md`) documenting the structured URL-attributed aggregation + citation-restricted AI prompt + defensive server-side reference filtering pattern introduced in this spec, per `plan.md`'s Constitution Check note.
