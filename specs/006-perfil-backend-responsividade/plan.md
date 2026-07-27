# Implementation Plan: Correções: Criação de Perfil no Backend e Responsividade Visual

**Branch**: `006-perfil-backend-responsividade` | **Date**: 2026-07-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/006-perfil-backend-responsividade/spec.md`

## Summary

Move a criação do documento `users/{uid}` no primeiro login para `POST /api/auth/profile`, reaproveitando o padrão de endpoint autenticado (Admin SDK, `uid` só do token verificado) já estabelecido em `POST /api/settings` (spec 005). Corrige também dois bugs de overflow horizontal em telas pequenas: o `AppHeader` (spec 004) e a linha de cada fonte de informação em `/settings` (spec 003/005).

## Technical Context

**Language/Version**: TypeScript com Next.js App Router (Route Handlers) e React 18+ (mesma base das specs 001-005).

**Primary Dependencies**: Nenhuma dependência nova. Reaproveita `src/lib/firebase/admin.ts` (spec 005) e o SDK client já usado em `auth.ts`.

**Storage**: Firestore, mesma coleção `users/{uid}` — muda apenas o autor da escrita de criação do perfil (Admin SDK no servidor, não mais o client SDK).

**Testing**: Sem testes automatizados novos — mesma decisão da spec 005 para o Route Handler (exigiria mockar `firebase-admin` pesadamente); os ajustes de CSS responsivo não são unitáriamente testáveis de forma útil. Validação manual via os 4 cenários de aceitação do spec.

**Target Platform**: Web app Next.js; o novo endpoint roda como Route Handler server-side (Node.js runtime, mesma razão da spec 005: `firebase-admin` não é compatível com o Edge Runtime).

**Project Type**: Web application full-stack — segunda rota de API do projeto (depois de `/api/settings`).

**Performance Goals**: Sem exigência especial; o endpoint faz uma verificação de token e, na maioria das chamadas (login subsequente), uma leitura no Firestore sem escrita.

**Constraints**: Mesmas do endpoint da spec 005 — `uid`/`email`/`displayName` vêm exclusivamente do token verificado, nunca do corpo da requisição; `src/lib/firebase/admin.ts` só pode ser importado por código server-only. Os ajustes de CSS usam apenas breakpoints Tailwind já disponíveis (`sm:`), sem novas dependências de layout.

**Scale/Scope**: Um endpoint novo, uma função (`loginWithGoogle`) simplificada, dois componentes com ajuste de classes CSS.

## Constitution Check

- Fecha a última violação conhecida do Princípio II (escritas críticas em Client Component) registrada desde a spec 002.
- O endpoint reaproveita o mesmo padrão de `src/lib/firebase/admin.ts` e a mesma estratégia de erro (distinguir `app/*` de `auth/*`) já validada na spec 005 — consistente com o Princípio III (Manutenibilidade: não duplicar lógica).
- Ajustes visuais não alteram nenhuma decisão de tema/cor (spec 004) — apenas espaçamento/overflow.
- **Gate**: PASS. Nenhuma violação nova; uma violação preexistente é corrigida.

## Project Structure

### Documentation (this feature)

```text
specs/006-perfil-backend-responsividade/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   └── api/
│       └── auth/
│           └── profile/
│               └── route.ts       # novo: POST autenticado, idempotente
├── components/
│   └── AppHeader.tsx              # ajuste: flex-wrap + gaps/padding responsivos
├── app/settings/page.tsx          # ajuste: min-w-0 no input da linha de fontes
└── lib/
    └── firebase/
        └── auth.ts                 # loginWithGoogle() chama o endpoint em vez de setDoc direto
```

**Structure Decision**: O endpoint fica em `src/app/api/auth/profile/route.ts`, espelhando a convenção já usada em `src/app/api/settings/route.ts` (spec 005).

## Decisões Técnicas

### 1. Contrato do endpoint

`POST /api/auth/profile`

Header: `Authorization: Bearer <idToken>`. Sem corpo — `uid`, `email` e `displayName` vêm inteiramente do token decodificado (`decoded.uid`, `decoded.email`, `decoded.name`).

Respostas:
- `200 { created: boolean }` — `true` se o documento foi criado agora, `false` se já existia (idempotente).
- `401 { error: string }` — token ausente ou inválido.
- `500 { error: string }` — Admin SDK mal configurado, ou falha ao ler/escrever no Firestore.

```ts
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Falha ao verificar o token de autenticação", error);
    const code = (error as { code?: string })?.code;
    if (code?.startsWith("app/")) {
      return NextResponse.json({ error: "Erro de configuração do servidor." }, { status: 500 });
    }
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  try {
    const userRef = getAdminDb().doc(`users/${decoded.uid}`);
    const existing = await userRef.get();

    if (!existing.exists) {
      await userRef.set({
        uid: decoded.uid,
        email: decoded.email ?? "",
        displayName: decoded.name ?? null,
        createdAt: FieldValue.serverTimestamp(),
        config: {
          topics: [],
          sources: [],
          gptModel: "gpt-4o-mini",
          promptCustomization: null,
        },
        schedule: { localTime: "07:00", timezone: "UTC", targetHourUTC: 7 },
      });
    }

    return NextResponse.json({ created: !existing.exists });
  } catch (error) {
    console.error("Falha ao preparar o perfil", error);
    return NextResponse.json(
      { error: "Não foi possível preparar o perfil." },
      { status: 500 },
    );
  }
}
```

Mesma estrutura de erro (distinguir `app/*` de configuração vs. `auth/*` de token) já usada em `POST /api/settings` — reaproveitada, não reinventada.

### 2. `loginWithGoogle()` simplificado

```ts
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    const response = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!response.ok) {
      throw new Error("Falha ao preparar o perfil.");
    }

    return result.user;
  } catch (error) {
    console.error("Google login failed", error);
    throw new Error("Não foi possível concluir o login com o Google.");
  }
}
```

Os imports `doc`, `getDoc`, `setDoc`, `serverTimestamp` (client `firebase/firestore`) e `db` (`@/lib/firebase/config`) somem de `auth.ts` — não são mais usados nesse arquivo. Qualquer falha na chamada ao endpoint cai no mesmo `catch` genérico já existente, reaproveitando o tratamento de erro já exibido em `login/page.tsx` (RF do risco "propagar erro claro" do spec).

### 3. `AppHeader` — sem overflow em telas pequenas

Troca `justify-between` sem wrap por `flex-wrap` no `<nav>` e no grupo de links, com gaps/padding menores no breakpoint padrão (mobile-first) e maiores a partir de `sm:`:

```tsx
<nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4">
  <div className="flex flex-wrap items-center gap-3 sm:gap-6">
    {/* Link "AI Digest Aggregator", Link "Dashboard", Link "Configurações" — sem mudança de conteúdo */}
  </div>
  {/* botão "Sair" — sem mudança de conteúdo */}
</nav>
```

Em vez de cortar/esconder texto, o cabeçalho quebra para uma segunda linha quando não cabe — resolve o overflow sem remover nenhum link.

### 4. Linha de fontes em `/settings` — sem overflow

O `<input>` com `flex-1` não tem `min-width` definido, então o navegador não o encolhe abaixo do necessário para exibir seu conteúdo/placeholder — isso empurra o botão de lixeira para fora da margem em telas estreitas. Fix mínimo, padrão para esse problema de flexbox:

```tsx
<div className="flex items-center gap-2">
  <select className="shrink-0 rounded-md border border-outline bg-background p-2 text-on-background">...</select>
  <input className="min-w-0 flex-1 rounded-md border border-outline bg-background p-2 text-on-background" ... />
  <button className="shrink-0 text-error hover:opacity-80" ...><Trash2 size={20} /></button>
</div>
```

`min-w-0` permite que o input encolha normalmente; `shrink-0` no `<select>` e no botão garante que eles nunca fiquem espremidos a ponto de quebrar. Só o input perde largura em telas estreitas, o que é o comportamento esperado. O campo de tópicos (`topics`) tem uma estrutura de flex parecida mas não foi reportado com o mesmo bug — fica fora do escopo desta correção, mas é um candidato óbvio se o mesmo problema aparecer lá no futuro.

## Complexity Tracking

Nenhuma violação de constituição identificada — esta spec reduz uma violação preexistente e corrige regressões visuais, sem introduzir complexidade nova.
