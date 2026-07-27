# Navegação Compartilhada, Tema Claro/Escuro e Base Visual (Material Design 3)

**Short name:** navegacao-compartilhada

**Feature Branch**: `004-navegacao-compartilhada`

**Created**: 2026-07-25

**Status**: Draft

## Resumo
Três lacunas de UX/visual acumuladas nas specs 001-003, resolvidas juntas por tocarem a mesma base visual da aplicação: (1) um cabeçalho de navegação compartilhado entre as páginas autenticadas (`/dashboard`, `/settings`), com logout e um botão de acesso ao login a partir da landing page; (2) uma alternância de tema claro/escuro disponível em toda a aplicação, com preferência persistida; e (3) uma base visual consistente em `globals.css` — tokens de cor semânticos do Material Design 3 no `:root` (e seu equivalente escuro) e um reset/normalização que evite diferenças visuais entre navegadores.

## Contexto e Motivação
As specs 002 e 003 entregaram autenticação, perfil e preferências como páginas funcionais, mas nenhuma tratou de navegação entre si nem de uma base visual compartilhada — cada página foi construída isoladamente, com cores fixas via classes Tailwind (`bg-slate-950`, `text-cyan-400` etc.) hardcoded diretamente no JSX. Isso deixa a aplicação praticamente inutilizável fora de testes manuais com URLs digitadas à mão (sem navegação, sem logout na UI, sem CTA de login na home) e sem qualquer forma de o usuário escolher entre tema claro e escuro, nem uma paleta de cores consistente e testada entre navegadores.

## Objetivos
- Fornecer um cabeçalho compartilhado nas páginas autenticadas, com links para "Dashboard" e "Configurações" e um botão "Sair".
- Adicionar um botão de call-to-action visível na landing page (`/`) levando o visitante para `/login`.
- Permitir que o usuário alterne entre tema claro e escuro em qualquer página, com a escolha persistida entre sessões.
- Definir, em `globals.css`, as variáveis de cor semânticas do Material Design 3 (`primary`, `secondary`, `tertiary`, `error`, `surface`, `background`, `outline` e seus pares `on-*`/`container`) para os temas claro e escuro.
- Adicionar um reset/normalização de CSS que garanta consistência visual básica (tipografia, espaçamento, controles de formulário) entre navegadores modernos.

## Escopo (In Scope)
- `src/components/AppHeader.tsx` (cabeçalho com links de navegação e botão de logout, renderizado apenas nas páginas autenticadas)
- `src/components/ThemeToggle.tsx` (botão de alternância de tema, disponível em todas as páginas, públicas e autenticadas)
- Mecanismo de leitura/persistência da preferência de tema (ex.: `localStorage`), com fallback para `prefers-color-scheme` do sistema operacional na primeira visita
- Atualização de `src/app/globals.css`: variáveis de cor MD3 no `:root` (tema claro) e um bloco equivalente para o tema escuro, mais reset/normalização de base
- Atualização de `src/app/layout.tsx` para aplicar o tema selecionado (ex.: atributo `data-theme` na tag `<html>`) e renderizar o `ThemeToggle` globalmente
- Atualização de `src/app/dashboard/page.tsx` e `src/app/settings/page.tsx` para usar `AppHeader` (substituindo o link avulso "Editar preferências" adicionado na spec 003) e migrar suas cores hardcoded para as variáveis MD3
- Atualização de `src/app/page.tsx` (landing page) e `src/app/login/page.tsx` com um botão/CTA para `/login` e migração de cores para as variáveis MD3

## Fora de Escopo
- Menu responsivo/hambúrguer para mobile — o cabeçalho pode quebrar linha de forma simples, sem componente de menu dedicado.
- Avatar ou foto de perfil do usuário no cabeçalho.
- Breadcrumbs ou navegação multi-nível.
- Indicador visual de "página ativa" no menu (nice-to-have, não obrigatório nesta entrega).
- Sincronizar a preferência de tema entre dispositivos via Firestore — a persistência é local ao navegador (`localStorage`).
- Seguir mudanças do tema do sistema operacional em tempo real depois que o usuário já fez uma escolha manual explícita.
- Adoção completa da biblioteca de componentes Material Design 3 (elevação, forma, tipografia, motion) — apenas os tokens de cor semânticos.
- Suporte a navegadores legados (ex.: Internet Explorer) — o alvo continua sendo navegadores modernos evergreen, como já definido nas specs anteriores.
- Testes automatizados de regressão visual (screenshot diffing) — a validação de consistência entre navegadores é manual.

## Requisitos Funcionais (Testáveis)

### Navegação
RF-1: As páginas `/dashboard` e `/settings` MUST renderizar um cabeçalho compartilhado (`AppHeader`) com links para "Dashboard" e "Configurações".
- Aceitação: A partir de `/dashboard`, clicar em "Configurações" navega para `/settings`, e vice-versa, sem precisar digitar a URL.

RF-2: O cabeçalho MUST incluir um botão "Sair" que chama `logout()` (de `src/lib/firebase/auth.ts`) e redireciona o usuário para `/login`.
- Aceitação: Clicar em "Sair" encerra a sessão (Firebase Auth `currentUser` vira `null`) e a URL muda para `/login`.

RF-3: Após o logout, tentar acessar `/dashboard` ou `/settings` diretamente MUST redirecionar para `/login` (comportamento já garantido por `ProtectedRoute`, aqui apenas validado end-to-end com o novo botão).
- Aceitação: Deslogar e acessar `/dashboard` resulta em redirecionamento para `/login`.

RF-4: A landing page (`/`) MUST exibir um botão visível e destacado que leve o visitante para `/login`.
- Aceitação: Um visitante em `/` consegue chegar em `/login` clicando em um botão da página, sem editar a URL manualmente.

RF-5: O `AppHeader` (links de Dashboard/Configurações/Sair) MUST aparecer apenas nas páginas autenticadas; a landing page e a página de login não devem exibi-lo.
- Aceitação: `/` e `/login` não renderizam os links de "Dashboard"/"Configurações"/"Sair".

### Tema Claro/Escuro
RF-6: O sistema MUST fornecer um controle (`ThemeToggle`) para alternar entre tema claro e escuro, disponível em todas as páginas — públicas (`/`, `/login`) e autenticadas (`/dashboard`, `/settings`).
- Aceitação: O botão de alternância está visível e funcional em todas as quatro páginas.

RF-7: A escolha de tema do usuário MUST ser persistida (ex.: `localStorage`) e reaplicada automaticamente em visitas futuras, sem exigir nova seleção a cada carregamento.
- Aceitação: Alternar para o tema escuro, recarregar a página, e o tema escuro continua ativo.

RF-8: Na primeira visita (sem preferência salva), o sistema MUST usar a preferência de esquema de cores do sistema operacional (`prefers-color-scheme`) como tema inicial.
- Aceitação: Com o SO configurado para modo escuro e nenhuma preferência salva, a aplicação abre no tema escuro; o mesmo vale para o modo claro.

### Base Visual (Material Design 3 + Reset)
RF-9: `src/app/globals.css` MUST definir, no `:root`, variáveis CSS para os papéis de cor semânticos do Material Design 3 (`primary`, `secondary`, `tertiary`, `error`, `background`, `surface`, `outline`, e os pares `on-*`/`container` correspondentes) para o tema claro, com um bloco equivalente de sobrescrita para o tema escuro.
- Aceitação: Inspecionar `:root` e o seletor do tema escuro em `globals.css` mostra as variáveis MD3 com valores distintos para claro e escuro; as páginas atualizadas usam essas variáveis em vez de cores Tailwind hardcoded (`slate-950`, `cyan-400` etc.).

RF-10: O sistema MUST aplicar um reset/normalização de CSS base (cobrindo `box-sizing`, margens/padding padrão do user-agent, tipografia de headings/listas, e aparência de controles de formulário) para reduzir divergências visuais entre navegadores.
- Aceitação: A landing page, login, dashboard e settings mantêm o mesmo espaçamento, tipografia e aparência de inputs/botões ao serem abertas em pelo menos dois motores de navegador diferentes (ex.: Chromium e Firefox).

## Critérios de Sucesso
- SC-1: Um usuário autenticado consegue navegar entre `/dashboard` e `/settings` e encerrar a sessão usando apenas cliques, sem editar a URL do navegador.
- SC-2: Um visitante não autenticado consegue chegar em `/login` a partir da landing page usando apenas cliques.
- SC-3: Depois de clicar em "Sair", nenhuma página protegida permanece acessível sem novo login.
- SC-4: A preferência de tema escolhida pelo usuário persiste após fechar e reabrir o navegador.
- SC-5: Todas as páginas usam exclusivamente as variáveis de cor MD3 definidas em `globals.css` — nenhuma cor de fundo/texto principal fica hardcoded fora do sistema de tema.
- SC-6: A aparência da aplicação (espaçamento, tipografia, controles de formulário) é visualmente equivalente entre pelo menos dois navegadores diferentes.

## Cenários de Aceitação
1. Cenário: Navegação entre páginas autenticadas
   - Dado um usuário logado em `/dashboard`
   - Quando clicar no link "Configurações" no cabeçalho
   - Então é levado para `/settings`, e o cabeçalho continua visível com o link "Dashboard" disponível para voltar

2. Cenário: Logout pela interface
   - Dado um usuário logado em `/dashboard` ou `/settings`
   - Quando clicar em "Sair"
   - Então a sessão é encerrada e o usuário é redirecionado para `/login`

3. Cenário: Acesso pós-logout
   - Dado um usuário que acabou de clicar em "Sair"
   - Quando tentar acessar `/dashboard` diretamente pela URL
   - Então é redirecionado para `/login`

4. Cenário: Entrada a partir da landing page
   - Dado um visitante não autenticado em `/`
   - Quando clicar no botão de login
   - Então é levado para `/login`

5. Cenário: Alternância e persistência de tema
   - Dado qualquer página da aplicação
   - Quando o usuário clicar no `ThemeToggle` para mudar de claro para escuro (ou vice-versa) e depois recarregar a página
   - Então o tema escolhido continua aplicado após o reload

6. Cenário: Tema padrão pela preferência do sistema
   - Dado um visitante sem preferência de tema salva e o sistema operacional configurado em modo escuro
   - Quando abrir a aplicação pela primeira vez
   - Então a aplicação é exibida no tema escuro por padrão

## Entidades Chave
Nenhuma entidade de dados nova no Firestore. A preferência de tema é um dado de UI local ao navegador (`localStorage`), não parte do documento `users/{uid}`.

## Assunções
- `src/lib/firebase/auth.ts` (spec 002) já expõe `logout()` e não precisa de alterações.
- `src/contexts/AuthContext.tsx` e `src/components/ProtectedRoute.tsx` (spec 002) continuam sendo a fonte de verdade para o estado de autenticação; o `AppHeader` apenas consome `useAuth()` para saber se deve chamar `logout()`.
- A spec 003 (`/settings`) precisa estar implementada para que os links do cabeçalho façam sentido — esta feature assume que `src/app/settings/page.tsx` já existe.
- A paleta MD3 exata (valores de cor por papel semântico, para claro e escuro) será definida em `plan.md`, a partir da paleta base já usada pela aplicação (tons de slate/cyan), sem exigir um design de marca novo.
- Tailwind's `@tailwind base` (Preflight) já cobre parte do reset; este spec cobre o que Preflight não resolve sozinho (ex.: variáveis de tema, cores de seleção de texto, foco visível consistente).

## Dependências
- Conclusão da spec 002 (autenticação, `logout()`, `AuthContext`).
- Conclusão da spec 003 (`/settings` já existente, para o `AppHeader` ter dois destinos reais).

## Riscos e Mitigações
- Risco: Duplicar lógica de logout em cada página em vez de centralizar no `AppHeader`.
  - Mitigação: `AppHeader` é o único lugar que chama `logout()`; páginas apenas o importam e renderizam.
- Risco: O cabeçalho de navegação aparecer também em páginas públicas (`/`, `/login`), confundindo visitantes não autenticados com links para páginas que não conseguem acessar.
  - Mitigação: `AppHeader` só é renderizado dentro das páginas já envolvidas por `ProtectedRoute`, nunca no layout raiz (diferente do `ThemeToggle`, que é global por natureza).
- Risco: Migrar as cores hardcoded das páginas existentes para variáveis MD3 introduzir regressões visuais.
  - Mitigação: Validação manual de cada página migrada, comparando visualmente antes/depois nos dois temas.
- Risco: Um "flash" de tema errado (ex.: claro por um instante antes de aplicar o escuro salvo) ao carregar a página.
  - Mitigação: Aplicar o tema o mais cedo possível na renderização (ex.: leitura síncrona da preferência antes da primeira pintura), decisão técnica detalhada em `plan.md`.

## Artefatos Criados
- `specs/004-navegacao-compartilhada/spec.md`
- `.specify/feature.json` apontando para `specs/004-navegacao-compartilhada`

## Próximos Passos
- Rodar `/speckit.plan` para gerar `plan.md`, incluindo a definição da paleta MD3 exata e a estratégia de aplicação do tema sem flash.
- Gerar `tasks.md` com `/speckit.tasks`.
- Implementar `AppHeader.tsx`, `ThemeToggle.tsx`, atualizar `globals.css`/`layout.tsx`, e migrar `page.tsx`, `login/page.tsx`, `dashboard/page.tsx` e `settings/page.tsx` para as variáveis de tema.

*Gerado em: 2026-07-25*
