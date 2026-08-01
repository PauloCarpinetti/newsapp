# Autenticação por E-mail e Senha

**Short name:** auth-email-senha

**Feature Branch**: `013-auth-email-senha`

**Created**: 2026-08-01

**Status**: Draft

## Resumo
`/login` ganha cadastro e login por e-mail e senha, além do já existente "Entrar com Google", usando o método de sign-in "E-mail/senha" já habilitado no Firebase Console (só faltava suporte no app). Inclui redefinição de senha ("Esqueci minha senha").

## Contexto e Motivação
Hoje o único jeito de entrar no app é login com Google. O sign-in method de e-mail/senha já está ativado no Firebase Authentication, mas não há nenhuma UI nem código que o utilize — usuários sem (ou que não querem usar) uma conta Google não têm como acessar o produto.

## Objetivos
- Um visitante MUST conseguir criar uma conta nova com e-mail e senha.
- Um usuário existente MUST conseguir entrar com e-mail e senha.
- Um usuário que esqueceu a senha MUST conseguir solicitar uma redefinição por e-mail.
- O checkbox "Manter conectado" (spec 011) MUST valer igualmente para login por e-mail/senha, não só para Google.
- Contas criadas por e-mail/senha MUST ter o mesmo perfil inicial no Firestore (`users/{uid}`) que contas Google já têm hoje — mesmo endpoint, mesmo formato de dado.

## Escopo (In Scope)
- `src/lib/firebase/auth.ts`: novas funções `registerWithEmail(email, password, keepSignedIn)`, `loginWithEmail(email, password, keepSignedIn)` e `resetPassword(email)`.
- `src/lib/schemas/authSchema.ts` (novo): validação de e-mail/senha via Zod, reaproveitado no cadastro e no login.
- `src/app/login/page.tsx`: alternância entre "Entrar com Google" (já existente) e um formulário de e-mail/senha; dentro do formulário, alternância entre modo "Entrar" e modo "Criar conta"; link "Esqueci minha senha".
- Nenhuma mudança em `/api/auth/profile` — o endpoint já cria o documento `users/{uid}` a partir de qualquer token verificado, independente do provedor de login usado para gerá-lo.

## Fora de Escopo
- Verificação de e-mail (link de confirmação antes de liberar acesso) — decisão confirmada com o usuário: contas por e-mail/senha têm acesso liberado imediatamente após o cadastro, igual ao Google hoje. Pode virar spec futura.
- Vincular uma conta de e-mail/senha a uma conta Google já existente do mesmo e-mail (account linking) — cada método de login gera um `uid` independente nesta versão.
- Política de senha além do mínimo já imposto pelo próprio Firebase (6 caracteres) — sem regras adicionais de complexidade (maiúsculas, símbolos, etc.).
- Captcha/rate limiting customizado além do que o Firebase Authentication já aplica nativamente contra tentativas abusivas.
- Qualquer mudança em `/profile` (spec 012) — trocar a senha de uma conta já existente fica fora desta spec.

## Dados (Data Dictionary)
Nenhum campo novo. Contas criadas por e-mail/senha usam exatamente o mesmo documento `users/{uid}` (spec 002) que contas Google — `email` vem do Firebase Auth, `displayName` fica `null` inicialmente (editável depois em `/profile`, spec 012, já que o cadastro por e-mail/senha não coleta nome).

## Requisitos Funcionais (Testáveis)

### US1 — Criar Conta com E-mail e Senha (Priority: P1)
RF-1: A tela `/login` MUST oferecer uma opção para criar uma conta nova com e-mail e senha, alternativa ao "Entrar com Google".
- Aceitação: A partir de `/login`, é possível alternar para um formulário de e-mail e senha e enviá-lo para criar uma conta.

RF-2: Um e-mail em formato inválido ou uma senha com menos de 6 caracteres MUST ser rejeitado antes de tentar criar a conta, com uma mensagem de erro clara.
- Aceitação: Tentar cadastrar com `"nao-e-email"` ou uma senha de 3 caracteres mostra erro de validação e não chega a chamar o Firebase.

RF-3: Tentar criar uma conta com um e-mail já cadastrado MUST mostrar uma mensagem de erro específica, não um erro genérico.
- Aceitação: Cadastrar duas vezes o mesmo e-mail mostra uma mensagem tipo "Este e-mail já está em uso", não "Erro inesperado".

RF-4: Ao criar a conta com sucesso, o sistema MUST preparar o perfil do usuário (mesmo endpoint `POST /api/auth/profile` já usado pelo login Google) e levar o usuário para `/dashboard`.
- Aceitação: Depois do cadastro, o usuário chega em `/dashboard` autenticado, com um documento `users/{uid}` criado no Firestore.

### US2 — Entrar com E-mail e Senha (Priority: P1)
RF-5: A tela `/login` MUST oferecer login com e-mail e senha para uma conta já existente.
- Aceitação: Um usuário com conta de e-mail/senha já criada consegue entrar informando as mesmas credenciais.

RF-6: Credenciais incorretas (e-mail não cadastrado ou senha errada) MUST mostrar uma mensagem de erro genérica o suficiente para não revelar se o e-mail existe ou não (mesmo comportamento padrão do Firebase Authentication).
- Aceitação: Tentar entrar com e-mail inexistente e tentar entrar com senha errada para um e-mail existente mostram a mesma mensagem de erro ao usuário.

RF-7: O checkbox "Manter conectado" (spec 011) MUST se aplicar igualmente ao login por e-mail/senha — mesma persistência (`browserLocalPersistence`/`browserSessionPersistence`) escolhida para o login com Google.
- Aceitação: Login por e-mail/senha com o checkbox desmarcado produz uma sessão que não sobrevive ao fechar o navegador, igual ao já comportamento já validado para Google (spec 011).

### US3 — Redefinir Senha Esquecida (Priority: P2)
RF-8: A tela `/login` MUST oferecer uma opção "Esqueci minha senha", que envia um e-mail de redefinição para o endereço informado.
- Aceitação: Informar um e-mail e acionar "Esqueci minha senha" dispara o envio do e-mail de redefinição do Firebase.

RF-9: Após solicitar a redefinição, o sistema MUST mostrar uma mensagem de confirmação genérica (não revelando se aquele e-mail tem ou não uma conta associada).
- Aceitação: Solicitar redefinição para um e-mail cadastrado e para um e-mail não cadastrado mostram a mesma mensagem de confirmação.

## Critérios de Sucesso
- SC-1: Um visitante sem conta Google consegue criar uma conta e chegar ao `/dashboard` autenticado, usando só e-mail e senha.
- SC-2: Nenhuma senha com menos de 6 caracteres chega a ser enviada ao Firebase.
- SC-3: Mensagens de erro de autenticação nunca revelam se um e-mail específico está ou não cadastrado (nem no login, nem na redefinição de senha).
- SC-4: O comportamento do checkbox "Manter conectado" é idêntico entre login por Google e login por e-mail/senha.

## Cenários de Aceitação
1. Cenário: Cadastro bem-sucedido
   - Dado um visitante em `/login` sem conta
   - Quando ele preenche e-mail e senha válidos no formulário de cadastro e envia
   - Então chega ao `/dashboard` autenticado, com perfil criado no Firestore

2. Cenário: Cadastro com e-mail já em uso
   - Dado um visitante tentando cadastrar um e-mail que já tem conta
   - Quando ele envia o formulário
   - Então vê uma mensagem específica de "e-mail já em uso", sem criar uma conta duplicada

3. Cenário: Login bem-sucedido
   - Dado um usuário com conta de e-mail/senha já criada
   - Quando ele informa as credenciais corretas em `/login`
   - Então chega ao `/dashboard` autenticado

4. Cenário: Login com credenciais erradas
   - Dado um usuário informando e-mail ou senha incorretos
   - Quando ele tenta entrar
   - Então vê uma mensagem de erro genérica, permanece em `/login`

5. Cenário: Redefinição de senha
   - Dado um usuário que esqueceu a senha
   - Quando ele informa o e-mail e aciona "Esqueci minha senha"
   - Então vê uma mensagem de confirmação genérica, independente de o e-mail existir ou não

## Entidades Chave
Nenhuma nova — reaproveita a entidade `User`/`users/{uid}` já definida na spec 002.

## Assunções
- O sign-in method "E-mail/senha" já está habilitado no Firebase Console (confirmado pelo usuário antes desta spec) — nenhuma configuração adicional no Firebase é necessária, só código no app.
- Sem verificação de e-mail nesta versão — decisão confirmada com o usuário, para manter o escopo desta spec pequeno; acesso libera imediatamente após o cadastro, igual ao login Google.
- O cadastro por e-mail/senha não coleta nome de exibição — o usuário pode defini-lo depois em `/profile` (spec 012). `displayName` fica `null` inicialmente, mesmo padrão que `/api/auth/profile` já usa quando o token não tem `name` (`decoded.name ?? null`).
- Mensagens de erro do Firebase Auth (`auth/email-already-in-use`, `auth/weak-password`, `auth/invalid-credential`, `auth/too-many-requests`, etc.) são traduzidas para português numa lista pequena de casos conhecidos; qualquer código não mapeado cai numa mensagem genérica — mesmo padrão de tratamento de erro já usado em `loginWithGoogle`.

## Dependências
- Conclusão da spec 002 (`users/{uid}`, `POST /api/auth/profile`) e da spec 011 (checkbox "Manter conectado", `setPersistence`).
- Nenhuma dependência nova de biblioteca — `createUserWithEmailAndPassword`, `signInWithEmailAndPassword` e `sendPasswordResetEmail` já fazem parte do `firebase/auth` já instalado.

## Riscos e Mitigações
- Risco: mensagens de erro específicas demais (ex.: "e-mail não encontrado" vs "senha incorreta") permitiriam enumerar quais e-mails têm conta no sistema.
  - Mitigação: RF-6/RF-9 exigem mensagens genéricas para login e redefinição — o comportamento padrão mais recente do Firebase Authentication (`auth/invalid-credential` unificado) já ajuda nisso; o app não deve tentar ser mais específico do que o Firebase é por padrão.
- Risco: usuário cria conta por e-mail/senha usando o mesmo e-mail de uma conta Google já existente, sem saber que são contas (uids) diferentes, achando que é a mesma conta.
  - Mitigação: aceito como limitação conhecida nesta versão (ver Fora de Escopo — account linking); documentar como candidato a spec futura se gerar confusão real de usuários.

## Artefatos Criados
- `specs/013-auth-email-senha/spec.md`
- `.specify/feature.json` apontando para `specs/013-auth-email-senha`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md` com o schema exato, as funções de `auth.ts`, e a UI do `/login`.
- `tasks.md`.
- Implementar.

*Gerado em: 2026-08-01*
