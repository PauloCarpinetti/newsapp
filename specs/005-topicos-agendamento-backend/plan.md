# Implementation Plan: Épico 2 (Motor da IA) — Tags de Tópicos e Agendamento com Cálculo Backend

**Branch**: `005-topicos-agendamento-backend` | **Date**: 2026-07-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-topicos-agendamento-backend/spec.md`

## Summary

`config.topics` passa de texto livre para `string[]` (tags, min 1/max 10) em `settingsSchema.ts`, com UI de adicionar/remover tags em `/settings`. O salvamento do formulário deixa de escrever direto no Firestore pelo client e passa a chamar `POST /api/settings`, um Route Handler que verifica o ID token do usuário via Firebase Admin, calcula `schedule.targetHourUTC` reaproveitando `calculateTargetHourUTC` (spec 003) e persiste tudo em `users/{uid}` com o Admin SDK.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router (Route Handlers) e React 18+ (mesma base das specs 001-004).

**Primary Dependencies**: `firebase-admin` (já no `package.json` desde a spec 001, nunca inicializado até agora), `zod` (reaproveitado para validar o payload no servidor também), `firebase` client SDK para obter o ID token (`user.getIdToken()`).

**Storage**: Firestore, mesma coleção `users/{uid}` — muda apenas o autor da escrita (Admin SDK no servidor, não mais o client SDK).

**Testing**: `settingsSchema.test.ts` (spec 003) é atualizado para o novo formato de `topics` (array) e ganha casos para os limites min/max. `calculateTargetHourUTC` não muda — continua coberto pelos testes existentes e é apenas importado pelo novo endpoint. Sem testes automatizados para o Route Handler em si (exigiria mockar `firebase-admin` pesadamente); validação via os 4 cenários de aceitação do spec, manual.

**Target Platform**: Web app Next.js, com o novo endpoint rodando como Route Handler server-side (Node.js runtime, não Edge — `firebase-admin` não é compatível com o Edge Runtime).

**Project Type**: Web application full-stack — primeira feature deste projeto a introduzir uma rota de API própria (`src/app/api/`).

**Performance Goals**: Sem exigência de latência especial; o endpoint faz uma verificação de token e uma escrita no Firestore por requisição.

**Constraints**: `src/lib/firebase/admin.ts` só pode ser importado por código server-only (Route Handlers) — nunca por um Client Component, já que `firebase-admin` não roda no browser. O endpoint nunca aceita `uid` vindo do corpo da requisição; o `uid` usado para o caminho do documento vem exclusivamente do token verificado.

**Scale/Scope**: Um endpoint, uma tabela de tokens verificada por requisição, uma migração de schema (`topics`) e a troca do caminho de escrita em uma página já existente.

## Constitution Check

- Esta spec corrige diretamente uma violação do Princípio II identificada na própria spec: a escrita crítica de `users/{uid}` deixa de acontecer em um Client Component e passa a um endpoint server-side autenticado.
- O endpoint reaproveita `calculateTargetHourUTC` já testado, em vez de duplicar lógica — consistente com o Princípio III (Manutenibilidade).
- Falhas de autenticação/validação no endpoint retornam erros estruturados sem vazar credenciais do Admin SDK — consistente com o Princípio IV (Resiliência e Observabilidade).
- **Gate**: PASS. Nenhuma violação nova introduzida; uma violação preexistente é corrigida.

## Project Structure

### Documentation (this feature)

```text
specs/005-topicos-agendamento-backend/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── api/
│   │   └── settings/
│   │       └── route.ts       # novo: POST autenticado
│   └── settings/
│       └── page.tsx           # UI de tags + chamada ao endpoint em vez de updateDoc
└── lib/
    ├── firebase/
    │   └── admin.ts             # novo: Admin SDK (server-only)
    ├── schemas/
    │   ├── settingsSchema.ts     # topics: string -> string[] (min 1, max 10) + timezone
    │   └── settingsSchema.test.ts # atualizado para o novo formato
    └── utils/
        └── time.ts               # sem mudanças, reaproveitado pelo endpoint
```

**Structure Decision**: O endpoint fica em `src/app/api/settings/route.ts`, seguindo a convenção padrão de Route Handlers do App Router. `src/lib/firebase/admin.ts` fica ao lado de `config.ts` (client) para deixar explícito o par client/admin, mas com inicialização e uso completamente segregados.

## Decisões Técnicas

### 1. Contrato do endpoint

`POST /api/settings`

Header: `Authorization: Bearer <idToken>` (obtido via `user.getIdToken()` no client).

Body (JSON, validado com uma extensão de `settingsSchema` que inclui `timezone`):

```json
{
  "topics": ["Inteligência Artificial", "Next.js"],
  "sources": [{ "type": "rss", "url": "https://..." }],
  "promptCustomization": "Foque em notícias críticas.",
  "localTime": "07:00",
  "timezone": "America/Sao_Paulo"
}
```

Respostas:
- `200 { targetHourUTC: number, timezone: string }` — sucesso.
- `401 { error: string }` — token ausente ou inválido.
- `400 { error: string, issues: ... }` — payload não passa no `safeParse` do schema.
- `500 { error: string }` — falha inesperada (ex.: Admin SDK mal configurado), sem detalhes sensíveis no corpo da resposta.

O `uid` usado no caminho `users/{uid}` vem exclusivamente de `adminAuth.verifyIdToken(idToken).uid` — nunca do corpo da requisição. Isso torna RF-5 (rejeitar alteração de outro usuário) uma propriedade estrutural do endpoint, não uma checagem extra a ser esquecida.

### 2. `src/lib/firebase/admin.ts`

```ts
import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  return getApps().length
    ? getApp()
    : initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // .env armazena a chave com "\n" literal; precisa virar quebra de linha real.
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
}

export const adminAuth = getAuth(getAdminApp());
export const adminDb = getFirestore(getAdminApp());
```

Import restrito a Route Handlers (`src/app/api/**/route.ts`); nunca a partir de um arquivo com `"use client"`.

### 3. `settingsSchema.ts`

```ts
topics: z
  .array(z.string().min(1))
  .min(1, "Adicione pelo menos um tópico.")
  .max(10, "No máximo 10 tópicos."),
// ...sources, localTime, promptCustomization como já existem
timezone: z.string().min(1),
```

`SettingsFormValues["topics"]` muda de `string` para `string[]`; `settingsSchema.test.ts` é atualizado para os novos casos (array vazio, 11 itens, um item vazio dentro do array).

### 4. UI de tags em `settings/page.tsx`

Tópicos deixam de usar `register("topics")` num único `<input>` e passam a ser geridos como estado local simples (`useState<string[]>` sincronizado com `setValue("topics", ...)`), diferente de `sources` (que continua com `useFieldArray`, por ser um array de objetos). Um `<input>` de texto + Enter/botão adiciona uma tag; cada tag renderiza como um "pill" com botão de remoção, reaproveitando o padrão visual já usado nas fontes (tokens MD3 da spec 004).

### 5. Troca do caminho de escrita em `onSubmit`

`onSubmit` deixa de chamar `updateDoc(doc(db, "users", user.uid), {...})` e passa a:

```ts
const idToken = await user.getIdToken();
const response = await fetch("/api/settings", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
  body: JSON.stringify({ ...data, timezone: userTimezone }),
});
if (!response.ok) throw new Error("Falha ao salvar preferências.");
```

O `getDoc` inicial (carregar dados existentes ao abrir a página) continua no client — a spec e a constitution só exigem que **escritas críticas** sejam server-side; a leitura não muda.

## Complexity Tracking

Nenhuma violação de constituição identificada — esta spec reduz uma violação preexistente em vez de introduzir uma nova.
