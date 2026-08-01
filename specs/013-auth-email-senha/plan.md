# Implementation Plan: Autenticação por E-mail e Senha

**Branch**: `013-auth-email-senha` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/013-auth-email-senha/spec.md`

## Summary

`src/lib/firebase/auth.ts` ganha `registerWithEmail`, `loginWithEmail` e `resetPassword`, seguindo o mesmo padrão já usado por `loginWithGoogle` (`setPersistence` conforme o checkbox "Manter conectado", depois a chamada do Firebase Auth). Um helper `createProfile(idToken)` é extraído de dentro de `loginWithGoogle` e reaproveitado pelas três novas funções, e um `mapAuthError` centraliza a tradução de códigos de erro do Firebase pra mensagens em português — genéricas o bastante pra não revelar se um e-mail específico tem conta (RF-6/RF-9). `/login` ganha um formulário de e-mail/senha (`react-hook-form` + `zodResolver`) com alternância entre "Entrar" e "Criar conta", e um link "Esqueci minha senha".

## Technical Context

**Language/Version**: TypeScript, Next.js App Router, React 18+ (mesma base das specs anteriores).

**Primary Dependencies**: `firebase/auth` (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`, `sendPasswordResetEmail` — já disponíveis no SDK já instalado), `react-hook-form` + `@hookform/resolvers/zod` (já em uso em `/settings`/`/profile`). **Nenhuma dependência nova.**

**Storage**: Nenhuma mudança de schema — contas por e-mail/senha usam o mesmo `users/{uid}` e o mesmo `POST /api/auth/profile` (Admin SDK, spec 002) já usados por contas Google. Redefinição de senha (`sendPasswordResetEmail`) é inteiramente gerenciada pelo Firebase Authentication, sem nenhuma escrita no Firestore.

**Testing**: `authSchema` (Zod) ganha `authSchema.test.ts`, mesmo padrão de `profileSchema.test.ts`/`settingsSchema.test.ts`. `mapAuthError` é pura e isolada — ganha `auth.test.ts` cobrindo os códigos mapeados e o fallback genérico.

**Target Platform**: Web — `/login` client component; nenhuma mudança server-side (o endpoint de criação de perfil já existe e já é agnóstico ao provedor de login).

**Project Type**: Extensão pontual de um módulo (`auth.ts`) e uma página (`/login`) já existentes.

**Performance Goals**: N/A.

**Constraints**: Mensagens de erro de login (RF-6) e de redefinição de senha (RF-9) MUST ser genéricas o bastante pra nunca revelar se um e-mail específico tem conta — `mapAuthError` não MUST diferenciar `auth/user-not-found` de `auth/wrong-password`/`auth/invalid-credential` na mensagem final ao usuário, mesmo que o Firebase distinga internamente.

**Scale/Scope**: Três funções novas + dois helpers extraídos em `auth.ts`, um schema novo, um arquivo de página reescrito.

## Constitution Check

- **Princípio II** (credenciais/server-side): `createUserWithEmailAndPassword`/`signInWithEmailAndPassword`/`sendPasswordResetEmail` são operações do Firebase Authentication feitas com as credenciais do próprio usuário (a senha que ele acabou de digitar) — inerentemente client-side, mesma categoria de exceção já registrada nas specs 011 (`setPersistence`) e 012 (`updateProfile`): o Firebase Auth em si não segue o padrão "escrita crítica só no servidor" do Firestore, porque não há Firestore envolvido nessas chamadas. A escrita que de fato cria dado persistente (`users/{uid}`) continua exclusivamente via `POST /api/auth/profile`, Admin SDK, inalterado.
- **Princípio III** (manutenibilidade): `createProfile`/`mapAuthError` extraídos como helpers reduzem duplicação entre as quatro funções de autenticação (`loginWithGoogle` existente + três novas) em vez de repetir a mesma chamada `fetch("/api/auth/profile", ...)` e a mesma lógica de tratamento de erro quatro vezes.
- **Princípio IV** (resiliência): todo erro do Firebase Auth passa por `mapAuthError` antes de chegar à UI — nenhum código de erro cru (`auth/...`) é exposto ao usuário; erros não mapeados caem num fallback genérico em vez de quebrar a página.
- **Princípio V** (decisões documentadas): esta spec aplica um padrão já estabelecido (operação de Firebase Auth client-side + endpoint server-side já existente para persistência) a um novo provedor de login — não introduz nenhum padrão arquitetural novo, então não justifica uma ADR nova, mesmo padrão de decisão já tomado nas specs 010/011.
- **Gate**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/013-auth-email-senha/
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
│       └── page.tsx              # reescrito: Google + formulário e-mail/senha + reset
└── lib/
    ├── firebase/
    │   ├── auth.ts                # + registerWithEmail, loginWithEmail, resetPassword, createProfile, mapAuthError
    │   └── auth.test.ts           # novo: testa mapAuthError
    └── schemas/
        ├── authSchema.ts          # novo: email + password (Zod)
        └── authSchema.test.ts     # novo
```

**Structure Decision**: Nenhum diretório novo — segue a organização já existente (`lib/firebase/` para integração com o SDK, `lib/schemas/` para validação, `app/login/` para a página).

## Decisões Técnicas

### 1. `src/lib/schemas/authSchema.ts`

```ts
import * as z from "zod";

export const authSchema = z.object({
  email: z.string().email("Insira um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export type AuthFormValues = z.infer<typeof authSchema>;
```

Limite de 6 caracteres bate com o mínimo que o próprio `createUserWithEmailAndPassword` do Firebase já impõe — validar no client evita uma chamada de rede que o Firebase rejeitaria de qualquer forma (RF-2).

### 2. `src/lib/firebase/auth.ts`

```ts
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

async function applyPersistence(keepSignedIn: boolean) {
  await setPersistence(
    auth,
    keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
  );
}

async function createProfile(idToken: string) {
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    throw new Error("Falha ao preparar o perfil.");
  }
}

export function mapAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/weak-password":
      return "A senha é muito fraca.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/invalid-email":
      return "Insira um e-mail válido.";
    default:
      console.error("Erro de autenticação", error);
      return "Não foi possível concluir a operação.";
  }
}

export async function loginWithGoogle(keepSignedIn: boolean) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await signInWithPopup(auth, provider);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    console.error("Google login failed", error);
    throw new Error("Não foi possível concluir o login com o Google.");
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  keepSignedIn: boolean,
) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
  keepSignedIn: boolean,
) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function logout() {
  await firebaseSignOut(auth);
}
```

`loginWithGoogle` é o único trecho de código já existente tocado — refatorado pra usar `applyPersistence`/`createProfile`, sem mudar seu comportamento observável (mesmo fluxo, mesma ordem de chamadas já validada na spec 011). `mapAuthError` é exportada (ver Decisão 3) especificamente para ser testável sem precisar mockar o Firebase Auth inteiro.

### 3. `src/lib/firebase/auth.test.ts`

Testar `mapAuthError` diretamente exige exportá-la (a versão em Decisão 2 é uma função não exportada). Decisão: exportar `mapAuthError` (nomeada, não default) só para fins de teste — mesmo padrão já usado em `aiService.ts` (`formatItemsForPrompt`/`filterKnownReferences` exportadas especificamente para serem testáveis).

```ts
import { describe, expect, it } from "vitest";
import { mapAuthError } from "./auth";

function errorWithCode(code: string) {
  return { code };
}

describe("mapAuthError", () => {
  it("maps email-already-in-use to a specific message", () => {
    expect(mapAuthError(errorWithCode("auth/email-already-in-use"))).toBe(
      "Este e-mail já está em uso.",
    );
  });

  it("maps wrong-password and user-not-found to the same generic message", () => {
    const wrongPassword = mapAuthError(errorWithCode("auth/wrong-password"));
    const userNotFound = mapAuthError(errorWithCode("auth/user-not-found"));
    expect(wrongPassword).toBe(userNotFound);
    expect(wrongPassword).toBe("E-mail ou senha incorretos.");
  });

  it("maps invalid-credential to the same generic message as wrong-password", () => {
    expect(mapAuthError(errorWithCode("auth/invalid-credential"))).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(mapAuthError(errorWithCode("auth/some-unmapped-code"))).toBe(
      "Não foi possível concluir a operação.",
    );
  });

  it("falls back to a generic message for a non-Firebase error", () => {
    expect(mapAuthError(new Error("network down"))).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});
```

O teste `wrong-password`/`user-not-found` → mesma string é a verificação direta do requisito de segurança RF-6 (nunca revelar qual das duas causas foi o motivo real da falha).

### 4. `src/app/login/page.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { authSchema, type AuthFormValues } from "@/lib/schemas/authSchema";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AuthFormValues>({ resolver: zodResolver(authSchema) });

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(keepSignedIn);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado durante o login.");
    } finally {
      setLoading(false);
    }
  }

  const onSubmitEmail = async (data: AuthFormValues) => {
    setError(null);
    setResetSent(false);
    setLoading(true);
    try {
      if (mode === "login") {
        await loginWithEmail(data.email, data.password, keepSignedIn);
      } else {
        await registerWithEmail(data.email, data.password, keepSignedIn);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  async function handleForgotPassword() {
    setError(null);
    setResetSent(false);
    const parsed = authSchema.shape.email.safeParse(getValues("email"));
    if (!parsed.success) {
      setError("Informe um e-mail válido para redefinir a senha.");
      return;
    }
    setLoading(true);
    try {
      await resetPassword(parsed.data);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-20 text-on-background">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-8 text-on-surface shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">Login</p>
        <h1 className="mt-4 text-3xl font-semibold">Acesse sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          Entre com o Google ou com e-mail e senha.
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
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Aguarde..." : "Entrar com Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase text-on-surface-variant">
          <span className="h-px flex-1 bg-outline-variant" /> ou
          <span className="h-px flex-1 bg-outline-variant" />
        </div>

        <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant">E-mail</label>
            <input
              type="email"
              {...register("email")}
              className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
            />
            {errors.email && (
              <span className="mt-1 block text-sm text-error">{errors.email.message}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">Senha</label>
            <input
              type="password"
              {...register("password")}
              className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
            />
            {errors.password && (
              <span className="mt-1 block text-sm text-error">{errors.password.message}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-primary py-3 font-semibold text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar com e-mail" : "Criar conta"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:opacity-80"
            >
              {mode === "login" ? "Criar conta" : "Já tenho conta"}
            </button>
            {mode === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-primary hover:opacity-80"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </form>

        {resetSent && (
          <p className="mt-4 text-sm text-tertiary">
            Se esse e-mail tiver uma conta, enviamos um link de redefinição.
          </p>
        )}
        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
      </div>
    </main>
  );
}
```

Pontos-chave:
- `mode` alterna só o rótulo do botão e a função chamada (`loginWithEmail` vs `registerWithEmail`) — mesmo formulário, mesma validação (RF-1, RF-5).
- "Esqueci minha senha" só aparece em `mode === "login"` (não faz sentido durante cadastro) e valida o e-mail digitado antes de chamar `resetPassword`, sem exigir senha preenchida (RF-8).
- `resetSent` mostra sempre a mesma mensagem de confirmação, independente do e-mail ter conta ou não — `resetPassword`/`mapAuthError` só lançam erro em casos reais (formato inválido, rate limit), nunca por "e-mail não encontrado" (o Firebase já não distingue isso por padrão) (RF-9).

## Complexity Tracking

Nenhuma violação de constituição identificada.
