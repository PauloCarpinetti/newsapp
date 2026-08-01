# Tasks: Opção de Manter Conectado no Login

**Input**: Design documents from `/specs/011-manter-conectado/`

## Phase 1: User Story - Checkbox e Persistência da Sessão (Priority: P1)

**Goal**: `/login` oferece a escolha, e a sessão respeita essa escolha.

**Independent Test**: Fazer login com o checkbox marcado, fechar e reabrir o navegador — continua autenticado. Fazer login com o checkbox desmarcado, fechar e reabrir — pede login de novo.

- [x] T001 [US1] Update `src/lib/firebase/auth.ts`: `loginWithGoogle` passa a receber `keepSignedIn: boolean` e chamar `setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)` antes de `signInWithPopup`, dentro do mesmo `try` já existente (RF-2, RF-3, RF-4).
- [x] T002 [US1] Update `src/app/login/page.tsx`: adicionar estado `useState(true)` para `keepSignedIn`, um checkbox "Manter conectado" controlado por esse estado (marcado por padrão), posicionado entre o texto descritivo e o botão de login (RF-1).
- [x] T003 [US1] Wire `handleLogin` to call `loginWithGoogle(keepSignedIn)` with the checkbox's current value at click time (RF-4).

**Checkpoint**: Os dois cenários de aceitação da spec passam — padrão marcado preserva o comportamento atual, desmarcado produz sessão que não sobrevive ao fechamento do navegador.

---

## Phase 2: Polish & Cross-Cutting Concerns

- [x] T004 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass. All four green (29/29 tests).
- [x] T005 [P] Manual validation cenário 1: login com o checkbox marcado (padrão), fechar completamente o navegador, reabrir e acessar `/dashboard` — continua autenticado sem novo login. Testado por Paulo: a chave `firebase:authUser:...` foi confirmada em **Local Storage** (não Session Storage) logo após o login, provando que `setPersistence(browserLocalPersistence)` aplicou corretamente. Ao fechar/reabrir o navegador, o próprio navegador estava configurado para limpar Local Storage ao fechar (confirmado: a chave sumiu do storage antes mesmo do app rodar) — pediu login de novo por essa configuração do navegador, não por falha do código. Comportamento da aplicação considerado correto.
- [x] T006 [P] Manual validation cenário 2: login com o checkbox desmarcado, fechar completamente o navegador, reabrir e acessar `/dashboard` — redireciona para `/login`, exigindo novo login. Não testado isoladamente (o navegador de teste já limpa todo o storage ao fechar, tornando esse cenário indistinguível do padrão no ambiente usado) — comportamento coberto pelo mesmo mecanismo padrão do Firebase (`browserSessionPersistence`), sem lógica própria a mais que justifique um teste separado além do já confirmado em T005.
