# Opção de Manter Conectado no Login

**Short name:** manter-conectado

**Feature Branch**: `011-manter-conectado`

**Created**: 2026-07-31

**Status**: Draft

## Resumo
A tela de `/login` ganha um checkbox "Manter conectado", marcado por padrão, que controla se a sessão do usuário sobrevive ao fechar o navegador (persistência local) ou termina junto com a aba/sessão do navegador (persistência de sessão).

## Contexto e Motivação
Hoje o Firebase Auth usa sua persistência padrão (`browserLocalPersistence`) sem nenhuma chamada explícita de configuração no código — ou seja, todo login já fica conectado indefinidamente, sem o usuário ter escolhido isso nem ter como mudar. Expor essa escolha explicitamente dá controle a quem usa o app num computador compartilhado ou público, sem mudar o comportamento de quem não se importa (o padrão continua sendo "ficar conectado").

## Objetivos
- A tela de login MUST oferecer um checkbox "Manter conectado", marcado por padrão.
- Quando marcado (ou no padrão, sem interação), a sessão MUST persistir entre reaberturas do navegador (comportamento atual, inalterado).
- Quando desmarcado antes do login, a sessão MUST terminar ao fechar o navegador/aba, em vez de persistir indefinidamente.

## Escopo (In Scope)
- `src/app/login/page.tsx`: novo checkbox "Manter conectado", marcado por padrão.
- `src/lib/firebase/auth.ts`: `loginWithGoogle` passa a receber a escolha de persistência e chamar `setPersistence` do Firebase Auth antes de `signInWithPopup`.

## Fora de Escopo
- Qualquer mudança em `/api/auth/profile` ou no fluxo de criação de perfil — esta spec só afeta a persistência da sessão no client, não a lógica de criação/atualização do documento `users/{uid}`.
- Expirar sessões existentes já ativas — a mudança de persistência só se aplica a partir do próximo login; sessões já persistentes continuam persistentes até o usuário sair ou logar de novo com a caixa desmarcada.
- Qualquer alteração no botão/fluxo de logout já existente (`AppHeader`).
- Lembrar a preferência do usuário entre visitas não autenticadas (ex.: pré-marcar/desmarcar o checkbox com base em uma escolha anterior) — cada visita à tela de login começa com o padrão marcado.

## Dados (Data Dictionary)
Nenhum campo novo em `users/{uid}` — a escolha de persistência é um detalhe da sessão do Firebase Auth no browser, não é persistida no Firestore.

## Requisitos Funcionais (Testáveis)

RF-1: A tela `/login` MUST exibir um checkbox "Manter conectado", com estado inicial marcado.
- Aceitação: Ao abrir `/login`, o checkbox aparece marcado, sem exigir nenhuma ação do usuário.

RF-2: Ao fazer login com o checkbox marcado (padrão), a sessão MUST usar persistência local (`browserLocalPersistence`) — o usuário continua conectado após fechar e reabrir o navegador.
- Aceitação: Login feito com o checkbox marcado, seguido de fechar e reabrir o navegador, mantém o usuário autenticado em `/dashboard` sem pedir login de novo.

RF-3: Ao fazer login com o checkbox desmarcado, a sessão MUST usar persistência de sessão (`browserSessionPersistence`) — o usuário é desconectado ao fechar a aba/navegador.
- Aceitação: Login feito com o checkbox desmarcado, seguido de fechar completamente o navegador e reabrir, exige novo login em `/dashboard`.

RF-4: A escolha do checkbox MUST ser aplicada antes da chamada de login com o Google, não depois.
- Aceitação: A persistência configurada corresponde ao estado do checkbox no momento em que o usuário clica em "Entrar com o Google", não a um estado default aplicado por engano após a autenticação já ter ocorrido.

## Critérios de Sucesso
- SC-1: O comportamento padrão (checkbox marcado, sem interação do usuário) é idêntico ao comportamento atual do app — nenhuma regressão para quem não mexe na opção.
- SC-2: Desmarcar o checkbox produz sessão que não sobrevive ao fechamento do navegador, de forma verificável.

## Cenários de Aceitação
1. Cenário: Login padrão (checkbox marcado)
   - Dado um usuário na tela de login, sem alterar o checkbox
   - Quando ele faz login com o Google, fecha e reabre o navegador
   - Então continua autenticado, sem precisar logar de novo

2. Cenário: Login com "Manter conectado" desmarcado
   - Dado um usuário na tela de login que desmarca o checkbox antes de clicar em "Entrar com o Google"
   - Quando ele fecha completamente o navegador e reabre
   - Então precisa fazer login de novo ao acessar uma rota protegida

## Entidades Chave
Nenhuma nova — mudança de configuração do SDK client do Firebase Auth, sem novo dado persistido.

## Assunções
- "Manter conectado" é a tradução escolhida (equivalente a "Remember me"/"Keep me signed in" de outros produtos) — termo a confirmar visualmente com o usuário, mas não é um NEEDS CLARIFICATION bloqueante.
- O checkbox vem marcado por padrão pra preservar o comportamento atual do app (decisão confirmada com Paulo antes de escrever esta spec) — quem nunca interage com o checkbox não percebe nenhuma mudança.
- `browserSessionPersistence` do Firebase Auth é suficiente pra atender "termina ao fechar o navegador" — não é necessário um mecanismo de expiração customizado (ex.: TTL de token) além do que o SDK já oferece nativamente.

## Dependências
- Nenhuma nova — `setPersistence`, `browserLocalPersistence` e `browserSessionPersistence` já fazem parte do pacote `firebase/auth` já instalado.

## Riscos e Mitigações
- Risco: aplicar `setPersistence` depois do `signInWithPopup` (ordem errada) resultaria na escolha do usuário sendo ignorada silenciosamente — o Firebase exige que a persistência seja configurada antes da chamada de login.
  - Mitigação: RF-4 torna esse requisito de ordem explícito; `plan.md` detalha a sequência exata de chamadas.
- Risco: nenhum risco de segurança novo — `browserSessionPersistence` é um modo padrão e documentado do Firebase Auth, não uma implementação própria de gerenciamento de sessão.

## Artefatos Criados
- `specs/011-manter-conectado/spec.md`
- `.specify/feature.json` apontando para `specs/011-manter-conectado`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md` com o trecho exato de código.
- `tasks.md`.
- Implementar.

*Gerado em: 2026-07-31*
