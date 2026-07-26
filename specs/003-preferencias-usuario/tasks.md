# Tasks: Preferências de Conteúdo e Agendamento do Usuário

**Input**: Design documents from `/specs/003-preferencias-usuario/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare the module layout for the settings feature. No new dependencies are needed — `react-hook-form`, `zod`, `@hookform/resolvers`, and `lucide-react` were already installed in spec 001.

- [ ] T001 Create the `src/lib/schemas/` and `src/lib/utils/` directories for the new settings modules.
- [ ] T002 [P] Confirm `react-hook-form`, `zod`, `@hookform/resolvers`, and `lucide-react` are present in `package.json` and resolve via `npm install`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build and test the two pure modules the settings page depends on. Nothing in later phases can be verified until this phase's tests pass.

**⚠️ CRITICAL**: No `/settings` page work can begin until this phase is complete.

- [ ] T003 Create `src/lib/schemas/settingsSchema.ts` with the Zod schema for `topics`, `sources`, `localTime`, and `promptCustomization`, exporting `SettingsFormValues`.
- [ ] T004 [P] Write unit tests in `src/lib/schemas/settingsSchema.test.ts` covering: empty `topics`, a source with an invalid URL, an empty `sources` array, `localTime` outside `HH:MM`, `promptCustomization` over 500 characters, and a fully valid payload (RF-7).
- [ ] T005 Create `src/lib/utils/time.ts` with `calculateTargetHourUTC(localTime, timezone)`.
- [ ] T006 [P] Write unit tests in `src/lib/utils/time.test.ts` covering the local-to-UTC conversion for at least two distinct IANA timezones plus a `timezone: 'UTC'` identity case (RF-7).
- [ ] T007 [P] Run `npm test` and confirm both new test files pass (CS-4 gate).

**Checkpoint**: `settingsSchema` and `calculateTargetHourUTC` are implemented and covered by passing unit tests.

---

## Phase 3: User Story 1 - Carregar e Exibir Preferências Existentes (Priority: P1)

**Goal**: O usuário autenticado abre `/settings` e vê o formulário protegido, pré-preenchido com seus dados atuais.

**Independent Test**: Logar, abrir `/settings`, e confirmar que os campos aparecem preenchidos com os valores salvos em `users/{uid}`.

- [ ] T008 [US1] Create `src/app/settings/page.tsx` wrapped in `ProtectedRoute`, using `useForm` with `zodResolver(settingsSchema)` and the default values from the technical brief.
- [ ] T009 [US1] Implement a `useEffect` in `settings/page.tsx` that `getDoc`s the current user's profile and calls `setValue` for `topics` (joined as a comma-separated string), `sources`, `localTime`, and `promptCustomization`.
- [ ] T010 [US1] Show a loading state (`isLoadingData`) while the profile is being fetched.
- [ ] T011 [US1] Validate that unauthenticated access to `/settings` redirects to `/login` via the existing `ProtectedRoute`.

**Checkpoint**: `/settings` renders pre-filled data for an authenticated user and redirects unauthenticated visitors.

---

## Phase 4: User Story 2 - Editar Fontes de Informação Dinamicamente (Priority: P1)

**Goal**: O usuário adiciona e remove fontes de informação livremente, com pelo menos uma exigida para salvar.

**Independent Test**: Adicionar uma fonte, preencher tipo e URL, remover uma fonte, e confirmar que o envio é bloqueado quando a lista de fontes fica vazia.

- [ ] T012 [US2] Wire `useFieldArray` for `sources` in `settings/page.tsx`.
- [ ] T013 [US2] Render each source row with a `type` select (`rss` / `twitter` / `website`), a `url` input, and a remove button.
- [ ] T014 [US2] Add an "Adicionar Fonte" button that appends a new empty source row.
- [ ] T015 [US2] Display Zod validation errors for `sources` (empty list, invalid URL) inline under the field.

**Checkpoint**: Fontes podem ser adicionadas/removidas dinamicamente e a validação de "pelo menos uma fonte" funciona na UI.

---

## Phase 5: User Story 3 - Salvar Preferências com Cálculo de UTC (Priority: P1)

**Goal**: Ao salvar, o app recalcula `schedule.targetHourUTC` e persiste as mudanças no Firestore sem sobrescrever campos imutáveis.

**Independent Test**: Alterar horário, tópicos e fontes, salvar, e confirmar via `getDoc` que `users/{uid}` reflete os novos valores e que `uid`/`email`/`createdAt` permanecem inalterados.

- [ ] T016 [US3] Implement `onSubmit` in `settings/page.tsx`: resolve `Intl.DateTimeFormat().resolvedOptions().timeZone`, call `calculateTargetHourUTC(data.localTime, userTimezone)`, and `updateDoc` using dot-path fields (`config.topics`, `config.sources`, `config.promptCustomization`, `schedule.localTime`, `schedule.timezone`, `schedule.targetHourUTC`).
- [ ] T017 [US3] Convert the `topics` string field into a trimmed, filtered array before persisting.
- [ ] T018 [US3] Disable the submit button and show "Salvando..." while `isSaving` is true.
- [ ] T019 [US3] Show a success/error message after the save attempt completes.
- [ ] T020 [US3] Manually confirm in the Firestore console that `uid`, `email`, and `createdAt` remain unchanged after saving.

**Checkpoint**: Salvar preferências atualiza `users/{uid}` corretamente, incluindo `targetHourUTC`, sem tocar nos campos imutáveis.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T021 [P] Add a note in `README.md` describing the `/settings` page and its purpose.
- [ ] T022 [P] Confirm `npx tsc --noEmit`, `npm run build`, and `npm run lint` all pass with the new files.
- [ ] T023 [P] Confirm `npm test` passes for `settingsSchema.test.ts` and `time.test.ts` (RF-7/CS-4 gate, re-run after all implementation is complete).
- [ ] T024 [P] Manual end-to-end validation: log in, edit preferences, save, reload `/settings`, and confirm persisted values match (Cenários de Aceitação 1 e 2 do spec).
