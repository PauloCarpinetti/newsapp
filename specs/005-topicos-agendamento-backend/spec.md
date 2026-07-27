# Épico 2 (Motor da IA) — Tags de Tópicos e Agendamento com Cálculo Backend

**Short name:** topicos-agendamento-backend

**Feature Branch**: `005-topicos-agendamento-backend`

**Created**: 2026-07-27

**Status**: Draft

## Resumo
Primeiras duas histórias do Épico 2 (Motor da Inteligência Artificial): US03 (definição de tópicos e tom do resumo) e US04 (agendamento do resumo diário). Boa parte do terreno já foi coberta pela spec 003: o campo de tópicos, a personalização de prompt (max 500 caracteres) e o seletor de horário `HH:MM` já existem em `/settings`. O que este spec adiciona de fato é (1) transformar o campo de tópicos em tags individuais de verdade, com o limite de 10 já definido no dicionário de dados mas nunca validado, e (2) mover o cálculo de `schedule.targetHourUTC` — hoje feito só no client — para um endpoint autenticado no servidor, corrigindo de paso uma violação do Princípio II da constitution (escritas críticas não devem acontecer em client components).

## Contexto e Motivação
A spec 003 entregou o formulário de preferências completo, mas com duas limitações que este épico torna explícitas:
1. `topics` é hoje um único campo de texto separado por vírgula, não uma coleção de tags individualmente adicionáveis/removíveis como o US03 pede, e o limite de 10 tópicos do dicionário de dados (spec 002) nunca foi validado por código.
2. `schedule.targetHourUTC` é calculado inteiramente no browser (`calculateTargetHourUTC` em `src/lib/utils/time.ts`) e gravado no Firestore por uma escrita direta do client (`updateDoc`). Isso já era uma aproximação assumida como limitação nas specs 002/003, mas também é uma violação do Princípio II da constitution ("Operações críticas de escrita... MUST ser executadas no servidor, nunca em client components"), que passou despercebida até agora. Como o valor de `targetHourUTC` vai ser consumido por um futuro Cron Job (fora de escopo aqui), é importante que ele seja calculado e gravado de forma confiável no servidor, não confiado inteiramente ao client.

## Objetivos
- Permitir que o usuário adicione/remova tópicos de interesse individualmente como tags, respeitando o limite de 10.
- Mover o salvamento de preferências (incluindo o cálculo de `schedule.targetHourUTC`) para um endpoint backend autenticado, em vez de uma escrita direta do client no Firestore.
- Reaproveitar a lógica de conversão de horário já validada (`calculateTargetHourUTC`, spec 003) no novo endpoint, em vez de duplicá-la.

## Escopo (In Scope)
- `src/lib/schemas/settingsSchema.ts`: `topics` passa de `string` (texto livre) para `string[]` (array de tags), com `min(1)` e `max(10)`.
- `src/app/settings/page.tsx`: UI de tags para tópicos (adicionar por Enter/botão, remover individualmente), seguindo o mesmo padrão já usado para `sources` (`useFieldArray`); o envio do formulário passa a chamar o novo endpoint em vez de `updateDoc` direto.
- `src/lib/firebase/admin.ts` (novo): inicialização do Firebase Admin SDK (server-only), usando `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`/`NEXT_PUBLIC_FIREBASE_PROJECT_ID` já previstos em `.env.local.example` desde a spec 001.
- `src/app/api/settings/route.ts` (novo): endpoint `POST` autenticado que recebe as preferências do formulário, valida o ID token do Firebase Auth, calcula `schedule.targetHourUTC` (reaproveitando `calculateTargetHourUTC`) e persiste tudo em `users/{uid}` via Admin SDK.

## Fora de Escopo
- Geração do resumo em si via GPT (outras histórias do Épico 2, não cobertas aqui).
- O Cron Job que vai efetivamente disparar a geração do digest usando `targetHourUTC` — esta spec só garante que o valor fica correto e confiável no Firestore.
- Precisão total de horário de verão (DST) além do que `calculateTargetHourUTC` já resolve — a função usa a data de hoje como referência; isso é reaproveitado, não expandido.
- Mover a criação do perfil de usuário no primeiro login (spec 002, `src/lib/firebase/auth.ts`) para o backend — é a mesma classe de violação do Princípio II, mas está fora do escopo desta spec.
- Editor de tags com autocomplete, sugestões ou categorização de tópicos — apenas adicionar/remover texto livre como tag.

## Dados (Data Dictionary)
Sem novos campos no Firestore. Muda apenas o tipo/validação de um campo já existente em `users/{uid}` (spec 002):
- `config.topics` (Array<String>, min 1, max 10) — já era a regra definida no dicionário de dados da spec 002; passa a ser validada de fato (antes era um texto único convertido em array só no submit, sem limite máximo).

Os demais campos (`config.sources`, `config.promptCustomization`, `schedule.localTime`, `schedule.timezone`, `schedule.targetHourUTC`) mantêm exatamente a mesma forma definida nas specs 002/003 — só muda **onde** `targetHourUTC` é calculado e **quem** escreve o documento.

## Requisitos Funcionais (Testáveis)

### US03 — Tags de Tópicos
RF-1: O formulário de preferências MUST permitir adicionar tópicos individualmente como tags (não mais um único campo de texto separado por vírgula), cada uma removível independentemente.
- Aceitação: Digitar um tópico e confirmar (Enter ou botão "Adicionar") cria uma tag visível com um controle de remoção; clicar em remover apaga só aquela tag.

RF-2: `config.topics` MUST ser validado com no mínimo 1 e no máximo 10 tags.
- Aceitação: Tentar salvar sem nenhum tópico é bloqueado; tentar adicionar uma 11ª tag é bloqueado ou impedido pela UI.

RF-3: `config.promptCustomization` continua limitado a 500 caracteres pelo campo de texto livre já existente (sem mudança de comportamento).
- Aceitação: Comportamento idêntico ao já validado na spec 003.

### US04 — Agendamento com Cálculo no Backend
RF-4: O salvamento das preferências MUST ser feito por um endpoint autenticado no servidor (`POST /api/settings`), não mais por escrita direta do client no Firestore.
- Aceitação: Inspecionar a rede ao salvar mostra uma chamada para `/api/settings`; nenhuma chamada `updateDoc`/`setDoc` do client SDK ocorre para este documento.

RF-5: O endpoint MUST validar o ID token do Firebase Auth do usuário antes de processar a requisição, e MUST rejeitar tentativas de alterar o documento de outro `uid`.
- Aceitação: Uma requisição sem token válido (ou com token de outro usuário tentando alterar um `uid` que não é o seu) retorna erro de autenticação/autorização e não altera o Firestore.

RF-6: O endpoint MUST calcular `schedule.targetHourUTC` a partir de `schedule.localTime` e `schedule.timezone` recebidos, reaproveitando a lógica já validada em `calculateTargetHourUTC` (`src/lib/utils/time.ts`, spec 003), executada no servidor.
- Aceitação: Para os mesmos pares de horário/fuso já cobertos pelos testes unitários de `calculateTargetHourUTC`, o valor persistido em `schedule.targetHourUTC` é idêntico ao calculado pela função.

RF-7: O componente de seleção de horário (`<input type="time">`) já existente MUST ser mantido sem mudanças de UI — apenas o destino do envio muda.
- Aceitação: A UI de horário continua idêntica à da spec 003.

RF-8: Em caso de falha de autenticação, validação ou escrita no endpoint, o client MUST exibir uma mensagem de erro (reaproveitando o mecanismo de feedback já existente em `/settings`), sem deixar o formulário em estado inconsistente.
- Aceitação: Forçar uma falha (ex.: token expirado) resulta na mensagem de erro já usada em `/settings`, e os dados exibidos no formulário não mudam para um estado incorreto.

## Critérios de Sucesso
- SC-1: 100% das gravações de `schedule.targetHourUTC` passam a ser feitas pelo endpoint backend, com o mesmo valor que a função de conversão já testada produziria.
- SC-2: Nenhuma escrita client-side (`updateDoc`/`setDoc`) para `users/{uid}` ocorre mais a partir de `/settings` — toda a operação passa pelo endpoint autenticado.
- SC-3: Usuários não conseguem, via requisição direta à API, alterar preferências de um `uid` que não é o seu.
- SC-4: A lista de tópicos nunca ultrapassa 10 itens nem fica vazia após um salvamento bem-sucedido.

## Cenários de Aceitação
1. Cenário: Adicionar e remover tags de tópicos
   - Dado o formulário de preferências aberto
   - Quando o usuário digitar um tópico e confirmar, e depois remover uma tag existente
   - Então a lista de tags reflete exatamente as adições/remoções feitas

2. Cenário: Limite de 10 tópicos
   - Dado o usuário já com 10 tags adicionadas
   - Quando tentar adicionar uma 11ª
   - Então a ação é bloqueada e uma mensagem explica o limite

3. Cenário: Salvamento via backend
   - Dado o usuário autenticado com o formulário preenchido corretamente
   - Quando clicar em salvar
   - Então o client chama `POST /api/settings` com o ID token, o servidor calcula `targetHourUTC` e persiste tudo em `users/{uid}`, e o client recebe confirmação de sucesso

4. Cenário: Requisição não autorizada
   - Dado um token inválido, ausente ou de outro usuário
   - Quando uma requisição for feita a `POST /api/settings` tentando alterar um `uid` diferente do token
   - Então o endpoint responde com erro e nada é alterado no Firestore

## Entidades Chave
- `UserProfile.config.topics` — passa de string livre para array de tags, com os mesmos limites já documentados no dicionário de dados (min 1, max 10).
- `UserProfile.schedule` — sem mudança de forma; muda apenas a responsabilidade de cálculo/escrita de `targetHourUTC`, que passa do client para o backend.

## Assunções
- O endpoint backend é implementado como um Next.js Route Handler (`src/app/api/settings/route.ts`) usando o Firebase Admin SDK, consistente com a stack já escolhida — não uma Cloud Function separada.
- As credenciais do Admin SDK (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) já estavam previstas em `.env.local.example` desde a spec 001, mas nunca foram usadas até agora; esta spec é a primeira a de fato inicializar o Admin SDK.
- O client obtém o ID token via `user.getIdToken()` (Firebase Auth client SDK, já disponível pelo `AuthContext`) e o envia no header `Authorization` da requisição.
- As regras de segurança do Firestore para `users/{uid}` (configuradas manualmente durante a spec 002) continuam válidas; o Admin SDK, ao rodar no servidor com credenciais privilegiadas, não é afetado por elas da mesma forma que o client SDK.

## Dependências
- Conclusão das specs 002 (autenticação, `AuthContext`) e 003 (`/settings`, `settingsSchema.ts`, `calculateTargetHourUTC`).
- Variáveis de ambiente `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` configuradas em `.env.local` (já existem como placeholders desde a spec 001; precisam de valores reais para o endpoint funcionar em desenvolvimento).

## Riscos e Mitigações
- Risco: Credenciais do Admin SDK ausentes ou mal formatadas em `.env.local`, quebrando o endpoint silenciosamente.
  - Mitigação: Endpoint retorna erro explícito (não genérico) quando a inicialização do Admin SDK falha, sem vazar a credencial no log.
- Risco: Divergência entre a lógica de conversão usada no client (se algum resquício permanecer) e a usada no servidor.
  - Mitigação: O servidor reaproveita a mesma função `calculateTargetHourUTC` já testada, em vez de reimplementá-la — nenhuma lógica de conversão nova é escrita.
- Risco: Usuário autenticado tentar, via chamada direta à API, alterar o documento de outro `uid`.
  - Mitigação: O endpoint MUST extrair o `uid` do token verificado no servidor (nunca confiar em um `uid` enviado no corpo da requisição) — RF-5.

## Artefatos Criados
- `specs/005-topicos-agendamento-backend/spec.md`
- `.specify/feature.json` apontando para `specs/005-topicos-agendamento-backend`

## Próximos Passos
- Rodar `/speckit.plan` para gerar `plan.md`, detalhando o contrato do endpoint (payload, respostas de erro) e a inicialização do Admin SDK.
- Gerar `tasks.md` com `/speckit.tasks`.
- Implementar `settingsSchema.ts` (topics como array), a UI de tags em `settings/page.tsx`, `src/lib/firebase/admin.ts` e `src/app/api/settings/route.ts`.

*Gerado em: 2026-07-27*
