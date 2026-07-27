# Correções: Criação de Perfil no Backend e Responsividade Visual

**Short name:** perfil-backend-responsividade

**Feature Branch**: `006-perfil-backend-responsividade`

**Created**: 2026-07-27

**Status**: Draft

## Resumo
Spec de correção, agrupando dois problemas encontrados no que já está em produção: (1) a criação do perfil do usuário no primeiro login (`src/lib/firebase/auth.ts`, spec 002) ainda escreve direto no Firestore pelo client, a mesma classe de violação do Princípio II da constitution já corrigida para `/settings` na spec 005; e (2) dois bugs visuais em telas pequenas — o cabeçalho (`AppHeader`) fica mal espaçado, e o botão de remover fonte de informação em `/settings` sai da margem do formulário.

## Contexto e Motivação
A spec 005 corrigiu a escrita crítica de `/settings`, mas deixou de fora, de propósito, a criação do perfil no login — registrado como um risco conhecido. Agora que o padrão (endpoint autenticado + Admin SDK) já está estabelecido e testado, faz sentido fechar essa última violação. Ao mesmo tempo, testes em telas pequenas expuseram dois problemas de layout introduzidos nas specs 004 (`AppHeader`) e 003/005 (linha de fontes em `/settings`): nenhum dos dois componentes tem tratamento responsivo, então em viewports estreitos (celular) o conteúdo estoura a largura da tela.

## Objetivos
- Mover a criação do documento `users/{uid}` no primeiro login para um endpoint backend autenticado, no mesmo padrão do `POST /api/settings` (spec 005).
- Corrigir o espaçamento do `AppHeader` em telas pequenas, sem overflow horizontal nem elementos cortados.
- Corrigir a linha de cada fonte de informação em `/settings` para que o botão de remover (lixeira) permaneça sempre visível dentro da margem, mesmo em telas estreitas.

## Escopo (In Scope)
- `src/app/api/auth/profile/route.ts` (novo): endpoint `POST` autenticado que cria `users/{uid}` se ainda não existir, usando `uid`/`email`/`displayName` extraídos do ID token verificado.
- `src/lib/firebase/auth.ts`: `loginWithGoogle()` continua abrindo o popup do Google no client (isso não pode mover para o servidor), mas deixa de fazer `getDoc`/`setDoc` diretamente — passa a chamar o novo endpoint depois do login bem-sucedido.
- `src/components/AppHeader.tsx`: ajustes de layout responsivo (espaçamento, quebra de linha) para telas pequenas.
- `src/app/settings/page.tsx`: ajuste na linha de cada fonte de informação para que o botão de remover não saia da margem em telas estreitas.

## Fora de Escopo
- Qualquer mudança no fluxo de OAuth em si (o popup do Google continua sendo iniciado pelo client — só a escrita no Firestore muda de lugar).
- Redesenho completo do `AppHeader` (menu hambúrguer, avatar, etc.) — apenas o conserto do espaçamento/overflow já existente, sem novos elementos.
- Auditoria completa de responsividade em todas as páginas — o escopo é especificamente o `AppHeader` e a linha de fontes em `/settings`, os dois pontos com bug relatado.
- Testes automatizados de layout/visual regression — validação manual, redimensionando a janela/usando as ferramentas de dispositivo móvel do navegador.

## Dados (Data Dictionary)
Sem mudança de forma — o documento `users/{uid}` criado pelo novo endpoint tem exatamente os mesmos campos já definidos na spec 002 (`uid`, `email`, `displayName`, `createdAt`, `config`, `schedule`). Muda apenas quem escreve.

## Requisitos Funcionais (Testáveis)

### US1 — Criação de Perfil no Backend
RF-1: A criação do documento `users/{uid}` no primeiro login MUST ser feita por um endpoint backend autenticado (`POST /api/auth/profile`), não mais por escrita direta do client Firestore SDK.
- Aceitação: Inspecionar a rede durante o primeiro login mostra uma chamada para `/api/auth/profile`; nenhuma chamada `setDoc`/`getDoc` do client SDK para `users/{uid}` ocorre a partir de `auth.ts`.

RF-2: O endpoint MUST derivar `uid`, `email` e `displayName` exclusivamente do ID token verificado (Firebase Admin), nunca de dados enviados no corpo da requisição.
- Aceitação: Uma requisição com um corpo contendo um `uid`/`email` diferente do token não tem efeito — o documento criado usa sempre os dados do token.

RF-3: O endpoint MUST ser idempotente — só cria o documento se ele ainda não existir, sem sobrescrever um perfil já existente (preservando `config`/`schedule` já configurados pelo usuário).
- Aceitação: Chamar o endpoint duas vezes para o mesmo usuário (login subsequente) não apaga nem reseta preferências já salvas.

RF-4: O fluxo de login (popup do Google via Firebase Auth client SDK) MUST continuar acontecendo no client — apenas a escrita do documento de perfil muda de lugar.
- Aceitação: O botão "Entrar com Google" continua funcionando exatamente como antes do ponto de vista do usuário.

### US2 — Cabeçalho Responsivo
RF-5: O `AppHeader` MUST permanecer legível e sem overflow horizontal em larguras de tela pequenas (a partir de 320-375px, faixa típica de celular).
- Aceitação: Redimensionar a janela (ou usar o modo de dispositivo móvel do navegador) para 375px de largura não produz barra de rolagem horizontal nem elementos cortados/sobrepostos no cabeçalho.

### US3 — Linha de Fontes sem Overflow
RF-6: O botão de remover fonte (ícone de lixeira) em `/settings` MUST permanecer inteiramente visível dentro da margem do formulário em telas pequenas.
- Aceitação: Em 375px de largura, todos os elementos de uma linha de fonte (seletor de tipo, campo de URL, botão de remover) ficam visíveis dentro do card, sem o botão de remover ser cortado ou empurrado para fora.

## Critérios de Sucesso
- SC-1: Nenhuma escrita client-side (`setDoc`/`getDoc` de escrita) para `users/{uid}` ocorre mais a partir do fluxo de login — só o endpoint autenticado escreve.
- SC-2: Usuários não conseguem, via requisição direta à API, criar/alterar o perfil de um `uid` que não é o seu.
- SC-3: O `AppHeader` e a linha de fontes em `/settings` não apresentam overflow horizontal em nenhuma largura entre 320px e o desktop.

## Cenários de Aceitação
1. Cenário: Primeiro login cria o perfil via backend
   - Dado um usuário que nunca fez login antes
   - Quando completar o login com Google
   - Então `users/{uid}` é criado pelo endpoint backend, com os valores padrão de `config`/`schedule`, e o client não fez nenhuma escrita direta no Firestore

2. Cenário: Login subsequente não sobrescreve o perfil
   - Dado um usuário que já tem preferências salvas em `users/{uid}`
   - Quando fizer login novamente
   - Então o endpoint é chamado mas o documento existente não é alterado

3. Cenário: Cabeçalho em tela pequena
   - Dado o `AppHeader` renderizado em uma página autenticada
   - Quando a largura da tela for reduzida para a faixa de um celular (≈375px)
   - Então todos os elementos do cabeçalho continuam visíveis e organizados, sem overflow horizontal

4. Cenário: Lixeira de fonte em tela pequena
   - Dado o formulário de `/settings` aberto com pelo menos uma fonte cadastrada
   - Quando a largura da tela for reduzida para a faixa de um celular (≈375px)
   - Então o botão de remover a fonte continua visível e clicável dentro da margem do card

## Entidades Chave
Nenhuma entidade nova — reaproveita `UserProfile` já definida na spec 002.

## Assunções
- O padrão de endpoint autenticado (verificar ID token via Admin SDK, derivar `uid` só do token) já estabelecido em `POST /api/settings` (spec 005) é reaproveitado aqui, não reinventado.
- `src/lib/firebase/admin.ts` (spec 005) já existe e é reaproveitado — nenhuma nova inicialização do Admin SDK é necessária.
- Os bugs visuais são de espaçamento/overflow, não de escolha de cor ou tema — não há sobreposição com os tokens MD3 da spec 004, só ajustes de layout (`flex-wrap`, `min-width`, gaps responsivos).

## Dependências
- Conclusão da spec 002 (fluxo de login, `auth.ts`) e spec 005 (`src/lib/firebase/admin.ts`, padrão de endpoint autenticado).
- Conclusão da spec 004 (`AppHeader`) e spec 003/005 (linha de fontes em `/settings`).

## Riscos e Mitigações
- Risco: Mudar `loginWithGoogle()` para depender de uma chamada de rede adicional pode introduzir uma falha nova entre "login no Firebase Auth bem-sucedido" e "perfil criado".
  - Mitigação: Se a chamada ao endpoint falhar, `loginWithGoogle()` MUST propagar um erro claro (reaproveitando o tratamento de erro já existente na UI de login), em vez de deixar o usuário autenticado sem perfil sem aviso.
- Risco: Corrigir o layout responsivo introduzir uma regressão visual no desktop.
  - Mitigação: Os ajustes usam breakpoints do Tailwind (`sm:`, etc.) para alterar apenas o comportamento em telas pequenas, preservando a aparência já validada em telas maiores (specs 003/004).

## Artefatos Criados
- `specs/006-perfil-backend-responsividade/spec.md`
- `.specify/feature.json` apontando para `specs/006-perfil-backend-responsividade`

## Próximos Passos
- Rodar `/speckit.plan` para gerar `plan.md`, detalhando o contrato do endpoint e os ajustes de Tailwind para os dois pontos de overflow.
- Gerar `tasks.md` com `/speckit.tasks`.
- Implementar `src/app/api/auth/profile/route.ts`, atualizar `auth.ts`, `AppHeader.tsx` e `settings/page.tsx`.

*Gerado em: 2026-07-27*
