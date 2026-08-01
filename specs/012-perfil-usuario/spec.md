# Página de Perfil do Usuário

**Short name:** perfil-usuario

**Feature Branch**: `012-perfil-usuario`

**Created**: 2026-08-01

**Status**: Draft

## Resumo
Nova página `/profile`, separada de `/settings` (que hoje é só sobre preferências de geração do digest): exibe nome, e-mail e foto vindos do login Google, permite editar o nome de exibição, cadastrar links de redes sociais pessoais (Twitter/X, Instagram, LinkedIn), e oferece a opção de excluir a conta e todos os dados associados.

## Contexto e Motivação
Hoje não existe nenhum lugar no app para o usuário ver ou gerenciar seus próprios dados de identidade — `/settings` é inteiramente sobre o conteúdo do digest (tópicos, fontes, horário). `AppHeader` e `/dashboard` mostram o nome vindo do Google como texto estático, sem nenhuma forma de personalização nem controle do usuário sobre sua própria conta, incluindo não ter como excluí-la.

## Objetivos
- O usuário MUST conseguir ver seu nome, e-mail e foto (vindos do Google) numa página dedicada.
- O usuário MUST conseguir editar seu nome de exibição, refletido em toda a interface (cabeçalho, saudação do dashboard).
- O usuário MUST conseguir cadastrar links das próprias redes sociais (Twitter/X, Instagram, LinkedIn), como informação de perfil — sem conectar nenhuma conta de verdade, só campos de texto.
- O usuário MUST conseguir excluir permanentemente sua conta e todos os dados associados (perfil, preferências, histórico de digests), com uma confirmação reforçada antes da exclusão de fato acontecer.

## Escopo (In Scope)
- Nova página `src/app/profile/page.tsx`, protegida como `/settings`/`/dashboard`/`/history` (`ProtectedRoute` + `AppHeader`).
- Exibição de `user.photoURL`, `user.displayName`, `user.email` (do objeto `User` do Firebase Auth, client-side — mesma fonte já usada hoje em `AppHeader`/`dashboard`).
- Edição do nome de exibição via `updateProfile` do Firebase Auth (client SDK) — atualiza o próprio usuário autenticado, refletindo automaticamente em qualquer lugar que já lê `user.displayName` (`AppHeader`, saudação do `/dashboard`), sem exigir mudança nesses arquivos.
- Novo endpoint autenticado `POST /api/profile`, seguindo o mesmo padrão de `/api/settings`/`/api/auth/profile` (ADR 0002): recebe `displayName` e `socialLinks`, grava em `users/{uid}` via Admin SDK. Mantém o `displayName` do Firestore sincronizado com o do Firebase Auth, para uso futuro server-side (ex.: personalização do conteúdo do digest).
- Três campos de URL opcionais para redes sociais (Twitter/X, Instagram, LinkedIn), persistidos em `users/{uid}.profile.socialLinks`.
- Novo endpoint autenticado `DELETE /api/profile`: apaga a subcoleção `users/{uid}/digests`, o documento `users/{uid}`, e a conta no Firebase Authentication (`getAdminAuth().deleteUser`), nessa ordem.
- Fluxo de exclusão de conta na UI: diálogo de confirmação exigindo digitar uma palavra específica antes de habilitar o botão de exclusão definitiva.
- `AppHeader`: novo link "Perfil" na navegação, junto com Dashboard/Configurações/Histórico.

## Fora de Escopo
- Upload de foto própria (substituir a foto do Google) — a foto exibida continua sendo somente a do Google, sem edição.
- Editar e-mail — gerenciado inteiramente pelo provedor de login (Google), não pelo app.
- Conectar de verdade outras contas/provedores de login (ex.: login também via Twitter) — os campos de redes sociais são só informação de perfil, sem nenhuma integração OAuth adicional.
- Validar se os links de redes sociais realmente existem/pertencem ao usuário (ex.: verificar a conta) — são campos de texto livre validados só como URL bem formada.
- Recuperação de conta após exclusão — a exclusão é permanente; não há período de carência nem backup restaurável pelo próprio usuário.
- Qualquer mudança em `/settings` (preferências do digest) — esta spec é inteiramente sobre identidade/conta do usuário, uma página nova e separada.

## Dados (Data Dictionary)
Campo novo em `users/{uid}` (estende a entidade já definida na spec 002):
- `profile.socialLinks: { twitter?: string | null, instagram?: string | null, linkedin?: string | null }` — URLs opcionais cadastradas pelo usuário.

Campo já existente reaproveitado:
- `displayName` — já gravado uma vez na criação do perfil (spec 002, a partir do nome do Google); esta spec passa a permitir que o usuário o sobrescreva.

Nenhum campo é removido; a exclusão de conta remove o documento inteiro (ver RF-9/RF-10).

## Requisitos Funcionais (Testáveis)

### US1 — Ver e Editar Informações Básicas (Priority: P1)
RF-1: A página `/profile` MUST exibir a foto (quando disponível), o nome e o e-mail atuais do usuário autenticado.
- Aceitação: Ao abrir `/profile`, os três dados aparecem corretamente, refletindo a conta Google usada no login.

RF-2: O usuário MUST conseguir editar e salvar um novo nome de exibição.
- Aceitação: Após salvar um novo nome, ele aparece atualizado em `/profile`, no cabeçalho (`AppHeader`, se exibido lá) e na saudação do `/dashboard`, sem precisar de logout/login.

RF-3: O e-mail exibido MUST ser somente leitura — não editável nesta página.
- Aceitação: Não há campo de edição para o e-mail; o valor mostrado nunca muda por ação do usuário dentro do app.

### US2 — Cadastrar Redes Sociais (Priority: P2)
RF-4: A página `/profile` MUST oferecer três campos opcionais de URL: Twitter/X, Instagram e LinkedIn.
- Aceitação: Os três campos aparecem vazios para um usuário que nunca os preencheu, e com o valor salvo para quem já preencheu antes.

RF-5: Um campo de rede social preenchido MUST ser validado como uma URL bem formada antes de salvar; um campo vazio MUST ser aceito (opcional).
- Aceitação: Tentar salvar um valor que não é uma URL válida mostra um erro de validação e não salva; deixar os três campos vazios salva normalmente.

RF-6: Os links salvos MUST persistir entre sessões, associados ao usuário autenticado.
- Aceitação: Recarregar `/profile` (ou logar de novo) mostra os mesmos links salvos anteriormente.

### US3 — Excluir Conta (Priority: P3)
RF-7: A página `/profile` MUST oferecer uma ação de exclusão de conta, visualmente distinta do restante da página (ex.: seção "zona de risco").
- Aceitação: A opção de excluir conta é encontrável em `/profile`, mas não pode ser acionada pelo mesmo clique usado para salvar o perfil.

RF-8: Antes de excluir de fato, o usuário MUST confirmar a ação digitando uma palavra específica de confirmação — o botão de exclusão definitiva MUST permanecer desabilitado até esse texto ser digitado corretamente.
- Aceitação: O botão de exclusão definitiva está desabilitado até o texto de confirmação ser digitado corretamente; digitar algo incorreto mantém o botão desabilitado.

RF-9: Ao confirmar a exclusão, o sistema MUST apagar o documento `users/{uid}`, toda a subcoleção `users/{uid}/digests`, e a conta correspondente no Firebase Authentication.
- Aceitação: Depois de excluir, nenhum documento do usuário permanece no Firestore, e uma tentativa de login com a mesma conta Google cria um perfil novo (do zero), não recupera o antigo.

RF-10: Após a exclusão bem-sucedida, o usuário MUST ser desconectado e redirecionado para a página inicial pública.
- Aceitação: Depois de confirmar a exclusão, o usuário não continua vendo nenhuma página autenticada; acessar `/dashboard` depois exige login de novo, criando uma conta nova.

## Critérios de Sucesso
- SC-1: Um usuário consegue ver e atualizar seu nome de exibição em menos de 1 minuto, sem sair da página `/profile`.
- SC-2: Nenhum link de rede social malformado chega a ser salvo.
- SC-3: Excluir uma conta remove 100% dos dados associados a ela (perfil, preferências, histórico de digests) — nada órfão permanece no Firestore.
- SC-4: A exclusão de conta nunca acontece por um único clique acidental — sempre exige a confirmação digitada.

## Cenários de Aceitação
1. Cenário: Editar nome de exibição
   - Dado um usuário autenticado em `/profile`
   - Quando ele muda o nome de exibição e salva
   - Então o novo nome aparece imediatamente refletido no `/dashboard`

2. Cenário: Cadastrar rede social válida
   - Dado um usuário em `/profile` sem nenhum link cadastrado
   - Quando ele preenche a URL do Twitter/X e salva
   - Então o link aparece salvo ao recarregar a página

3. Cenário: Rede social inválida
   - Dado um usuário preenchendo o campo do Instagram com um texto que não é uma URL
   - Quando ele tenta salvar
   - Então um erro de validação aparece e nada é salvo

4. Cenário: Exclusão de conta
   - Dado um usuário na seção de exclusão de conta em `/profile`
   - Quando ele digita a palavra de confirmação corretamente e confirma
   - Então sua conta, perfil, preferências e histórico de digests são apagados, e ele é desconectado e levado à página inicial

5. Cenário: Tentativa de exclusão sem confirmar
   - Dado um usuário na seção de exclusão de conta
   - Quando ele não digita a palavra de confirmação (ou digita errado)
   - Então o botão de exclusão definitiva permanece desabilitado e nada é apagado

## Entidades Chave
- `User.profile.socialLinks` — novo campo em `users/{uid}` (ver Data Dictionary).
- `User.displayName` — campo já existente (spec 002), passa a ser editável pelo próprio usuário.

## Assunções
- Edição do nome de exibição usa `updateProfile` do Firebase Auth (mecanismo nativo do próprio serviço de autenticação) em vez de introduzir um campo Firestore como única fonte da verdade — isso faz o nome atualizado refletir automaticamente em `AppHeader`/`dashboard` (que já leem `user.displayName` do Firebase Auth) sem precisar alterar esses arquivos. O Firestore `displayName` é mantido em sincronia via `POST /api/profile`, mas não é a fonte primária de exibição.
- Redes sociais são três campos fixos (Twitter/X, Instagram, LinkedIn) — decisão confirmada com o usuário antes de escrever esta spec, em vez de uma lista dinâmica como em "Fontes de Informação" do `/settings`.
- A exclusão de conta exige confirmação digitada (não só um diálogo simples de confirmar/cancelar) — decisão confirmada com o usuário antes de escrever esta spec, dado o caráter irreversível da ação.
- As regras de segurança do Firestore (`firestore.rules`, endurecidas na sessão de 2026-07-30) já negam toda escrita direta do client em `users/{uid}` — os dois novos endpoints (`POST`/`DELETE /api/profile`) seguem obrigatoriamente o mesmo padrão de escrita server-side via Admin SDK (ADR 0002), não há alternativa de escrita direta do client possível mesmo que se quisesse.

## Dependências
- Conclusão da spec 002 (criação de perfil, campo `displayName` original) e do padrão de endpoints autenticados (ADR 0002).
- Nenhuma dependência nova de biblioteca.

## Riscos e Mitigações
- Risco: excluir a conta no Firebase Authentication antes de terminar de apagar os dados do Firestore deixaria dados órfãos sem dono recuperável (o `uid` não pode mais ser verificado por token depois que a conta é apagada).
  - Mitigação: ordem de exclusão explícita no endpoint — subcoleção de digests, depois o documento do usuário, e só por último a conta no Firebase Authentication (RF-9); se qualquer etapa falhar antes da exclusão da conta, a operação MUST parar e retornar erro, sem prosseguir para a próxima etapa.
- Risco: exclusão de conta acionada por engano (clique acidental, script, etc.).
  - Mitigação: RF-8 exige confirmação digitada, não só um clique — mitigação de UX, não técnica, mas suficiente para o escopo deste projeto.
- Risco: `updateProfile` do Firebase Auth e a gravação em Firestore (`POST /api/profile`) ficarem fora de sincronia se uma das duas chamadas falhar e a outra não.
  - Mitigação: aceito como limitação conhecida nesta primeira versão — o `displayName` do Firestore hoje não é lido por nenhuma UI (só o do Firebase Auth é), então uma dessincronia temporária não é visível ao usuário; revisitar se um uso futuro server-side do nome for adicionado.

## Artefatos Criados
- `specs/012-perfil-usuario/spec.md`
- `.specify/feature.json` apontando para `specs/012-perfil-usuario`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md` com o schema exato (Zod), os dois endpoints, e o componente de confirmação de exclusão.
- `tasks.md`.
- Implementar.

*Gerado em: 2026-08-01*
