# Tasks: Autenticação por E-mail e Senha

**Input**: Design documents from `/specs/013-auth-email-senha/`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Schema, helpers extraídos e tratamento de erro, antes de qualquer fluxo novo.

**⚠️ CRITICAL**: Nenhum trabalho de US1/US2/US3 pode começar até esta fase estar completa.

- [x] T001 Create `src/lib/schemas/authSchema.ts`: `email` (string, formato de e-mail) e `password` (string, mínimo 6 caracteres).
- [x] T002 [P] Write `src/lib/schemas/authSchema.test.ts`: e-mail inválido falha, senha curta falha, payload válido passa. 4 testes, todos passando.
- [x] T003 Refactor `src/lib/firebase/auth.ts`: extrair `applyPersistence(keepSignedIn)` e `createProfile(idToken)` de dentro de `loginWithGoogle`, sem mudar seu comportamento observável.
- [x] T004 Add `export function mapAuthError(error: unknown): string` to `auth.ts`, mapeando `auth/email-already-in-use`, `auth/weak-password`, `auth/invalid-credential`/`auth/user-not-found`/`auth/wrong-password` (mesma mensagem genérica), `auth/too-many-requests`, `auth/invalid-email`, e um fallback genérico (RF-6).
- [x] T005 [P] Write `src/lib/firebase/auth.test.ts`: cada código mapeado produz a mensagem esperada; `wrong-password` e `user-not-found` produzem exatamente a mesma string; código desconhecido e erro não-Firebase caem no fallback. 5 testes, todos passando.
- [x] T006 [P] Run `npm test` and confirm all suites pass (novos e já existentes). Confirmado: 44/44 testes em 7 suites.

**Checkpoint**: Helpers e schema prontos e testados; `loginWithGoogle` continua funcionando (regressão zero — mesma lógica, só reorganizada em helpers).

---

## Phase 2: User Story - Criar Conta com E-mail e Senha (Priority: P1)

**Goal**: Um visitante consegue criar uma conta nova por e-mail/senha e chegar ao `/dashboard`.

**Independent Test**: Preencher e-mail e senha válidos no formulário de cadastro e enviar — chega ao `/dashboard` com perfil criado no Firestore.

- [x] T007 [US1] Implement `registerWithEmail(email, password, keepSignedIn)` in `auth.ts`: `applyPersistence` → `createUserWithEmailAndPassword` → `createProfile` (RF-1, RF-4).
- [x] T008 [US1] Rewrite `src/app/login/page.tsx`: formulário `react-hook-form` + `zodResolver(authSchema)` (e-mail, senha), estado `mode: "login" | "signup"`, botão de alternância "Criar conta"/"Já tenho conta", `onSubmitEmail` chamando `registerWithEmail` quando `mode === "signup"` (RF-1).
- [ ] T009 [US1] Manual validation: e-mail/senha inválidos são bloqueados antes de chamar o Firebase (RF-2); cadastrar um e-mail já em uso mostra a mensagem específica de `mapAuthError` (RF-3); cadastro bem-sucedido cria `users/{uid}` e redireciona pra `/dashboard` (RF-4). **Não verificado** — exige teste real do Paulo.

**Checkpoint**: Implementado; validação ao vivo pendente (T018).

---

## Phase 3: User Story - Entrar com E-mail e Senha (Priority: P1)

**Goal**: Um usuário com conta de e-mail/senha consegue entrar.

**Independent Test**: Informar credenciais corretas de uma conta já criada — chega ao `/dashboard`. Informar credenciais erradas — vê erro genérico, continua em `/login`.

- [x] T010 [US2] Implement `loginWithEmail(email, password, keepSignedIn)` in `auth.ts`: `applyPersistence` → `signInWithEmailAndPassword` → `createProfile` (idempotente, já existe) (RF-5, RF-7).
- [x] T011 [US2] Wire `onSubmitEmail` in `login/page.tsx` to call `loginWithEmail` when `mode === "login"` (RF-5).
- [ ] T012 [US2] Manual validation: login com credenciais corretas chega ao `/dashboard` (RF-5); login com e-mail inexistente e login com senha errada mostram a **mesma** mensagem de erro (RF-6); checkbox "Manter conectado" desmarcado no login por e-mail produz sessão que não sobrevive ao fechar o navegador, mesmo comportamento já validado pro Google na spec 011 (RF-7). **Não verificado** — exige teste real do Paulo.

**Checkpoint**: Implementado; validação ao vivo pendente (T018).

---

## Phase 4: User Story - Redefinir Senha Esquecida (Priority: P2)

**Goal**: Um usuário que esqueceu a senha consegue solicitar redefinição por e-mail.

**Independent Test**: Informar um e-mail e acionar "Esqueci minha senha" — vê mensagem de confirmação genérica, independente do e-mail existir ou não.

- [x] T013 [US3] Implement `resetPassword(email)` in `auth.ts`: `sendPasswordResetEmail`, erros mapeados via `mapAuthError` (RF-8).
- [x] T014 [US3] Add "Esqueci minha senha" link/button to `login/page.tsx`, visível só em `mode === "login"`; valida o e-mail digitado (`authSchema.shape.email.safeParse`) antes de chamar `resetPassword`; mostra mensagem de confirmação genérica em `resetSent` (RF-8, RF-9).
- [ ] T015 [US3] Manual validation: solicitar redefinição para um e-mail cadastrado e para um e-mail não cadastrado mostram a mesma mensagem de confirmação (RF-9). **Não verificado** — exige teste real do Paulo (recebimento de e-mail real).

**Checkpoint**: Implementado; validação ao vivo pendente (T018).

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [x] T016 [P] Add a note in `README.md`'s "Funcionalidades atuais" describing email/password sign-up, sign-in, and password reset on `/login`.
- [x] T017 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass. Todos os quatro verdes (44/44 testes).
- [ ] T018 [P] Manual end-to-end validation of the 5 acceptance scenarios in spec.md. **Não verificado** — pendente do Paulo.
