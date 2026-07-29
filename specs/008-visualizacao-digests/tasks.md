# Tasks: Épico 2 (Motor da IA) — Visualização dos Digests Gerados

**Input**: Design documents from `/specs/008-visualizacao-digests/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install the new dependency this feature needs.

- [x] T001 Install `react-markdown` (`npm install react-markdown`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared rendering components both `/dashboard` and `/history` depend on.

**⚠️ CRITICAL**: No page work can begin until this phase is complete.

- [x] T002 Create `src/components/digests/DigestMarkdown.tsx`: a `react-markdown` wrapper with MD3-token-based component overrides (`p`, `strong`, `ul`, `li`), default configuration only (no raw-HTML plugins, per the spec's XSS mitigation).
- [x] T003 [P] Create `src/components/digests/DigestSkeleton.tsx`: a loading placeholder matching the digest card's structure, using Tailwind's `animate-pulse` (no new dependency).

**Checkpoint**: `DigestMarkdown` and `DigestSkeleton` render correctly in isolation before being wired into real pages.

---

## Phase 3: User Story - Dashboard com o Digest Mais Recente (Priority: P1)

**Goal**: `/dashboard` mostra o digest mais recente do usuário, com todos os estados tratados.

**Independent Test**: Um usuário com um digest `completed` mais recente vê o conteúdo formatado ao abrir `/dashboard`; um usuário com digest `processing` vê o skeleton; a transição para `completed` aparece sem reload.

- [x] T004 [US1] Extend `src/app/dashboard/page.tsx` (keeping the existing "Bem-vindo ao painel" greeting) to subscribe via `onSnapshot` to a query on `users/{uid}/digests` (`orderBy("createdAt", "desc")`, `limit(1)`), storing the latest digest (or `null` if none) in state (RF-1).
- [x] T005 [US1] Return the `unsubscribe` function from the `useEffect` so the listener is cancelled on unmount (RF-6, risk mitigation).
- [x] T006 [US1] Render `DigestSkeleton` while the initial snapshot hasn't arrived yet, or while the latest digest's `status` is `'processing'` (RF-2).
- [x] T007 [US1] Render `content.intro` and each `content.sections[].{title, summary}` via `DigestMarkdown` when `status === 'completed'` (RF-3).
- [x] T008 [US1] Render a friendly error message (no raw `errorMessage` exposed) when `status === 'failed'` (RF-4).
- [x] T009 [US1] Render an explanatory empty state when the user has no digest at all yet (query resolved, no documents) (RF-5).

**Checkpoint**: Os quatro estados (`processing`, `completed`, `failed`, vazio) funcionam corretamente na dashboard, incluindo a transição em tempo real.

---

## Phase 4: User Story - Página de Histórico com Paginação (Priority: P1)

**Goal**: `/history` lista os digests anteriores em lotes, alcançável a partir da navegação.

**Independent Test**: Um usuário com mais digests do que uma página consegue ver o primeiro lote e carregar mais clicando em um botão, sem a página buscar todos de uma vez.

- [x] T010 [US2] Create `src/app/history/page.tsx` wrapped in `ProtectedRoute` and rendering `AppHeader`, following the same pattern as `/dashboard`/`/settings` (RF-9). Verified: unauthenticated access redirects to `/login` (checked live in the browser).
- [x] T011 [US2] Implement cursor-based pagination (`orderBy("createdAt", "desc")`, `limit(PAGE_SIZE)`, `startAfter(cursor)`) with a "Carregar mais" button that fetches the next page and appends to the list, disabled while loading or when there's no more data (RF-7, RF-8).
- [x] T012 [US2] Render each list item with a formatted creation date (`Intl.DateTimeFormat`) and a truncated preview of `content.intro` via `DigestMarkdown` inside a `line-clamp-3` container (RF-10).
- [x] T013 [US2] For list items where `status !== 'completed'`, render a status label ("Gerando..."/"Falhou") instead of attempting to render `content` (RF-11).
- [x] T014 [US2] Add a `Link` to `/history` ("Histórico") in `src/components/AppHeader.tsx`'s navigation group, alongside Dashboard/Configurações/Sair (RF-12).

**Checkpoint**: `/history` é alcançável pela navegação, pagina corretamente, e trata itens não-`completed` sem quebrar.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [x] T015 [P] Add a note in `README.md` describing the dashboard's latest-digest view and the `/history` page.
- [x] T016 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [x] T017 [P] Manual validation of the 6 acceptance scenarios in spec.md: digest ready, digest processing, automatic transition, digest failed, no digest yet, and history navigation/pagination. Confirmed working end-to-end by the requester. Along the way, found and fixed a Firestore security rules gap: the `users/{uid}` rule from spec 002 didn't cascade to the `digests` subcollection (Firestore rules aren't inherited by subcollections), causing "missing or insufficient permissions" on both `/dashboard` and `/history` — added an explicit `match /digests/{digestId}` rule (read-only for the owning user; writes stay Admin-SDK-only).
- [x] T018 [P] After merge, write ADR 0005 (`docs/adrs/0005-*.md`) documenting the real-time `onSnapshot` subscription, cursor-based pagination, and safe AI-content markdown rendering patterns introduced in this spec, per plan.md's Constitution Check note.
