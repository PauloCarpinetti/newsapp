# Implementation Plan: Página de Perfil do Usuário

**Branch**: `012-perfil-usuario` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/012-perfil-usuario/spec.md`

## Summary

Nova página `src/app/profile/page.tsx` com três blocos: (1) dados básicos (foto/nome/e-mail do Firebase Auth, nome editável via `updateProfile`), (2) três campos de redes sociais persistidos via novo `POST /api/profile`, (3) exclusão de conta via novo `DELETE /api/profile`, atrás de um diálogo de confirmação digitada. Os dois endpoints seguem o mesmo padrão de autenticação já estabelecido (ADR 0002): `Authorization: Bearer <idToken>`, `getAdminAuth().verifyIdToken()`, `uid` do token como única fonte de verdade.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router, React 18+ (mesma base das specs anteriores).

**Primary Dependencies**: `react-hook-form` + `@hookform/resolvers/zod` (já em uso em `/settings`, reaproveitado aqui pelo mesmo padrão de formulário), `firebase/auth` (`updateProfile`, já disponível no SDK já instalado), `firebase-admin` (`deleteUser`, já disponível). **Nenhuma dependência nova.**

**Storage**: Escrita em `users/{uid}` (campo `displayName` sincronizado + novo `profile.socialLinks`) e exclusão de `users/{uid}` + `users/{uid}/digests/*` + a conta no Firebase Authentication — todas via Admin SDK, servidor.

**Testing**: `profileSchema` (Zod) é pura e isolada — ganha teste unitário (`profileSchema.test.ts`), mesmo padrão de `settingsSchema.test.ts`. Sem teste automatizado para os endpoints/página (mesmo padrão de `/settings`/`/api/settings`, que também não têm).

**Target Platform**: Web — `/profile` é client component; os dois endpoints são Route Handlers server-side.

**Project Type**: Extensão full-stack — página nova + dois endpoints novos + schema novo.

**Performance Goals**: N/A.

**Constraints**: A exclusão de conta MUST seguir a ordem digests → documento do usuário → conta no Firebase Authentication, parando em caso de erro em qualquer etapa anterior (RF-9, Riscos do spec). O batch de exclusão de digests usa `WriteBatch` do Admin SDK, limitado a 500 operações — aceito como suficiente para o volume esperado deste projeto (um usuário levaria mais de um ano de digests diários pra ultrapassar esse limite); não há paginação do batch nesta versão.

**Scale/Scope**: Uma página nova, um schema novo, um arquivo de rota novo (`POST`/`DELETE` no mesmo `route.ts`), um componente de confirmação de exclusão, um link novo no `AppHeader`.

## Constitution Check

- **Princípio I** (modelagem NoSQL orientada à leitura): `profile.socialLinks` fica aninhado dentro do mesmo documento `users/{uid}` já lido a cada carregamento de página autenticada — nenhuma consulta nova, nenhuma subcoleção nova.
- **Princípio II** (credenciais/server-side): os dois novos endpoints seguem exatamente o padrão já estabelecido (ADR 0002) — verificação de ID token, `uid` do token decodificado como única fonte de verdade para o caminho do documento, nenhuma escrita cross-user possível. `firestore.rules` já nega qualquer escrita direta do client, então essa é a única forma de persistir os dados desta spec.
- **Princípio III** (manutenibilidade): o padrão de verificação de auth é duplicado (não abstraído) no novo `route.ts`, deliberadamente — mesmo padrão intencional já registrado na ADR 0002 ("o mesmo contrato aplicado duas vezes", agora uma terceira).
- **Princípio IV** (resiliência): a ordem de exclusão (digests → doc do usuário → conta Auth) é uma decisão de resiliência explícita — nenhuma etapa prossegue se a anterior falhar, evitando o pior cenário (dados órfãos sem dono recuperável).
- **Princípio V** (decisões documentadas): a exclusão de conta é a primeira operação destrutiva e irreversível do projeto — introduz um padrão novo (ordem de exclusão em cascata sem suporte nativo do Firestore) que MUST gerar uma ADR após a implementação, documentando a ordem escolhida e por quê.
- **Gate**: PASS. ADR agendada para depois da implementação, não pendente sem plano.

## Project Structure

### Documentation (this feature)

```text
specs/012-perfil-usuario/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── profile/
│   │   └── page.tsx              # novo: dados básicos + redes sociais + exclusão
│   └── api/
│       └── profile/
│           └── route.ts          # novo: POST (atualizar) + DELETE (excluir conta)
├── components/
│   ├── AppHeader.tsx              # + link "Perfil"
│   └── profile/
│       └── DeleteAccountDialog.tsx  # novo: confirmação digitada + chamada ao DELETE
└── lib/
    └── schemas/
        ├── profileSchema.ts       # novo: displayName + socialLinks (Zod)
        └── profileSchema.test.ts  # novo: testes da validação
```

**Structure Decision**: Segue a mesma organização de `/settings`/`/api/settings` (página + rota + schema). Um componente dedicado (`DeleteAccountDialog`) isola a lógica de confirmação/exclusão do resto da página — mistura de "editar perfil" e "apagar tudo permanentemente" no mesmo componente aumentaria o risco de um bug num afetar o outro.

## Decisões Técnicas

### 1. `src/lib/schemas/profileSchema.ts`

```ts
import * as z from "zod";

const socialUrl = z
  .string()
  .url("Insira uma URL válida")
  .optional()
  .or(z.literal(""));

export const profileSchema = z.object({
  displayName: z
    .string()
    .min(1, "Informe um nome.")
    .max(100, "Máximo de 100 caracteres."),
  socialLinks: z.object({
    twitter: socialUrl,
    instagram: socialUrl,
    linkedin: socialUrl,
  }),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
```

`.optional().or(z.literal(""))` permite campo vazio (não preenchido) sem falhar a validação de URL — mesmo problema que `settingsSchema` não tem porque suas URLs são obrigatórias; aqui são opcionais, por isso o tratamento extra (RF-5: vazio é aceito, preenchido precisa ser válido).

### 2. `src/app/api/profile/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { profileSchema } from "@/lib/schemas/profileSchema";

async function verifyRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  if (!idToken) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (error) {
    console.error("Falha ao verificar o token de autenticação", error);
    const code = (error as { code?: string })?.code;
    if (code?.startsWith("app/")) {
      return { error: NextResponse.json({ error: "Erro de configuração do servidor." }, { status: 500 }) };
    }
    return { error: NextResponse.json({ error: "Token inválido." }, { status: 401 }) };
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parseResult = profileSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { displayName, socialLinks } = parseResult.data;

  try {
    await getAdminDb().doc(`users/${auth.uid}`).update({
      displayName,
      "profile.socialLinks": {
        twitter: socialLinks.twitter || null,
        instagram: socialLinks.instagram || null,
        linkedin: socialLinks.linkedin || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar o perfil", error);
    return NextResponse.json({ error: "Não foi possível salvar o perfil." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (auth.error) return auth.error;

  try {
    const db = getAdminDb();
    const digestsSnapshot = await db.collection(`users/${auth.uid}/digests`).get();

    const batch = db.batch();
    digestsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.doc(`users/${auth.uid}`));
    await batch.commit();

    await getAdminAuth().deleteUser(auth.uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir a conta", error);
    return NextResponse.json({ error: "Não foi possível excluir a conta." }, { status: 500 });
  }
}
```

`verifyRequest` é extraído como função local ao arquivo (não um módulo compartilhado entre rotas) — reduz a duplicação *dentro deste único arquivo* (que agora tem dois handlers, `POST` e `DELETE`, ambos precisando do mesmo passo) sem contradizer a decisão da ADR 0002 de duplicar o padrão *entre arquivos* de rota diferentes.

A ordem dentro de `DELETE` implementa RF-9/Riscos diretamente: o `batch.commit()` (digests + doc do usuário) só é seguido por `deleteUser` se não lançar exceção; se `batch.commit()` falhar, o `catch` externo captura e retorna erro antes de qualquer tentativa de apagar a conta no Firebase Authentication.

### 3. `src/components/profile/DeleteAccountDialog.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const CONFIRMATION_WORD = "EXCLUIR";

export function DeleteAccountDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!user) return;
    setIsDeleting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir a conta.");
      }

      await logout();
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível excluir a conta.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-error p-6">
      <h2 className="text-lg font-semibold text-error">Zona de risco</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Excluir sua conta apaga permanentemente seu perfil, preferências e todo o
        histórico de digests. Esta ação não pode ser desfeita.
      </p>

      <label className="mt-4 block text-sm font-medium text-on-surface-variant">
        Digite {CONFIRMATION_WORD} para confirmar
      </label>
      <input
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background"
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={confirmText !== CONFIRMATION_WORD || isDeleting}
        className="mt-4 w-full rounded-xl bg-error py-3 font-semibold text-on-error transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? "Excluindo..." : "Excluir conta permanentemente"}
      </button>

      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
```

`disabled={confirmText !== CONFIRMATION_WORD || isDeleting}` implementa RF-8 diretamente — sem comparação exata, o botão nunca habilita. `logout()` + `router.replace("/")` depois de uma resposta `ok` implementa RF-10; se `logout()` falhar por algum motivo (usuário já não existe mais no Auth), o `catch` externo não captura isso já que está fora do `try` — aceito porque nesse ponto os dados já foram apagados com sucesso, o pior caso é o `router.replace` não rodar e o usuário precisar navegar manualmente, não uma falha de dados.

### 4. `src/app/profile/page.tsx`

Estrutura (sem repetir todo o JSX): `ProtectedRoute` + `AppHeader`, formulário `react-hook-form` com `zodResolver(profileSchema)`, valores iniciais carregados de `user.displayName`/`user.email`/`user.photoURL` (Firebase Auth) e de `users/{uid}.profile.socialLinks` (Firestore, via `getDoc`, mesmo padrão de leitura já usado em `/settings`). No submit:

```ts
async function onSubmit(data: ProfileFormValues) {
  if (!user) return;
  setIsSaving(true);

  try {
    await updateProfile(user, { displayName: data.displayName });

    const idToken = await user.getIdToken();
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error("Falha ao salvar o perfil.");

    setFeedback({ type: "success", message: "Perfil atualizado com sucesso!" });
  } catch (error) {
    setFeedback({ type: "error", message: "Não foi possível salvar o perfil." });
  } finally {
    setIsSaving(false);
  }
}
```

`updateProfile(user, {...})` roda primeiro — é a chamada que faz `AppHeader`/`dashboard` refletirem o novo nome imediatamente (RF-2), já que ambos leem `user.displayName` de `useAuth()`, que por sua vez vem de `onAuthStateChanged`. `<img src={user.photoURL} />` simples (sem `next/image`) para a foto — este projeto não usa `next/image` em nenhum outro lugar nem tem `next.config.js` configurado com domínios de imagem remota; introduzir isso só para uma foto de perfil pequena não se justifica.

`<DeleteAccountDialog />` renderizado no final da página, visualmente separado do formulário de edição (RF-7 — border vermelha, título "Zona de risco").

### 5. `AppHeader.tsx`

Adiciona `<Link href="/profile">Perfil</Link>` ao grupo de navegação já existente.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| Nenhuma | — | — |
