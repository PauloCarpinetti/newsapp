# Tasks: Correções: Criação de Perfil no Backend e Responsividade Visual

**Input**: Design documents from `/specs/006-perfil-backend-responsividade/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the infrastructure this feature depends on already exists. No new npm dependencies or env vars are needed.

- [x] T001 Confirm `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` are still set in `.env.local` (spec 005) and `src/lib/firebase/admin.ts`'s `getAdminAuth()`/`getAdminDb()` are importable from a new Route Handler.

---

## Phase 2: User Story - Criação de Perfil no Backend (Priority: P1)

**Goal**: `POST /api/auth/profile` cria `users/{uid}` de forma idempotente, autenticada, com `uid`/`email`/`displayName` vindos exclusivamente do token verificado.

**Independent Test**: Chamar o endpoint com um ID token válido de um usuário sem perfil cria o documento com os valores padrão e retorna `{ created: true }`; chamar de novo para o mesmo usuário retorna `{ created: false }` sem alterar o documento; chamar sem token retorna `401`.

- [x] T002 [US1] Create `src/app/api/auth/profile/route.ts` with a `POST` handler that reads `Authorization: Bearer <idToken>` and returns `401` if missing (RF-1, RF-2). Verified via `curl`: no header → `401 {"error":"Não autenticado."}`.
- [x] T003 [US1] Verify the ID token via `getAdminAuth().verifyIdToken`, distinguishing Admin SDK misconfiguration (`app/*` codes → `500`) from a genuinely invalid token (`401`) — same pattern as `POST /api/settings` (spec 005). Verified via `curl`: fake token → `401 {"error":"Token inválido."}` (Admin SDK is correctly configured, so this hit the real invalid-token path, not the misconfiguration path).
- [x] T004 [US1] Check whether `users/{uid}` already exists via `getAdminDb().doc(...).get()`; only `set()` the document when it doesn't, using `uid`/`email`/`displayName` from the decoded token and `FieldValue.serverTimestamp()` for `createdAt` (RF-2, RF-3).
- [x] T005 [US1] Return `200 { created: boolean }` on success and `500` with a generic error message on unexpected failures.
- [x] T006 [US1] Update `src/lib/firebase/auth.ts`: `loginWithGoogle()` calls `result.user.getIdToken()` then `fetch("/api/auth/profile", { method: "POST", headers: { Authorization: ... } })` instead of `getDoc`/`setDoc`; remove the now-unused `doc`/`getDoc`/`setDoc`/`serverTimestamp`/`db` imports (RF-1, RF-4).
- [x] T007 [US1] Confirm a failed profile-creation call surfaces through the existing error handling already shown on `/login` (no new UI needed — verify the existing generic catch/message still fires).

**Checkpoint**: O login com Google cria o perfil via backend; nenhuma escrita direta do client Firestore SDK acontece mais em `auth.ts`.

---

## Phase 3: User Story - Cabeçalho Responsivo (Priority: P2)

**Goal**: `AppHeader` não estoura horizontalmente em telas pequenas.

**Independent Test**: Redimensionar a viewport para ~375px de largura em uma página autenticada e confirmar que não há barra de rolagem horizontal nem elementos cortados no cabeçalho.

- [x] T008 [US2] Add `flex-wrap` to the `<nav>` and its inner link group in `src/components/AppHeader.tsx`, with smaller gap/padding by default and larger from `sm:` up (RF-5). — superseded by T008b after manual testing.
- [x] T008b [US2] Revise `AppHeader` to a stacked layout: centered title ("AI Digest Aggregator") on its own row, with Dashboard/Configurações/Sair centered together on the row below (logout moves from `justify-between` into the nav group); `ThemeToggle` stays untouched (RF-5).
- [x] T009 [US2] Manually verify at ~375px width (browser device toolbar) that the header shows the centered title/nav layout without overflow, and that desktop appearance is acceptable too (this is now the layout at all widths, not just small screens). — confirmed by requester.

**Checkpoint**: Sem overflow horizontal no cabeçalho em nenhuma largura testada; título centralizado, navegação (incluindo logout) centralizada na linha abaixo.

---

## Phase 4: User Story - Linhas de Formulário sem Overflow em `/settings` (Priority: P2)

**Goal**: Os botões "Remover fonte" e "Adicionar" (tópicos) permanecem dentro da margem em telas pequenas.

**Independent Test**: Redimensionar a viewport para ~375px de largura em `/settings` e confirmar que o botão de lixeira de cada fonte e o botão "Adicionar" de tópicos continuam visíveis e clicáveis dentro do card.

- [x] T010 [US3] Add `min-w-0` to the source URL `<input>` and `shrink-0` to the `<select>` and remove-source `<button>` in `src/app/settings/page.tsx` (RF-6).
- [x] T010b [US3] Add `min-w-0` to the topic-add `<input>` and `shrink-0` to the "Adicionar" `<button>` in `src/app/settings/page.tsx` (RF-7) — same overflow bug, confirmed by manual testing after T010 shipped.
- [x] T011 [US3] Manually verify at ~375px width that both the source row's remove button and the topic-add row's "Adicionar" button stay inside the card margin, and that desktop appearance is unchanged. — confirmed by requester.

**Checkpoint**: Sem overflow horizontal em nenhuma linha do formulário de `/settings`, em nenhuma largura testada.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [x] T012 [P] Add a note in `README.md` about profile creation now going through `/api/auth/profile`.
- [x] T013 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [x] T014 [P] Manual validation of the 5 acceptance scenarios in spec.md: first login creates the profile via the backend, a subsequent login doesn't overwrite existing preferences, the header shows the centered title/nav layout without overflow at ~375px, the sources row's delete button stays within margin at ~375px, and the topic-add row's "Adicionar" button stays within margin at ~375px. — confirmed working end-to-end by the requester.
