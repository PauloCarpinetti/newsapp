# Data de Geração no Título do Digest

**Short name:** data-no-digest

**Feature Branch**: `010-data-no-digest`

**Created**: 2026-07-31

**Status**: Draft

## Resumo
O cabeçalho do digest mais recente em `/dashboard` hoje é o texto fixo "Seu digest de hoje", sem mostrar a data real de geração. Esta spec troca esse texto pela data real (`createdAt`) do digest exibido, no mesmo formato já usado em `/history`.

## Contexto e Motivação
"Hoje" é impreciso assim que o dia vira sem um novo digest ter sido gerado ainda (ex.: o horário configurado do usuário ainda não chegou), ou se o usuário está vendo o card fora do dia em que o digest foi realmente criado. Mostrar a data real remove essa ambiguidade e deixa claro exatamente de quando é o conteúdo exibido.

## Objetivos
- O cabeçalho do card de digest completo em `/dashboard` MUST mostrar a data real de `createdAt`, não o texto fixo "hoje".
- O formato da data MUST ser o mesmo já usado em `/history`, para consistência visual entre as duas telas.

## Escopo (In Scope)
- `src/app/dashboard/page.tsx`: o cabeçalho do card de digest `completed` (hoje `<h2>Seu digest de hoje</h2>`) passa a incluir a data formatada de `createdAt`.
- Tipo `LatestDigest` (local ao componente) ganha o campo `createdAt`, hoje ausente.

## Fora de Escopo
- Mudança nos cabeçalhos dos estados `processing`/`failed`/vazio — esses não têm um "resumo" com data de geração concluída para mostrar (o pedido original se refere ao título do resumo, ou seja, ao digest `completed`).
- Qualquer mudança em `/history`, que já mostra a data de cada digest desde a spec 008.
- Mudança no formato de data em si (mantém `Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" })`, já estabelecido em `/history`).

## Dados (Data Dictionary)
Nenhum campo novo — `createdAt` já existe em `users/{uid}/digests/{digestId}` desde a spec 007. Esta spec só passa a exibir um campo que já era lido pelo listener do dashboard (`onSnapshot`) mas descartado no tipo local `LatestDigest`.

## Requisitos Funcionais (Testáveis)

RF-1: Quando o digest mais recente tiver `status: 'completed'`, o cabeçalho do card MUST exibir a data de `createdAt` formatada, em vez do texto fixo "hoje".
- Aceitação: Um digest `completed` criado em uma data específica mostra essa data real no cabeçalho, não a palavra "hoje".

RF-2: O formato da data exibida MUST ser idêntico ao já usado em `/history` (`Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" })`).
- Aceitação: A mesma data, vista em `/dashboard` e em `/history` para o mesmo digest, aparece formatada de forma idêntica nas duas telas.

## Critérios de Sucesso
- SC-1: Nenhum usuário vê o texto fixo "hoje" no cabeçalho de um digest completo — sempre a data real.
- SC-2: A formatação de data é visualmente consistente entre `/dashboard` e `/history`.

## Cenários de Aceitação
1. Cenário: Digest completo exibido
   - Dado um usuário com um digest `completed` mais recente, criado numa data/hora específica
   - Quando abrir `/dashboard`
   - Então o cabeçalho do card mostra essa data formatada, não "Seu digest de hoje"

## Entidades Chave
- `Digest.createdAt` — já definido na spec 007; esta spec só estende onde esse campo já lido é exibido.

## Assunções
- "O título do resumo" no pedido original se refere ao cabeçalho do card de digest completo em `/dashboard` (hoje "Seu digest de hoje") — os estados `processing`/`failed`/vazio não têm um resumo gerado para datar.
- Reaproveitar o `dateFormatter` já usado em `/history` é preferível a criar um formato novo, para manter as duas telas visualmente consistentes.

## Dependências
- Nenhuma nova — `createdAt` já é lido pelo listener `onSnapshot` de `/dashboard` desde a spec 008, só não estava no tipo `LatestDigest` nem era renderizado.

## Riscos e Mitigações
- Risco: nenhum risco técnico relevante identificado — é uma mudança de exibição isolada, sem escrita nem mudança de schema.

## Artefatos Criados
- `specs/010-data-no-digest/spec.md`
- `.specify/feature.json` apontando para `specs/010-data-no-digest`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md` com o trecho exato de código.
- `tasks.md`.
- Implementar.

*Gerado em: 2026-07-31*
