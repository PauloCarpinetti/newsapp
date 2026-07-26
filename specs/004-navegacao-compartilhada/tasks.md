# Tasks: Navegação Compartilhada, Tema Claro/Escuro e Base Visual (Material Design 3)

**Input**: Design documents from `/specs/004-navegacao-compartilhada/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare Tailwind to consume theme-aware color tokens. No new dependencies are needed.

- [ ] T001 Configure `darkMode: ["selector", '[data-theme="dark"]']` in `tailwind.config.ts` and extend `theme.colors` with the MD3 semantic tokens mapped to CSS variables (per plan.md).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the color tokens, base reset, and no-flash theme bootstrapping that every page and component depends on.

**⚠️ CRITICAL**: No page migration or `ThemeToggle` work can begin until this phase is complete.

- [ ] T002 Define the MD3 light-theme CSS variables in `:root` of `src/app/globals.css` (RF-9).
- [ ] T003 Define the MD3 dark-theme override in `:root[data-theme="dark"]` of `src/app/globals.css` (RF-9).
- [ ] T004 [P] Add `color-scheme` per theme, a `::selection` rule using the MD3 tokens, and a consistent `:focus-visible` outline in `globals.css` (RF-10).
- [ ] T005 Create `src/lib/utils/theme.ts` with a pure `resolveInitialTheme(stored: string | null, prefersDark: boolean): 'light' | 'dark'` helper.
- [ ] T006 Add an inline anti-flash script in the `<head>` of `src/app/layout.tsx` that reads `localStorage.theme` (falling back to `prefers-color-scheme`) and sets `data-theme` on `<html>` before hydration (RF-8, mirrors T005's logic in plain JS since a blocking script can't import a bundled module).

**Checkpoint**: `globals.css` has both theme token sets and the base reset; the app never flashes the wrong theme on load.

---

## Phase 3: User Story - Navegação entre Páginas Autenticadas e Logout (Priority: P1)

**Goal**: Usuários autenticados navegam entre `/dashboard` e `/settings` e encerram a sessão pela UI.

**Independent Test**: Logado em `/dashboard`, clicar em "Configurações" leva a `/settings`; clicar em "Sair" encerra a sessão e redireciona para `/login`.

- [ ] T007 [US1] Create `src/components/AppHeader.tsx` with links to `/dashboard` and `/settings`, and a "Sair" button that calls `logout()` and redirects to `/login` (RF-1, RF-2).
- [ ] T008 [US1] Render `AppHeader` inside `src/app/dashboard/page.tsx`, removing the standalone "Editar preferências" link added in spec 003.
- [ ] T009 [US1] Render `AppHeader` inside `src/app/settings/page.tsx`.
- [ ] T010 [US1] Confirm `/` and `/login` do not render `AppHeader` (RF-5).
- [ ] T011 [US1] Confirm logging out redirects to `/login`, and that a subsequent direct visit to `/dashboard` or `/settings` also redirects to `/login` (RF-3).

**Checkpoint**: Navegação entre páginas autenticadas e logout funcionam ponta a ponta.

---

## Phase 4: User Story - CTA de Login na Landing Page (Priority: P1)

**Goal**: Um visitante não autenticado consegue chegar em `/login` a partir de `/`.

**Independent Test**: Abrir `/` sem sessão ativa e clicar no botão de login leva a `/login`.

- [ ] T012 [US2] Add a prominent "Entrar" button/CTA in `src/app/page.tsx` linking to `/login` (RF-4).

**Checkpoint**: A landing page tem um caminho clicável até o login.

---

## Phase 5: User Story - Alternância de Tema Claro/Escuro (Priority: P1)

**Goal**: O usuário alterna entre tema claro e escuro em qualquer página, com a escolha persistida.

**Independent Test**: Alternar o tema em qualquer página, recarregar, e confirmar que o tema escolhido continua ativo.

- [ ] T013 [US3] Create `src/components/ThemeToggle.tsx`: lê `data-theme` atual do `<html>`, alterna ao clicar, persiste em `localStorage.theme`, usando os ícones `Sun`/`Moon` do `lucide-react` (RF-6).
- [ ] T014 [US3] Render `ThemeToggle` globally in `src/app/layout.tsx` so it appears on every page — public and authenticated.
- [ ] T015 [US3] Confirm toggling the theme and reloading the page preserves the selected theme (RF-7).
- [ ] T016 [US3] Confirm that with no stored preference, the app defaults to the OS `prefers-color-scheme` on first load (RF-8) — manual test toggling the OS/browser color scheme setting.

**Checkpoint**: O tema alterna em qualquer página, persiste entre reloads, e respeita a preferência do sistema por padrão.

---

## Phase 6: User Story - Migração Visual para os Tokens MD3 (Priority: P1)

**Goal**: Todas as páginas usam os tokens de cor MD3 em vez de classes Tailwind hardcoded, e a aparência é consistente entre navegadores.

**Independent Test**: Alternar o tema em cada página e confirmar que todas respondem (fundo, texto, botões, bordas mudam juntos), sem cores fixas remanescentes.

- [ ] T017 [US4] Migrate `src/app/page.tsx` (landing) from hardcoded `slate-950`/`cyan-400`/etc. classes to the MD3 token-based classes (`bg-background`, `text-on-background`, `bg-primary text-on-primary`, etc.).
- [ ] T018 [US4] Migrate `src/app/login/page.tsx` to the MD3 token-based classes.
- [ ] T019 [US4] Migrate `src/app/dashboard/page.tsx` to the MD3 token-based classes.
- [ ] T020 [US4] Migrate `src/app/settings/page.tsx` to the MD3 token-based classes, including form controls, error text (`text-error`), and success feedback.
- [ ] T021 [US4] Manually verify visual consistency (spacing, typography, form control appearance) across at least two browser engines (e.g., Chromium and Firefox) in both themes (RF-10/SC-6).

**Checkpoint**: Nenhuma cor hardcoded fora do sistema de tema permanece nas quatro páginas; a UI responde à alternância de tema de ponta a ponta.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T022 [P] Add a note in `README.md` describing the shared navigation header and the light/dark theme toggle.
- [ ] T023 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [ ] T024 [P] Manual end-to-end validation of the 6 acceptance scenarios in spec.md (navegação, logout, acesso pós-logout, CTA da landing, alternância/persistência de tema, tema padrão pelo sistema).
