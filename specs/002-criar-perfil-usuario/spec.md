# Autenticação e Criação de Perfil de Usuário

**Short name:** criar-perfil-usuario

## Resumo
Implementar o fluxo de autenticação com Google e a criação automática do documento de perfil do usuário no Firestore conforme o dicionário de dados definido. Garantir proteção de credenciais, responsabilidades server-side, e um contexto de autenticação reutilizável no client-side (React Context) para minimizar leituras redundantes.

## Contexto e Motivação
Para que o AI Digest Aggregator personalize digests e rotinas de entrega, precisamos de um modelo de usuário persistente e confiável. Este recurso assegura que, ao autenticar com provedores externos (ex.: Google), um documento de perfil seja criado automaticamente contendo preferências, agenda e configurações necessárias para os jobs agendados.

## Objetivos
- Implementar login com Google e logout via Firebase Auth.
- Criar/atualizar o documento do usuário em `users/{uid}` com os campos do dicionário de dados (uid, email, displayName, createdAt, config, schedule).
- Expor um `AuthContext` que fornece `user` e `loading` para os componentes client-side.
- Fornecer um componente `ProtectedRoute` para proteger páginas privadas.
- Adicionar uma página de login simples para acionar o fluxo de autenticação.

## Escopo (In Scope)
- `src/lib/firebase/auth.ts` (serviço de autenticação com lógica de criação de documento)
- `src/contexts/AuthContext.tsx` (context provider client-side)
- `src/components/ProtectedRoute.tsx` (wrapper de proteção de rota)
- `src/app/login/page.tsx` (UI mínima de login)
- Testes manuais de aceitação local (login, criação de documento, redirecionamento)

## Fora de Escopo
- Políticas de autorização avançadas (roles/permissions sofisticadas)
- Integrações de back-end (Firebase Admin) para conversão segura de fuso horário — a inicialização do campo `targetHourUTC` pode ser refinada posteriormente no backend.

## Dados (Data Dictionary)
Coleção: `users`
- `uid` (String): Chave primária, ID do Firebase Auth. Not Null.
- `email` (String): Not Null, formato e-mail.
- `displayName` (String): Nullable, max 100 caracteres.
- `createdAt` (Timestamp): Not Null, imutável (serverTimestamp quando criado).
- `config` (Map): Not Null, contém:
  - `topics` (Array<String>, max 10)
  - `sources` (Array<Map>, max 20) — cada item tem `type` e `url`/`handle`
  - `gptModel` (String, default "gpt-4o-mini")
  - `promptCustomization` (String, Nullable, max 500)
- `schedule` (Map): Not Null, contém:
  - `localTime` (String, HH:MM 24h)
  - `timezone` (String, IANA)
  - `targetHourUTC` (Number, 0-23)

Subcoleção: `users/{uid}/digests` — histórico de digests (schema documentado separadamente).

## Requisitos Funcionais (Testáveis)
RF-1: Ao executar o fluxo de login com Google, um documento em `users/{uid}` é criado se não existir.
- Aceitação: Após login, `getDoc(doc(db,'users', uid))` retorna `exists() === true` e contém `uid`, `email`, `createdAt`, `config`, `schedule`.

RF-2: O `AuthContext` expõe `user` (Firebase `User` ou null) e `loading` (boolean) e atualiza em tempo real via `onAuthStateChanged`.
- Aceitação: Componentes consumidores recebem `user` corretamente após autenticado, e `loading` se torna `false`.

RF-3: `ProtectedRoute` redireciona para `/login` se `user` for null e `loading` for false.
- Aceitação: Acessar rota protegida sem autenticação resulta em redirecionamento.

RF-4: A página de login chama a função de login e redireciona para `/dashboard` após sucesso.
- Aceitação: Clique no botão de login executa o fluxo e o cliente é redirecionado.

RF-5: O documento criado usa `serverTimestamp()` para `createdAt` e inicializa `config` e `schedule` com valores padrão conforme o dicionário.
- Aceitação: `createdAt` é um timestamp do servidor; `config.gptModel === 'gpt-4o-mini'` e `schedule.localTime` tem valor padrão (ex: '07:00').

## Critérios de Sucesso
- CS-1: 100% dos novos usuários autenticados têm um documento em Firestore criado automaticamente no primeiro login.
- CS-2: Páginas privadas só são acessíveis por usuários autenticados (teste manual em dev passará).
- CS-3: Contexto de autenticação reduz chamadas redundantes ao Firestore durante a sessão ativa (verificação qualitativa via inspeção de rede).

## Cenários de Aceitação
1. Cenário: Primeiro login
   - Dado usuário sem documento em `users/{uid}`
   - Quando executar login com Google
   - Então o documento é criado com os campos mínimos e o usuário é redirecionado para `/dashboard`

2. Cenário: Login subsequente
   - Dado usuário já existente em Firestore
   - Quando realizar login
   - Então o documento não é sobrescrito inadvertidamente (mantém histórico e não reescreve campos imutáveis)

3. Cenário: Acesso a rota privada
   - Dado usuário não autenticado
   - Quando acessar `/dashboard`
   - Então é redirecionado para `/login`

## Entidades Chave
- `UserProfile` — representa o documento `users/{uid}` com `uid`, `email`, `displayName`, `createdAt`, `config`, `schedule`.

## Assunções
- O projeto já contém `src/lib/firebase/config.ts` que exporta `auth` e `db` (se não, criar conforme especificado em Spec #1).
- O ambiente possui variáveis sensíveis configuradas e `.env.local` não será commitado.
- O cálculo preciso de `targetHourUTC` será eventualmente tratado em API protegida; aqui inicializamos com um valor conservador.

## Dependências
- Firebase Client SDK já instalado (`firebase`).
- Permissões de escrita em Firestore via regras apropriadas durante desenvolvimento.

## Riscos e Mitigações
- Risco: Criação de documentos com dados incompletos ou campos faltantes.
  - Mitigação: Validação básica antes do `setDoc`; use `serverTimestamp()` para `createdAt`.
- Risco: Exposição de chaves no client.
  - Mitigação: Reforçar que apenas variáveis `NEXT_PUBLIC_` são expostas; instruções em README.

## Artefatos Criados
- `specs/002-criar-perfil-usuario/spec.md`
- `specs/002-criar-perfil-usuario/checklists/requirements.md`
- `.specify/feature.json` apontando para `specs/002-criar-perfil-usuario`

## Próximos Passos
- Implementar os arquivos listados no Escopo (auth.ts, AuthContext, ProtectedRoute, login page)
- Escrever testes unitários simples para `loginWithGoogle` mockando Firebase
- Criar tarefas para revisar regras de segurança do Firestore

*Gerado em: 2026-07-24*
