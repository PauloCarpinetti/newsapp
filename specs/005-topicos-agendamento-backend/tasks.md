# Tasks: Épico 2 (Motor da IA) — Tags de Tópicos e Agendamento com Cálculo Backend

**Input**: Design documents from `/specs/005-topicos-agendamento-backend/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the Admin SDK credentials this feature depends on are in place. No new npm dependencies are needed (`firebase-admin` and `zod` are already installed).

- [ ] T001 Confirm `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set with real values in `.env.local` (placeholders have existed since spec 001 but were never used).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the schema change and the Admin SDK singleton that both the endpoint and the UI depend on.

**⚠️ CRITICAL**: No endpoint or UI work can begin until this phase is complete.

- [ ] T002 Update `src/lib/schemas/settingsSchema.ts`: change `topics` from `z.string()` to `z.array(z.string().min(1)).min(1).max(10)`, and add a `timezone: z.string().min(1)` field (RF-2).
- [ ] T003 [P] Update `src/lib/schemas/settingsSchema.test.ts` for the new `topics` shape: valid array, empty array, an 11-item array (exceeds max), and an array containing an empty string.
- [ ] T004 Create `src/lib/firebase/admin.ts` with a lazy Admin SDK singleton (`adminAuth`, `adminDb`) using `cert()` from `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`/`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, replacing literal `\n` in the private key with real newlines.
- [ ] T005 [P] Run `npm test` and confirm `settingsSchema.test.ts` passes with the updated cases (CS-4 equivalent gate for this spec).

**Checkpoint**: Schema validates topics as tagged array; Admin SDK singleton is ready to be used by the endpoint.

---

## Phase 3: User Story - Endpoint Autenticado de Preferências (Priority: P1)

**Goal**: `POST /api/settings` calcula `targetHourUTC` no servidor e persiste as preferências em `users/{uid}`, com o `uid` vindo exclusivamente do token verificado.

**Independent Test**: Chamar o endpoint com um ID token válido e um payload correto retorna `200` com `targetHourUTC` calculado e o Firestore reflete os novos valores; chamar sem token (ou com token inválido) retorna `401` e nada muda no Firestore.

- [ ] T006 [US1] Create `src/app/api/settings/route.ts` with a `POST` handler that reads the `Authorization: Bearer <idToken>` header and returns `401` if it's missing (RF-4, RF-5).
- [ ] T007 [US1] Verify the ID token with `adminAuth.verifyIdToken`, returning `401` on failure; extract `uid` from the decoded token only (RF-5).
- [ ] T008 [US1] Validate the request body with the updated `settingsSchema` (including `timezone`), returning `400` with the Zod issues on failure.
- [ ] T009 [US1] Calculate `targetHourUTC` via `calculateTargetHourUTC(localTime, timezone)` (imported from `src/lib/utils/time.ts`, no reimplementation) (RF-6).
- [ ] T010 [US1] Write `config.topics`, `config.sources`, `config.promptCustomization`, `schedule.localTime`, `schedule.timezone`, and `schedule.targetHourUTC` to `users/{uid}` via `adminDb`, using dot-path fields so `uid`/`email`/`createdAt` stay untouched.
- [ ] T011 [US1] Return `200 { targetHourUTC, timezone }` on success and `500` with a generic (non-leaking) error message on unexpected failures (RF-8).

**Checkpoint**: O endpoint funciona isoladamente (testável via `curl`/Postman com um ID token real) antes de qualquer mudança na UI.

---

## Phase 4: User Story - Tags de Tópicos na UI (Priority: P1)

**Goal**: O usuário adiciona/remove tópicos como tags individuais, respeitando o limite de 10.

**Independent Test**: Adicionar tags até o limite de 10 e confirmar que uma 11ª é bloqueada; remover uma tag e confirmar que só ela desaparece.

- [ ] T012 [US2] Replace the single comma-separated `topics` text input in `src/app/settings/page.tsx` with a tag input: a text field + Enter/button to add, rendering each topic as a removable pill (RF-1).
- [ ] T013 [US2] Wire the tag list to `setValue("topics", ...)` so it stays in sync with `settingsSchema` validation (min 1, max 10).
- [ ] T014 [US2] Disable/block adding a new tag once 10 are already present, surfacing the Zod max-length message otherwise (RF-2).
- [ ] T015 [US2] Update the `useEffect` that loads existing data to set `topics` directly as an array from Firestore (no more `.join(", ")`), since `config.topics` is already stored as an array.

**Checkpoint**: A UI de tags funciona de ponta a ponta contra os dados existentes no Firestore.

---

## Phase 5: User Story - Salvamento via Backend (Priority: P1)

**Goal**: O envio do formulário deixa de escrever direto no Firestore e passa a usar o endpoint autenticado.

**Independent Test**: Salvar preferências e confirmar, via inspeção de rede, que a única chamada de escrita é `POST /api/settings`; nenhuma chamada `updateDoc`/`setDoc` do client SDK ocorre.

- [ ] T016 [US3] Replace the `updateDoc(doc(db, "users", user.uid), {...})` call in `onSubmit` with `user.getIdToken()` + `fetch("/api/settings", { method: "POST", ... })` (RF-4).
- [ ] T017 [US3] Remove the now-unused `updateDoc`/`doc` imports from `settings/page.tsx` tied to the save path (keep `getDoc`/`doc` used for loading existing data).
- [ ] T018 [US3] Surface the endpoint's error response (`400`/`401`/`500`) through the existing feedback UI in `settings/page.tsx`, without leaving the form in an inconsistent state (RF-8).

**Checkpoint**: O fluxo completo (UI de tags + endpoint) funciona de ponta a ponta pela interface.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T019 [P] Add a note in `README.md` about the `/api/settings` endpoint and the Admin SDK env vars now being required for `/settings` to work end-to-end.
- [ ] T020 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [ ] T021 [P] Manual validation of the 4 acceptance scenarios in spec.md: add/remove tags, hit the 10-tag limit, save via the backend endpoint, and confirm an unauthorized/invalid-token request is rejected without altering Firestore.
