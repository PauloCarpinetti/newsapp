# Tasks: Next.js Foundation Setup

**Input**: Design documents from `/specs/001-setup-nextjs-foundation/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the project base and install the dependencies required for future features.

- [ ] T001 Create the Next.js App Router foundation in `src/` using `create-next-app@latest` with TypeScript, Tailwind CSS, ESLint, and `src/` directory support.
- [ ] T002 Install the base dependencies in `package.json`: `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`.
- [ ] T003 [P] Install the planned product dependencies for the next phase: `firebase`, `firebase-admin`, `openai`, `react-hook-form`, `zod`, `@hookform/resolvers`, `lucide-react`.
- [ ] T004 [P] Create `.env.local.example` in the project root with placeholder keys for Firebase and OpenAI.
- [ ] T005 [P] Add `.env.local` to `.gitignore` and verify that local secrets will not be committed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provide the core files and app identity that every user story depends on.

- [ ] T006 Create `src/app/globals.css` with Tailwind directives and default body styles.
- [ ] T007 Create `src/app/page.tsx` with the AI Digest Aggregator landing UI.
- [ ] T008 Create `src/lib/firebase/config.ts` with the Firebase client initialization singleton.
- [ ] T009 [P] Verify `package.json` contains `dev` and `build` scripts and the project structure follows `src/` App Router conventions.
- [ ] T010 Create `README.md` section documenting how to run `npm run dev` and how to configure `.env.local`.

---

## Phase 3: User Story 1 - Base Application Ready (Priority: P1)

**Goal**: Deliver an executable Next.js base app that is visually distinct from the default boilerplate.

**Independent Test**: Run `npm run dev` and confirm the browser shows the AI Digest Aggregator landing page.

- [ ] T011 [US1] Validate that `src/app/page.tsx` renders a title with `AI Digest Aggregator`.
- [ ] T012 [US1] Confirm the app starts locally without errors using `npm run dev`.
- [ ] T013 [US1] Confirm `npm run build` completes successfully.

---

## Phase 4: User Story 2 - Dependencies Installed (Priority: P1)

**Goal**: Ensure the application is ready for the next development cycle by having the essential libraries installed.

**Independent Test**: Install and resolve all planned product dependencies without manual intervention.

- [ ] T014 [US2] Verify `package.json` includes `firebase`, `firebase-admin`, `openai`, `react-hook-form`, `zod`, `@hookform/resolvers`, and `lucide-react`.
- [ ] T015 [US2] Validate that `npm install` succeeds in the project root.
- [ ] T016 [US2] Document dependency usage expectations in `README.md`.

---

## Phase 5: User Story 3 - Secure Local Environment (Priority: P1)

**Goal**: Keep sensitive configuration out of version control and document local environment setup.

**Independent Test**: Confirm `.env.local` is ignored and `.env.local.example` contains the required keys.

- [ ] T017 [US3] Ensure `.env.local` is listed in `.gitignore`.
- [ ] T018 [US3] Ensure `.env.local.example` contains placeholders for `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `OPENAI_API_KEY`.
- [ ] T019 [US3] Add a note in `README.md` stating that `.env.local` must not be committed.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the project foundation is stable, documented, and ready for the next feature.

- [ ] T020 [P] Review and remove any default Next.js boilerplate files that are not needed.
- [ ] T021 [P] Confirm styling and layout are clean, with Tailwind directives only in `src/app/globals.css`.
- [ ] T022 [P] Add a quickstart section to `README.md` for local setup and running the dev server.
- [ ] T023 [P] Confirm the feature branch naming and task tracking are ready for the next pull request.
