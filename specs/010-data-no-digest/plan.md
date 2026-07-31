# Implementation Plan: Data de Geração no Título do Digest

**Branch**: `010-data-no-digest` | **Date**: 2026-07-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/010-data-no-digest/spec.md`

## Summary

`LatestDigest` (tipo local de `dashboard/page.tsx`) ganha o campo `createdAt`, já presente no documento Firestore mas até então descartado. O cabeçalho fixo "Seu digest de hoje" é substituído por "Seu digest de {data formatada}", reaproveitando o mesmo `Intl.DateTimeFormat` já usado em `/history`.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router, React 18+ (mesma base das specs anteriores).

**Primary Dependencies**: Nenhuma nova — `firebase/firestore` (já em uso) e `Intl.DateTimeFormat` nativo (já em uso em `/history`).

**Storage**: Nenhuma escrita; leitura de um campo (`createdAt`) que o listener `onSnapshot` já traz no snapshot, só não estava tipado/renderizado.

**Testing**: Sem teste automatizado novo — é formatação de string dentro de um client component, mesmo padrão de `/history` (que também não tem teste unitário para sua formatação de data). Validação manual do cenário de aceitação do spec.

**Target Platform**: Web, client component (`/dashboard` já é `"use client"`).

**Project Type**: Extensão pontual de uma página existente.

**Performance Goals**: N/A — sem mudança de padrão de leitura (mesmo listener `limit(1)` já existente).

**Constraints**: `createdAt` pode estar ausente em teoria (nunca acontece na prática, já que `route.ts` sempre grava `FieldValue.serverTimestamp()` no momento da criação do documento) — o código MUST tolerar isso sem quebrar, mesmo padrão defensivo já usado em `/history` (`digest.createdAt ? ... : "Data desconhecida"`).

**Scale/Scope**: Uma mudança de tipo + uma mudança de JSX em um único arquivo.

## Constitution Check

- Nenhuma escrita, nenhuma credencial, nenhuma mudança de regra de segurança — Princípios I/II não se aplicam.
- Reaproveitar o formatter já existente em vez de duplicar a lógica de formatação de data é a aplicação direta do Princípio III (evitar abstração/duplicação sem benefício).
- Guard defensivo pra `createdAt` ausente segue o Princípio IV (nunca quebrar a UI por um campo teoricamente ausente).
- Mudança pequena demais para justificar uma ADR (Princípio V) — não introduz nenhum padrão arquitetural novo, só reaplica um já existente.
- **Gate**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/010-data-no-digest/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
└── app/
    └── dashboard/
        └── page.tsx   # + createdAt no tipo LatestDigest; cabeçalho usa a data real
```

**Structure Decision**: Nenhum arquivo novo — mudança contida em `dashboard/page.tsx`.

## Decisões Técnicas

### 1. `LatestDigest` ganha `createdAt`

```ts
type LatestDigest = {
  id: string;
  status: "processing" | "completed" | "failed";
  content?: DigestContent;
  createdAt?: { toDate: () => Date };
};
```

Mesmo formato de tipo já usado em `history/page.tsx`'s `DigestListItem` (`createdAt?: { toDate: () => Date }`), para consistência entre os dois arquivos que leem o mesmo tipo de documento.

### 2. Formatter compartilhado por convenção, não por import

`/history` já define:

```ts
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});
```

Esse `const` é módulo-local em `history/page.tsx`, não exportado. Duas opções: (a) duplicar a mesma definição em `dashboard/page.tsx`, ou (b) extrair pra um util compartilhado (ex.: `src/lib/utils/date.ts`).

Escolha: **(b) extrair um util compartilhado** — duas cópias idênticas do mesmo `Intl.DateTimeFormat` em dois arquivos é exatamente o tipo de duplicação sem benefício que o Princípio III pede pra evitar, e o custo de extrair é mínimo (uma constante).

```ts
// src/lib/utils/date.ts
export const digestDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});
```

`history/page.tsx` passa a importar `digestDateFormatter` em vez de definir a sua própria (pequeno refactor de casa, incluído nesta spec por ser trivial e diretamente relacionado).

### 3. Cabeçalho do digest completo

```tsx
<h2 className="text-lg font-semibold text-on-surface">
  Seu digest de{" "}
  {latestDigest.createdAt
    ? digestDateFormatter.format(latestDigest.createdAt.toDate())
    : "hoje"}
</h2>
```

Fallback pra "hoje" mantido apenas para o caso teoricamente impossível de `createdAt` ausente (nunca deixa a UI sem texto nenhum), sem introduzir um estado de erro visível pra algo que não é uma falha real do usuário.

## Complexity Tracking

Nenhuma violação de constituição identificada.
