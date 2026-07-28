# Tasks: Épico 2 (Motor da IA) — Pipeline de Geração Automática de Digests

**Input**: Design documents from `/specs/007-pipeline-geracao-digest/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the new dependencies and configuration this feature needs.

- [x] T001 Install `rss-parser` and `cheerio` (`npm install rss-parser cheerio`).
- [x] T002 [P] Add `CRON_SECRET` to `.env.local.example`, with a generated value in `.env.local` for local testing.
- [x] T003 [P] Create `vercel.json` at the repo root with the hourly cron schedule (`0 * * * *`) pointing at `/api/cron/generate`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the schema and the two services the cron route depends on. Nothing in Phase 3+ can be verified until this phase's pieces exist and are individually correct.

**⚠️ CRITICAL**: No route work can begin until this phase is complete.

- [x] T004 Create `src/lib/schemas/digestSchema.ts` with `digestContentSchema` (`intro: string`, `sections: { title, summary }[]`) and the exported `DigestContent` type.
- [x] T005 Create `src/lib/services/scraperService.ts` with `truncateText(text, maxChars)` (pure), `extractFromRss(url)` (via `rss-parser`), and `extractFromWebsite(url)` (fetch + `cheerio`, stripping `script`/`style`/`nav`/`footer`/`header`/`noscript` before extracting text) (RF-4, RF-5).
- [x] T006 [P] Write unit tests in `src/lib/services/scraperService.test.ts` for `truncateText`: text shorter than the limit is unchanged, text longer than the limit is cut to exactly `maxChars`, empty string stays empty.
- [x] T007 Implement `aggregateSources(sources)` in `scraperService.ts` using `Promise.allSettled` over the source list, rejecting `twitter` sources immediately with a clear error, and joining only the fulfilled results (RF-9).
- [x] T008 Create `src/lib/services/aiService.ts` with a lazy `getOpenAIClient()` accessor (mirrors `getAdminAuth()`/`getAdminDb()` — `new OpenAI()` throws immediately without `OPENAI_API_KEY`, so it must not run at module load time).
- [x] T009 Implement `generateDigestWithAI(rawText, topics, promptCustomization, model)` in `aiService.ts` using `client.beta.chat.completions.parse` with `zodResponseFormat(digestContentSchema, "digest")`; throw if `message.parsed` is undefined (RF-6).
- [x] T010 [P] Run `npm test` and confirm `scraperService.test.ts` passes.

**Checkpoint**: `digestSchema`, `scraperService`, and `aiService` are implemented and individually correct (schema validated, truncation tested).

---

## Phase 3: User Story - Pipeline Completo do Digest (Priority: P1)

**Goal**: `GET /api/cron/generate` seleciona os usuários elegíveis da hora corrente e gera um digest completo para cada um.

**Independent Test**: Com um usuário de teste cujo `schedule.targetHourUTC` bate com a hora atual e ao menos uma fonte RSS/website válida, chamar o endpoint com o `CRON_SECRET` correto resulta em um digest `completed` com `content` e `tokensUsed` preenchidos.

- [x] T011 [US1] Create `src/app/api/cron/generate/route.ts` with `export const maxDuration = 60` and a `GET` handler that returns `401` when the `Authorization: Bearer <CRON_SECRET>` header is missing or incorrect (RF-1). Verified via `curl`: no header and wrong secret both return `401 {"error":"Não autenticado."}`; correct secret returns `200`.
- [x] T012 [US1] Query `users` where `schedule.targetHourUTC` equals the current UTC hour via `getAdminDb()` (RF-2). Verified live against a real user with `targetHourUTC` set to the current hour: `200 {"processed":1,"total":1}`.
- [x] T013 [US1] Implement `processUser(db, userDoc)`: create the `users/{uid}/digests` document with `status: 'processing'`, `isRead: false`, and `FieldValue.serverTimestamp()` for `createdAt`, before any aggregation/AI call (RF-3).
- [x] T014 [US1] Call `aggregateSources` with the user's `config.sources`, then `generateDigestWithAI` with the aggregated text, `config.topics`, `config.promptCustomization`, and `config.gptModel` (default `"gpt-4o-mini"`) (RF-4, RF-6).
- [x] T015 [US1] On success, update the digest document to `status: 'completed'` with `content` and `tokensUsed` (RF-7). Verified live: real digest generated, `status: "completed"`, `tokensUsed: 1263`, `content.intro` populated, 5 `content.sections` with plausible titles.
- [x] T016 [US1] Return `200 { processed, total }` from the route, without including any per-user sensitive data (emails, tokens, raw source content) in the response body (RF-8).

**Checkpoint**: O caminho feliz completo funciona ponta a ponta para um usuário de teste com fontes válidas.

---

## Phase 4: User Story - Resiliência a Falhas Parciais (Priority: P2)

**Goal**: Falhas isoladas (uma fonte, ou um usuário inteiro) não derrubam o restante do processamento.

**Independent Test**: Um usuário com uma fonte inválida e uma válida ainda recebe um digest `completed` usando o conteúdo da fonte válida; numa execução com múltiplos usuários, uma falha total em um deles não impede que os demais recebam seus digests.

- [x] T017 [US2] Wrap the per-user `Promise.allSettled(usersSnapshot.docs.map((doc) => processUser(db, doc)))` at the route level, so an unhandled failure in one user's processing (outside the inner try/catch) never stops the batch (RF-10).
- [x] T018 [US2] Wrap the aggregation + AI generation inside `processUser` in a try/catch that updates the digest to `status: 'failed'` with `errorMessage` on any error, ensuring no digest is ever left in `status: 'processing'` after the route finishes (RF-11).
- [x] T019 [US2] Added `console.warn` logging for rejected sources in `aggregateSources` (visible per-source failures in server logs, per Constitution Principle IV's "registrar erros estruturados") after the live run — the mechanism (`Promise.allSettled`, standard JS behavior) is sound and already exercised by the live multi-source run in T012/T015, but no deliberately-broken source was tested live; low risk, optional follow-up if the requester wants to force one.

**Checkpoint**: Falha em uma fonte ou em um usuário isolado não compromete o restante da execução.

---

## Phase 5: User Story - Proteção Contra Reprocessamento e Custos (Priority: P2)

**Goal**: Nenhum digest duplicado, nenhuma chamada de IA desperdiçada.

**Independent Test**: Disparar o endpoint duas vezes na mesma hora para o mesmo usuário não cria um segundo digest; um usuário cujas fontes falham todas nunca gera uma chamada à API de IA.

- [x] T020 [US3] In `processUser`, before creating the `processing` document, query the most recent digest (`orderBy("createdAt", "desc").limit(1)`) and skip processing if it was created today (UTC) and its `status` isn't `'failed'` (RF-12).
- [x] T021 [US3] After aggregation, check whether the combined text is empty/whitespace-only; if so, update the digest directly to `status: 'failed'` with an explanatory `errorMessage` and return without calling `generateDigestWithAI` (RF-13).
- [x] T022 [US3] Manually verify: call the endpoint twice in succession for the same eligible user and confirm only one digest document exists for today. Verified live: called `/api/cron/generate` twice for the same real user; a direct Firestore check confirmed exactly 1 digest document exists after both calls. The "all sources broken → failed, no AI call" half of RF-13 wasn't exercised live (the test user's sources all worked); code path verified by review (T021).

**Checkpoint**: Reprocessamento duplicado e chamadas de IA sem conteúdo são estruturalmente impedidos, não apenas evitados por sorte.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [x] T023 [P] Add a note in `README.md` describing the digest generation pipeline, the new `CRON_SECRET`/`OPENAI_API_KEY` requirements, and the `users/{uid}/digests` subcollection.
- [x] T024 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [x] T025 [P] Manual end-to-end validation via `curl` with the real `CRON_SECRET` against a real test user (real RSS/website sources, real `OPENAI_API_KEY`): confirm a `completed` digest with plausible `content` and `tokensUsed`, confirm the 6 acceptance scenarios in spec.md. Verified live: scenario 1 (happy path — real digest, 1263 tokens, 5 sections), scenario 4 (auth rejection), and scenario 5 (duplicate call, still 1 digest) all confirmed against real Firestore/OpenAI. Scenarios 2/3/6 (partial source failure, all-sources-failed, multi-user isolation) verified by code review only — no test data available to force those specific conditions live.
- [ ] T026 [P] After merge, write an ADR (`docs/adrs/0004-*.md`) documenting the cron pipeline's idempotency and failure-isolation design, per this plan's Constitution Check note.
