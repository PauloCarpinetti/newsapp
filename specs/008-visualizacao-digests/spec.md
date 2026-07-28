# Épico 2 (Motor da IA) — Visualização dos Digests Gerados

**Short name:** visualizacao-digests

**Feature Branch**: `008-visualizacao-digests`

**Created**: 2026-07-28

**Status**: Draft

## Resumo
Fechar o ciclo do produto: a spec 007 já gera digests reais e os persiste em `users/{uid}/digests`, mas nenhuma tela exibe esse conteúdo — hoje `/dashboard` só mostra uma mensagem de boas-vindas. Esta spec entrega a interface de leitura: o dashboard passa a mostrar o digest mais recente do usuário, uma nova página `/history` lista os digests anteriores com paginação, e os três estados possíveis de um digest (`processing`, `completed`, `failed`) recebem tratamento visual apropriado, incluindo skeleton loading enquanto o Cron Job ainda está processando.

## Contexto e Motivação
Sem esta spec, o pipeline de geração (spec 007) roda "no escuro" — os digests existem no Firestore, mas o usuário não tem como lê-los. É a peça final que faz o produto entregar valor de ponta a ponta: login → preferências → geração automática → leitura.

## Objetivos
- Exibir o digest mais recente do usuário na dashboard, com o texto gerado pela IA formatado (negrito, quebras de linha), não como markdown bruto.
- Refletir automaticamente na UI quando um digest passa de `processing` para `completed`/`failed`, sem exigir recarregar a página.
- Fornecer uma página `/history` com os digests anteriores, carregados em páginas (não a coleção inteira de uma vez).
- Tratar corretamente os casos em que não há conteúdo para mostrar ainda (conta nova) ou o processamento falhou.

## Escopo (In Scope)
- `src/app/dashboard/page.tsx`: reescrita para buscar e exibir o digest mais recente do usuário, com os estados `processing`/`completed`/`failed`/vazio.
- `src/app/history/page.tsx` (novo): listagem paginada dos digests anteriores, ordenados por data decrescente.
- Um componente compartilhado de exibição de digest (usado no dashboard e no histórico), renderizando `content.intro` e `content.sections[].summary` via um renderizador de markdown.
- Um componente de skeleton loading para o estado `processing`.
- `src/components/AppHeader.tsx`: adicionar o link "Histórico" à navegação.
- Nova dependência: uma biblioteca de renderização de markdown (ex.: `react-markdown`).

## Fora de Escopo
- Marcar digests como lidos/não lidos (`isRead`) — o campo já existe no dicionário de dados (spec 002), mas nenhuma UI o utiliza ainda; fica para uma spec futura decidir a interação (marcar ao abrir, botão explícito, etc.).
- Ações sobre o digest (favoritar, compartilhar, excluir, reenviar).
- Qualquer mudança na geração do conteúdo do digest — isso é a spec 007; esta spec é somente leitura.
- Suporte a elementos de markdown além do que a IA tipicamente gera em texto corrido (negrito, itálico, quebras de linha, listas simples) — sem necessidade de tabelas, imagens embutidas ou HTML bruto.
- Notificação/aviso ativo ao usuário quando um novo digest fica pronto (e-mail, push) — fora do escopo desde a spec 007.

## Dados (Data Dictionary)
Nenhum campo novo — esta spec só lê o que a spec 007 já define em `users/{uid}/digests/{digestId}`:
- `status`, `createdAt`, `isRead`, `content.intro`, `content.sections[].title`, `content.sections[].summary`, `tokensUsed`, `errorMessage` (ver spec 007 para a definição completa).

## Requisitos Funcionais (Testáveis)

### US1 — Dashboard com o Digest Mais Recente
RF-1: A página `/dashboard` MUST buscar e exibir o digest mais recente do usuário autenticado (`users/{uid}/digests`, ordenado por `createdAt` decrescente, limite 1).
- Aceitação: Após login, `/dashboard` mostra o conteúdo do digest mais recentemente criado para aquele usuário, não um digest de outro usuário nem um digest antigo se houver um mais novo.

RF-2: Enquanto o digest mais recente estiver com `status: 'processing'`, a página MUST exibir um skeleton loading em vez de conteúdo vazio, quebrado ou um texto genérico de "carregando".
- Aceitação: Um digest em `processing` produz um layout de skeleton visualmente coerente com o card de digest final (mesma estrutura, sem conteúdo real).

RF-3: Quando o digest mais recente tiver `status: 'completed'`, a página MUST renderizar `content.intro` e cada `content.sections[].summary` (com o respectivo `content.sections[].title`) através de um renderizador de markdown, preservando negrito e quebras de linha gerados pela IA.
- Aceitação: Um texto gerado pela IA contendo `**palavra**` e quebras de linha aparece na tela como negrito real e parágrafos separados, sem asteriscos visíveis.

RF-4: Quando o digest mais recente tiver `status: 'failed'`, a página MUST exibir uma mensagem amigável indicando que a geração falhou, sem quebrar a página nem expor detalhes técnicos internos ao usuário final.
- Aceitação: Um digest `failed` produz uma mensagem clara de erro na UI, não uma tela em branco nem um erro de renderização no console.

RF-5: Quando o usuário ainda não tiver nenhum digest (conta nova, primeiro Cron Job ainda não rodou), a página MUST exibir um estado vazio explicativo (não um erro nem um skeleton infinito).
- Aceitação: Um usuário sem nenhum documento em `users/{uid}/digests` vê uma mensagem explicando que o primeiro digest ainda não foi gerado, não uma tela quebrada.

RF-6: A transição de status do digest mais recente (de `processing` para `completed` ou `failed`) MUST refletir na UI automaticamente, sem exigir que o usuário recarregue a página manualmente.
- Aceitação: Se o Cron Job concluir o processamento enquanto o usuário está com a dashboard aberta, o conteúdo aparece sem F5.

### US2 — Página de Histórico com Paginação
RF-7: Uma nova página `/history` MUST listar os digests anteriores do usuário autenticado, ordenados por `createdAt` decrescente.
- Aceitação: `/history` mostra os digests do usuário do mais recente para o mais antigo.

RF-8: A listagem em `/history` MUST carregar os digests em páginas, nunca buscando a coleção inteira de uma só vez, com uma forma de carregar mais itens além da primeira página.
- Aceitação: Ao abrir `/history` pela primeira vez, apenas um número limitado de digests é buscado do Firestore; um controle explícito (botão ou scroll) carrega o próximo lote.

RF-9: `/history` MUST estar protegida por autenticação, seguindo o mesmo padrão de `/dashboard`/`/settings` (`ProtectedRoute`, `AppHeader`).
- Aceitação: Acessar `/history` sem sessão ativa redireciona para `/login`, igual às demais páginas autenticadas.

RF-10: Cada item da listagem em `/history` MUST exibir ao menos a data de criação e um preview do conteúdo (não necessariamente o digest completo).
- Aceitação: Cada linha/card da listagem mostra quando o digest foi gerado e um resumo reconhecível do conteúdo.

RF-11: Itens da listagem em `/history` que não estiverem com `status: 'completed'` MUST exibir seu status (ex.: "processando"/"falhou") em vez de tentar renderizar conteúdo inexistente.
- Aceitação: Um digest `processing` ou `failed` na listagem de histórico não quebra a página nem aparece com conteúdo em branco sem explicação.

RF-12: O `AppHeader` MUST incluir um link para `/history`, junto com Dashboard e Configurações já existentes.
- Aceitação: A partir de `/dashboard` ou `/settings`, o usuário consegue chegar em `/history` clicando em um link do cabeçalho, sem editar a URL manualmente.

## Critérios de Sucesso
- SC-1: O conteúdo do digest mais recente aparece corretamente formatado (negrito, parágrafos) na dashboard, sem markdown bruto visível.
- SC-2: Um usuário com digest `processing` sempre vê um indicador de carregamento coerente, nunca uma tela em branco ou um erro.
- SC-3: `/history` nunca busca todos os digests do usuário de uma vez só, independentemente de quantos existam.
- SC-4: A transição de `processing` para `completed`/`failed` aparece na dashboard sem ação manual do usuário.
- SC-5: `/history` é alcançável a partir da navegação principal, sem exigir digitar a URL.

## Cenários de Aceitação
1. Cenário: Digest pronto
   - Dado um usuário com um digest `completed` mais recente
   - Quando abrir `/dashboard`
   - Então o conteúdo formatado (introdução + seções) aparece corretamente, com negrito/quebras de linha renderizados

2. Cenário: Digest em processamento
   - Dado um usuário cujo digest mais recente está `status: 'processing'`
   - Quando abrir `/dashboard`
   - Então um skeleton loading é exibido em vez de conteúdo

3. Cenário: Transição automática
   - Dado um usuário com a dashboard aberta mostrando o skeleton de um digest `processing`
   - Quando o Cron Job concluir e o digest passar para `completed`
   - Então o conteúdo aparece na tela sem o usuário recarregar a página

4. Cenário: Digest com falha
   - Dado um usuário cujo digest mais recente está `status: 'failed'`
   - Quando abrir `/dashboard`
   - Então uma mensagem amigável de erro é exibida, sem quebrar a página

5. Cenário: Usuário sem nenhum digest
   - Dado um usuário recém-criado sem nenhum documento em `digests`
   - Quando abrir `/dashboard`
   - Então um estado vazio explicativo é exibido

6. Cenário: Navegação e paginação do histórico
   - Dado um usuário com mais digests do que cabem em uma página
   - Quando abrir `/history` a partir do link no cabeçalho e carregar mais itens
   - Então os digests aparecem em ordem decrescente de data, carregados em lotes, sem buscar todos de uma vez

## Entidades Chave
- `Digest` — já definida na spec 007 (`users/{uid}/digests/{digestId}`); esta spec apenas lê e exibe.

## Assunções
- "Dashboard (/)" no pedido original se refere à página autenticada já existente em `/dashboard` (não à landing page pública `/`) — é onde o usuário já chega após o login (spec 002).
- A menção a um "campo text" no pedido original corresponde aos campos de texto livre já definidos pela spec 007 (`content.intro` e `content.sections[].summary`), já que o dicionário de dados não tem um único campo chamado `text` — a spec 007 optou deliberadamente por uma saída estruturada (`intro` + `sections`) em vez de um bloco de texto único.
- A leitura dos digests continua sendo feita pelo client Firestore SDK (como já ocorre para carregar `/settings` desde a spec 003) — o Princípio II da constitution exige apenas que escritas críticas sejam server-side; leituras não são afetadas.
- As regras de segurança do Firestore já configuradas (spec 002) permitem ao usuário autenticado ler sua própria subcoleção `digests`.
- O texto gerado pela IA (`content.intro`, `content.sections[].summary`) não contém HTML bruto — apenas sintaxe markdown simples; o renderizador de markdown não precisa (e não deve) habilitar renderização de HTML embutido, por segurança.

## Dependências
- Conclusão da spec 007 (`users/{uid}/digests`, os três status possíveis).
- Conclusão da spec 004 (`AppHeader`, tokens de cor MD3 — o novo componente de digest e o skeleton devem seguir o mesmo sistema de tema).
- Uma biblioteca de renderização de markdown (nova dependência, escolha específica em `plan.md`).

## Riscos e Mitigações
- Risco: Renderizar markdown gerado por IA sem sanitização adequada abrir uma superfície de XSS caso o modelo produza HTML/script embutido.
  - Mitigação: Usar a configuração padrão do renderizador de markdown, que não interpreta HTML bruto por padrão — não habilitar nenhum plugin que renderize HTML embutido no texto da IA.
- Risco: Escutar atualizações em tempo real (RF-6) sem se desinscrever ao sair da página gerar vazamento de listener/leitura desnecessária do Firestore.
  - Mitigação: O listener MUST ser encerrado quando o componente da dashboard for desmontado.
- Risco: `/history` crescer sem limite e degradar performance se a paginação não for respeitada.
  - Mitigação: RF-8 exige explicitamente carregamento em lotes; a implementação técnica (cursor do Firestore) fica detalhada em `plan.md`.

## Artefatos Criados
- `specs/008-visualizacao-digests/spec.md`
- `.specify/feature.json` apontando para `specs/008-visualizacao-digests`

## Próximos Passos
- Rodar `/speckit.plan` para gerar `plan.md`, detalhando a biblioteca de markdown escolhida, a estratégia de paginação (cursor do Firestore) e a estrutura dos componentes compartilhados.
- Gerar `tasks.md` com `/speckit.tasks`.
- Implementar `dashboard/page.tsx`, `history/page.tsx`, o componente de digest, o skeleton, e o link no `AppHeader`.

*Gerado em: 2026-07-28*
