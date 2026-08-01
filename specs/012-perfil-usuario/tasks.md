# Tasks: Página de Perfil do Usuário

**Input**: Design documents from `/specs/012-perfil-usuario/`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Schema de validação e os dois endpoints autenticados, antes de qualquer UI.

**⚠️ CRITICAL**: Nenhum trabalho de US1/US2/US3 pode começar até esta fase estar completa.

- [ ] T001 Create `src/lib/schemas/profileSchema.ts`: `displayName` (string, 1-100 caracteres) e `socialLinks.{twitter,instagram,linkedin}` (URL opcional, `.optional().or(z.literal(""))`).
- [ ] T002 [P] Write `src/lib/schemas/profileSchema.test.ts`: nome vazio falha, nome válido passa, URL malformada falha, campo de rede social vazio passa, URL válida passa.
- [ ] T003 Create `src/app/api/profile/route.ts` with a local `verifyRequest` helper (Bearer token → `getAdminAuth().verifyIdToken()`, distinguindo erros `app/*` de `auth/*`, mesmo padrão de `/api/settings`) and a `POST` handler that validates the body with `profileSchema` and updates `users/{uid}` (`displayName` + `profile.socialLinks`, convertendo string vazia para `null`) via Admin SDK (RF-2, RF-6).
- [ ] T004 Add a `DELETE` handler to the same `route.ts`: batch-delete `users/{uid}/digests/*` + o documento `users/{uid}`, e só depois `getAdminAuth().deleteUser(uid)` — parando (retornando erro) se o batch falhar, sem tentar apagar a conta (RF-9).
- [ ] T005 [P] Run `npm test` and confirm `profileSchema.test.ts` passes.

**Checkpoint**: Os dois endpoints existem e validam/persistem corretamente, verificável via `curl` com um ID token real antes de qualquer UI.

---

## Phase 2: User Story - Ver e Editar Informações Básicas (Priority: P1)

**Goal**: `/profile` mostra os dados do Google e permite editar o nome.

**Independent Test**: Abrir `/profile`, ver nome/e-mail/foto corretos; mudar o nome e salvar; conferir que `/dashboard` reflete o novo nome sem logout.

- [ ] T006 [US1] Create `src/app/profile/page.tsx` wrapped in `ProtectedRoute` + `AppHeader`, com formulário `react-hook-form` + `zodResolver(profileSchema)`, seguindo o mesmo padrão visual/estrutural de `/settings`.
- [ ] T007 [US1] Load initial values: `displayName`/`email`/`photoURL` de `user` (Firebase Auth, via `useAuth()`) e `socialLinks` de `users/{uid}.profile.socialLinks` (Firestore `getDoc`, mesmo padrão de leitura de `/settings`) (RF-1).
- [ ] T008 [US1] Render a foto (`<img>` simples, sem `next/image`), o nome (campo editável) e o e-mail (texto somente leitura, sem input) (RF-1, RF-3).
- [ ] T009 [US1] Wire `onSubmit`: chamar `updateProfile(user, { displayName })` (Firebase Auth) primeiro, depois `POST /api/profile` com o corpo completo (`displayName` + `socialLinks`) (RF-2).
- [ ] T010 [US1] Add `<Link href="/profile">Perfil</Link>` to `src/components/AppHeader.tsx`'s navigation group (RF-11).

**Checkpoint**: Cenários de aceitação 1 e 6 do spec passam — editar o nome reflete no `/dashboard` sem logout/login, e `/profile` é alcançável pelo `AppHeader`.

---

## Phase 3: User Story - Cadastrar Redes Sociais (Priority: P2)

**Goal**: Três campos opcionais de rede social, validados e persistentes.

**Independent Test**: Preencher uma URL válida de Twitter/X e salvar; recarregar e confirmar que persiste. Preencher um valor inválido e confirmar que não salva.

- [ ] T011 [US2] Add three optional URL inputs (Twitter/X, Instagram, LinkedIn) to the form in `profile/page.tsx`, registrados em `socialLinks.twitter`/`socialLinks.instagram`/`socialLinks.linkedin` (RF-4).
- [ ] T012 [US2] Confirm validation errors render for malformed URLs and that empty fields are accepted (already guaranteed pelo `profileSchema`/`zodResolver` — task de verificação, não implementação nova) (RF-5).
- [ ] T013 [US2] Manual validation: preencher um link válido, salvar, recarregar `/profile` e confirmar que o valor persiste (RF-6).

**Checkpoint**: Cenários de aceitação 2 e 3 do spec passam.

---

## Phase 4: User Story - Excluir Conta (Priority: P3)

**Goal**: Exclusão de conta permanente, atrás de confirmação digitada, apagando tudo na ordem certa.

**Independent Test**: Digitar a palavra de confirmação errada — botão continua desabilitado. Digitar certo e confirmar — conta, perfil, preferências e digests somem; usuário é desconectado e levado à página inicial.

- [ ] T014 [US3] Create `src/components/profile/DeleteAccountDialog.tsx`: seção "Zona de risco" com aviso, campo de texto de confirmação, e botão de exclusão desabilitado enquanto o texto não for exatamente a palavra de confirmação (`disabled={confirmText !== "EXCLUIR" || isDeleting}`) (RF-7, RF-8).
- [ ] T015 [US3] Wire the delete button to `DELETE /api/profile` (com o ID token do usuário); em sucesso, chamar `logout()` e redirecionar para `/` (RF-9, RF-10).
- [ ] T016 [US3] Render `<DeleteAccountDialog />` in `profile/page.tsx`, visualmente separado do formulário de edição (RF-7).

**Checkpoint**: Cenários de aceitação 4 e 5 do spec passam.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T017 [P] Add a note in `README.md`'s "Funcionalidades atuais" describing the new `/profile` page (edição de nome, redes sociais, exclusão de conta).
- [ ] T018 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [ ] T019 [P] Manual end-to-end validation of the 5 acceptance scenarios in spec.md — **atenção redobrada no cenário 4 (exclusão de conta)**: usar uma conta de teste descartável, não a conta pessoal real do Paulo, dado o caráter irreversível da operação.
- [ ] T020 [P] After merge, write an ADR (`docs/adrs/0008-*.md`) documenting the account-deletion ordering pattern (digests → user doc → Auth account, stop on first failure) — primeira operação destrutiva/irreversível do projeto, per `plan.md`'s Constitution Check note.
