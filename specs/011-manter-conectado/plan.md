# Implementation Plan: Opção de Manter Conectado no Login

**Branch**: `011-manter-conectado` | **Date**: 2026-07-31 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/011-manter-conectado/spec.md`

## Summary

`loginWithGoogle` passa a receber um parâmetro `keepSignedIn: boolean` e chama `setPersistence(auth, keepSignedIn ? browserLocalPersistence : browserSessionPersistence)` **antes** de `signInWithPopup` — a ordem é exigida pelo próprio Firebase Auth (a persistência configurada só vale para o próximo login, não retroativamente). `/login` ganha um checkbox "Manter conectado", com estado local `useState(true)`, cujo valor é passado pra `loginWithGoogle` no clique do botão.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router, React 18+ (mesma base das specs anteriores).

**Primary Dependencies**: Nenhuma nova — `setPersistence`, `browserLocalPersistence`, `browserSessionPersistence` já fazem parte do `firebase/auth` (pacote `firebase` já instalado desde a spec 001).

**Storage**: Nenhuma — persistência de sessão é um mecanismo do SDK client do Firebase Auth (armazenamento local do browser gerenciado pelo próprio SDK), não envolve Firestore nem o Admin SDK.

**Testing**: Sem teste automatizado novo — é um toggle de estado de UI (`useState`) e uma chamada de SDK de terceiros; não há lógica pura isolada que justifique teste unitário, mesmo padrão de `/login` hoje (sem testes).

**Target Platform**: Web, client components (`/login` já é `"use client"`).

**Project Type**: Extensão pontual de uma página + uma função existentes.

**Performance Goals**: N/A.

**Constraints**: `setPersistence` MUST ser chamado antes de `signInWithPopup` — chamar depois não tem efeito sobre a sessão que acabou de ser criada (requisito da própria API do Firebase Auth, não uma escolha de implementação).

**Scale/Scope**: Duas funções/arquivos tocados (`login/page.tsx`, `lib/firebase/auth.ts`), nenhum arquivo novo.

## Constitution Check

- Nenhuma credencial nova, nenhuma escrita server-side envolvida — Princípios I/II não se aplicam.
- Mudança pequena e isolada, nome de parâmetro explícito (`keepSignedIn`) — Princípio III.
- Nenhum processo assíncrono em lote nem novo tratamento de falha necessário além do já existente (`try/catch` já presente em `loginWithGoogle`) — Princípio IV não é afetado.
- Não introduz padrão arquitetural novo (é uso direto e documentado de uma API padrão do Firebase Auth) — não justifica ADR (Princípio V).
- **Gate**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/011-manter-conectado/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   └── login/
│       └── page.tsx        # + checkbox "Manter conectado" (useState(true))
└── lib/
    └── firebase/
        └── auth.ts          # loginWithGoogle(keepSignedIn) + setPersistence antes do signInWithPopup
```

**Structure Decision**: Nenhum arquivo novo — mudança contida nos dois arquivos que já implementam o fluxo de login.

## Decisões Técnicas

### 1. `src/lib/firebase/auth.ts`

```ts
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle(keepSignedIn: boolean) {
  try {
    await setPersistence(
      auth,
      keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
    );

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

`setPersistence` fica dentro do mesmo `try`, já que uma falha nessa chamada (rara — só ocorre em ambientes sem `localStorage`/`sessionStorage` disponível) deve cair no mesmo tratamento de erro genérico já existente, sem precisar de um caso especial.

### 2. `src/app/login/page.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginWithGoogle } from "@/lib/firebase/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const router = useRouter();

  async function handleLogin() {
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle(keepSignedIn);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado durante o login.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-20 text-on-background">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-8 text-on-surface shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Login
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Acesse sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          Entre com o Google para criar ou recuperar o perfil do usuário.
        </p>

        <label className="mt-6 flex items-center gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
            className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
          />
          Manter conectado
        </label>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar com Google"}
        </button>

        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
      </div>
    </main>
  );
}
```

Único elemento novo: o `<label>` com o checkbox, posicionado entre o texto descritivo e o botão de login (ordem de leitura natural: explica o que vai acontecer, oferece a opção, depois o botão de ação). `useState(true)` garante o padrão marcado (RF-1), sem precisar de nenhuma lógica adicional pra isso.

## Complexity Tracking

Nenhuma violação de constituição identificada.
