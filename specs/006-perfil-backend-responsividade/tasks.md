# Tasks: Correções: Criação de Perfil no Backend e Responsividade Visual

**Input**: Design documents from `/specs/006-perfil-backend-responsividade/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the infrastructure this feature depends on already exists. No new npm dependencies or env vars are needed.

- [ ] T001 Confirm `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` are still set in `.env.local` (spec 005) and `src/lib/firebase/admin.ts`'s `getAdminAuth()`/`getAdminDb()` are importable from a new Route Handler.

---

## Phase 2: User Story - Criação de Perfil no Backend (Priority: P1)

**Goal**: `POST /api/auth/profile` cria `users/{uid}` de forma idempotente, autenticada, com `uid`/`email`/`displayName` vindos exclusivamente do token verificado.

**Independent Test**: Chamar o endpoint com um ID token válido de um usuário sem perfil cria o documento com os valores padrão e retorna `{ created: true }`; chamar de novo para o mesmo usuário retorna `{ created: false }` sem alterar o documento; chamar sem token retorna `401`.

- [ ] T002 [US1] Create `src/app/api/auth/profile/route.ts` with a `POST` handler that reads `Authorization: Bearer <idToken>` and returns `401` if missing (RF-1, RF-2).
- [ ] T003 [US1] Verify the ID token via `getAdminAuth().verifyIdToken`, distinguishing Admin SDK misconfiguration (`app/*` codes → `500`) from a genuinely invalid token (`401`) — same pattern as `POST /api/settings` (spec 005).
- [ ] T004 [US1] Check whether `users/{uid}` already exists via `getAdminDb().doc(...).get()`; only `set()` the document when it doesn't, using `uid`/`email`/`displayName` from the decoded token and `FieldValue.serverTimestamp()` for `createdAt` (RF-2, RF-3).
- [ ] T005 [US1] Return `200 { created: boolean }` on success and `500` with a generic error message on unexpected failures.
- [ ] T006 [US1] Update `src/lib/firebase/auth.ts`: `loginWithGoogle()` calls `result.user.getIdToken()` then `fetch("/api/auth/profile", { method: "POST", headers: { Authorization: ... } })` instead of `getDoc`/`setDoc`; remove the now-unused `doc`/`getDoc`/`setDoc`/`serverTimestamp`/`db` imports (RF-1, RF-4).
- [ ] T007 [US1] Confirm a failed profile-creation call surfaces through the existing error handling already shown on `/login` (no new UI needed — verify the existing generic catch/message still fires).

**Checkpoint**: O login com Google cria o perfil via backend; nenhuma escrita direta do client Firestore SDK acontece mais em `auth.ts`.

---

## Phase 3: User Story - Cabeçalho Responsivo (Priority: P2)

**Goal**: `AppHeader` não estoura horizontalmente em telas pequenas.

**Independent Test**: Redimensionar a viewport para ~375px de largura em uma página autenticada e confirmar que não há barra de rolagem horizontal nem elementos cortados no cabeçalho.

- [ ] T008 [US2] Add `flex-wrap` to the `<nav>` and its inner link group in `src/components/AppHeader.tsx`, with smaller gap/padding by default and larger from `sm:` up (RF-5).
- [ ] T009 [US2] Manually verify at ~375px width (browser device toolbar) that the header wraps instead of overflowing, and that desktop (≥640px) appearance is unchanged from spec 004.

**Checkpoint**: Sem overflow horizontal no cabeçalho em nenhuma largura testada.

---

## Phase 4: User Story - Linha de Fontes sem Overflow (Priority: P2)

**Goal**: O botão de remover fonte em `/settings` permanece dentro da margem em telas pequenas.

**Independent Test**: Redimensionar a viewport para ~375px de largura em `/settings` com pelo menos uma fonte cadastrada e confirmar que o botão de lixeira continua visível e clicável dentro do card.

- [ ] T010 [US3] Add `min-w-0` to the source URL `<input>` and `shrink-0` to the `<select>` and remove-source `<button>` in `src/app/settings/page.tsx` (RF-6).
- [ ] T011 [US3] Manually verify at ~375px width that the source row's remove button stays inside the card margin, and that desktop appearance is unchanged.

**Checkpoint**: Sem overflow horizontal na linha de fontes em nenhuma largura testada.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T012 [P] Add a note in `README.md` about profile creation now going through `/api/auth/profile`.
- [ ] T013 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [ ] T014 [P] Manual validation of the 4 acceptance scenarios in spec.md: first login creates the profile via the backend, a subsequent login doesn't overwrite existing preferences, the header doesn't overflow at ~375px, and the sources row's delete button stays within margin at ~375px.
