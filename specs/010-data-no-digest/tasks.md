# Tasks: Data de Geração no Título do Digest

**Input**: Design documents from `/specs/010-data-no-digest/`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Extrair o formatter compartilhado antes de usá-lo nos dois lugares.

- [x] T001 Create `src/lib/utils/date.ts` exporting `digestDateFormatter` (`Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" })`).
- [x] T002 Update `src/app/history/page.tsx` to import `digestDateFormatter` from `src/lib/utils/date.ts` instead of defining its own module-local `dateFormatter` constant; remove the now-duplicate local definition.

**Checkpoint**: `/history` continua funcionando exatamente igual, agora usando o formatter compartilhado.

---

## Phase 2: User Story - Data Real no Cabeçalho do Digest (Priority: P1)

**Goal**: `/dashboard` mostra a data real de `createdAt` em vez do texto fixo "hoje".

**Independent Test**: Abrir `/dashboard` com um digest `completed` e confirmar que o cabeçalho mostra a data/hora real de criação, formatada igual a `/history`.

- [x] T003 [US1] Add `createdAt?: { toDate: () => Date }` to the `LatestDigest` type in `src/app/dashboard/page.tsx` (RF-1).
- [x] T004 [US1] Replace the fixed "Seu digest de hoje" heading with `Seu digest de {digestDateFormatter.format(latestDigest.createdAt.toDate())}`, falling back to "hoje" only if `createdAt` is somehow absent (RF-1, RF-2).

**Checkpoint**: O cenário de aceitação do spec passa — data real visível, formatada igual às duas telas.

---

## Phase 3: Polish & Cross-Cutting Concerns

- [x] T005 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass. All four green (29/29 tests).
- [x] T006 [P] Manual validation: abrir `/dashboard` com um digest `completed` real e confirmar visualmente que a data aparece corretamente e bate com a mesma data mostrada em `/history` para o mesmo digest. Confirmado por Paulo em localhost.
