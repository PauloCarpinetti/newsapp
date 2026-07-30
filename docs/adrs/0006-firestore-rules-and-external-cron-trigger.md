# ADR 0006: Firestore rules versionadas + disparo do Cron via GitHub Actions

**Status**: Accepted
**Data**: 2026-07-30
**Specs relacionadas**: nenhuma (endurecimento de infraestrutura pós spec 008, não uma spec numerada)

## Contexto

Com o produto funcional de ponta a ponta (specs 001-008) e a primeira colocação em produção na Vercel, duas lacunas operacionais precisavam ser fechadas antes do projeto ser considerado pronto:

1. As regras de segurança do Firestore só existiam configuradas manualmente no Firebase Console, sem versão no repositório — inclusive com uma correção feita às pressas no Console durante o teste da spec 008 (a subcoleção `digests` não herdava a regra de `users/{uid}`). Não havia garantia de que o que estava live no Console refletia o uso real do código.
2. `vercel.json` agendava `GET /api/cron/generate` a cada hora via Cron nativo da Vercel — mas o plano Hobby só dispara Cron Jobs 1x/dia. Isso só foi descoberto na prática: a Vercel recusou o deploy com o `vercel.json` original, confirmando que o pipeline nunca rodaria com a granularidade horária que `schedule.targetHourUTC` (spec 007) foi desenhado pra usar.

## Decisão

**Firestore rules como código**: `firestore.rules` (+ `firebase.json` + `.firebaserc`) versionados no repositório, reconstruídos a partir do uso real do código em vez do que estava no Console: client só lê os próprios `users/{uid}` e `users/{uid}/digests/{digestId}`; toda escrita é negada ao client (todo write do projeto já passa por endpoint com Admin SDK, que ignora estas regras); deny-all de fallback para qualquer coleção futura sem regra explícita. Publicação continua manual (colar no Console) — a Firebase CLI não foi instalada neste projeto.

**Cron externo via GitHub Actions**: removido o bloco `crons` do `vercel.json`; criado `.github/workflows/cron-digest.yml`, agendado por `cron: "0 * * * *"` com `workflow_dispatch` habilitado, chamando `GET /api/cron/generate` contra a URL de produção com o mesmo `Authorization: Bearer $CRON_SECRET` que o endpoint já validava. Validado em produção via disparo manual (`workflow_dispatch`) após o deploy.

## Alternativas Consideradas

- **Upgrade da Vercel para o plano Pro**: rejeitado — custo recorrente desproporcional para um projeto solo de portfólio, quando o mesmo resultado é alcançável de graça.
- **Serviço de cron externo de terceiros (ex. cron-job.org)**: rejeitado em favor do GitHub Actions — o projeto já vive inteiramente no ecossistema GitHub (specs, PRs, Actions), então o agendamento fica versionado como código no mesmo repositório, sem depender de outra conta externa.
- **Redesenhar o pipeline para rodar 1x/dia** (compatível nativamente com o Cron da Vercel no Hobby): rejeitado — perderia a granularidade de horário por usuário que a spec 007 implementou deliberadamente (`schedule.targetHourUTC`).
- **Deploy das rules via Firebase CLI** (`firebase deploy --only firestore:rules`): adiado, não rejeitado — o `firebase.json`/`.firebaserc` já deixam isso pronto para quando a CLI for instalada; por ora a publicação manual no Console é suficiente pro volume de mudanças esperado.

## Consequências

- `firestore.rules` é a fonte da verdade, mas a sincronização com o Console **não é automática** — qualquer mudança futura no arquivo precisa ser colada manualmente no Console também; um passo manual fácil de esquecer até a CLI ser adotada.
- O disparo horário depende do GitHub Actions Scheduled Workflows, que é "melhor esforço" (pode atrasar minutos sob carga da plataforma) e é desabilitado automaticamente pelo GitHub após 60 dias sem nenhum commit no branch padrão — documentado no README como limitação conhecida, aceitável para este projeto.
- A Vercel deixou de ter qualquer papel no agendamento do pipeline — `vercel.json` não existe mais no repositório. Se o projeto crescer a ponto de justificar o plano Pro no futuro, o Cron nativo pode ser reintroduzido sem conflito, já que o endpoint continua protegido pelo mesmo `CRON_SECRET` independente de quem o chama.
- Este é o padrão a seguir para qualquer regra de segurança ou agendamento futuro do projeto: mudança de infraestrutura sensível vira arquivo versionado no repo, não configuração manual invisível ao histórico do git.
