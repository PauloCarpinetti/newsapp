# Tasks: Autenticação e Criação de Perfil de Usuário

**Input**: Design documents from `/specs/002-criar-perfil-usuario/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare Firebase authentication and Firestore profile creation support.

- [x] T001 Create `src/lib/firebase/auth.ts` with Google login, logout, and Firestore profile creation logic.
- [x] T002 Create `src/contexts/AuthContext.tsx` to expose `user` and `loading` via `onAuthStateChanged`.
- [x] T003 Create `src/components/ProtectedRoute.tsx` to guard private pages and redirect unauthenticated users to `/login`.
- [x] T004 Create `src/app/login/page.tsx` with a Google sign-in button and login state handling.
- [x] T005 [P] Ensure `src/lib/firebase/config.ts` exists and exports `auth` and `db`.
- [x] T006 [P] Verify `.env.local.example` includes placeholders for Firebase client keys and OpenAI API key.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the core authentication flow that user story work depends on.

- [x] T007 Implement profile creation logic in `src/lib/firebase/auth.ts` to create `users/{uid}` if missing.
- [x] T008 Initialize default Firestore profile fields: `config.topics`, `config.sources`, `config.gptModel`, `config.promptCustomization`, `schedule.localTime`, `schedule.timezone`, and `schedule.targetHourUTC`.
- [x] T009 [P] Use `serverTimestamp()` for `createdAt` when creating the Firestore user profile document.
- [x] T010 [P] Ensure `loginWithGoogle` returns the authenticated Firebase user or throws a descriptive error.

---

## Phase 3: User Story 1 - Autenticação e Perfil Inicial (Priority: P1)

**Goal**: Enable users to sign in with Google and automatically provision their Firestore profile.

**Independent Test**: Perform Google login, then verify the `users/{uid}` Firestore document exists with the expected structure.

- [x] T011 [US1] Implement the login button click handler in `src/app/login/page.tsx` to call `loginWithGoogle`.
- [x] T012 [US1] Add redirection to `/dashboard` after successful login in `src/app/login/page.tsx`.
- [ ] T013 [US1] Validate that a first-time login creates `users/{uid}` with `uid`, `email`, `createdAt`, `config`, and `schedule`. — requires a real Firebase project (`.env.local` still has no live credentials); not yet run against actual Google login.
- [ ] T014 [US1] Validate that subsequent logins do not recreate or overwrite the existing profile document improperly. — same blocker as T013, needs a real Firebase project to test.

---

## Phase 4: User Story 2 - Auth State Management (Priority: P1)

**Goal**: Provide reusable auth state across the client using React Context.

**Independent Test**: Confirm a child component receives `user` and `loading` from `AuthContext` after authentication.

- [x] T015 [US2] Implement `AuthProvider` in `src/contexts/AuthContext.tsx` and wrap the app in `src/app/layout.tsx`.
- [x] T016 [US2] Use `onAuthStateChanged(auth, ...)` to keep the context state in sync with Firebase.
- [x] T017 [US2] Confirm `loading` transitions to `false` after auth state resolves.
- [x] T018 [US2] Add a `useAuth` hook export for components to consume auth state.

---

## Phase 5: User Story 3 - Route Protection (Priority: P1)

**Goal**: Prevent unauthenticated access to protected pages and redirect to login.

**Independent Test**: Access a protected page without authentication and verify the route changes to `/login`.

- [x] T019 [US3] Implement redirect logic in `src/components/ProtectedRoute.tsx` using `useRouter`.
- [x] T020 [US3] Show a loading placeholder while auth state is initializing.
- [x] T021 [US3] Ensure `ProtectedRoute` returns content only when `user` is not null.
- [ ] T022 [US3] Document how to wrap pages with `ProtectedRoute` in a future readme or quickstart note. — not yet added to README.md.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Make the auth/profile feature robust, documented, and ready for expansion.

- [x] T023 [P] Add inline error logging in `src/lib/firebase/auth.ts` for Google login failures.
- [x] T024 [P] Add a note in `README.md` describing the authentication feature and how to configure Firebase env vars.
- [x] T025 [P] Ensure the created user profile keys are aligned with the data dictionary in `spec.md`.
- [x] T026 [P] Review and simplify any client-side Firebase code to avoid direct secrets exposure.
