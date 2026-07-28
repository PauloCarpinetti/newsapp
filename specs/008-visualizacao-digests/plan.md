# Implementation Plan: Épico 2 (Motor da IA) — Visualização dos Digests Gerados

**Branch**: `008-visualizacao-digests` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-visualizacao-digests/spec.md`

## Summary

`/dashboard` passa a assinar (via `onSnapshot`) o digest mais recente do usuário em `users/{uid}/digests`, renderizando `content.intro`/`content.sections` com `react-markdown` quando `completed`, um skeleton quando `processing`, e mensagens dedicadas para `failed`/vazio. `/history` (novo) lista os digests anteriores com paginação por cursor do Firestore (`startAfter` + `limit`, botão "Carregar mais"). Um componente `DigestMarkdown` compartilhado renderiza o conteúdo em ambas as páginas, e o `AppHeader` ganha um link para `/history`.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router e React 18+ (mesma base das specs 001-007).

**Primary Dependencies**: `firebase` client SDK (leitura via `onSnapshot`/`getDocs`, já usado desde a spec 003 para `/settings`). **Nova**: `react-markdown`, para renderizar o texto gerado pela IA.

**Storage**: Leitura de `users/{uid}/digests` (spec 007) — nenhuma escrita nesta spec, por isso o Princípio II (escritas críticas server-side) não se aplica aqui; leituras já foram sempre feitas pelo client SDK neste projeto.

**Testing**: Sem testes automatizados novos — esta spec é essencialmente UI + assinatura de dados em tempo real, sem lógica pura isolada que justifique testes unitários (diferente de `calculateTargetHourUTC`/`settingsSchema`). Validação manual dos 6 cenários de aceitação do spec, como já praticado nas specs 001/002/004.

**Target Platform**: Web app Next.js, client components (`onSnapshot` e paginação exigem estado no browser).

**Project Type**: Web application full-stack — esta spec é inteiramente client-side/leitura.

**Performance Goals**: `/history` nunca busca mais que uma página (`PAGE_SIZE = 10`) por vez; o listener do dashboard é uma única assinatura (`limit(1)`), não a coleção inteira.

**Constraints**: O listener `onSnapshot` do dashboard MUST ser cancelado (`unsubscribe()`) ao desmontar o componente. `react-markdown` MUST ser usado com a configuração padrão (sem `rehype-raw` ou qualquer plugin que interprete HTML embutido), para não abrir superfície de XSS a partir do texto gerado pela IA.

**Scale/Scope**: Dois componentes novos (`DigestMarkdown`, `DigestSkeleton`), uma página nova (`/history`), reescrita de uma página existente (`/dashboard`), um link novo no `AppHeader`.

## Constitution Check

- Nenhuma escrita crítica nesta spec — apenas leitura, dentro das regras de segurança do Firestore já configuradas (spec 002). Princípio II não é violado.
- `DigestMarkdown` centraliza a lógica de renderização em um único componente reutilizado por `/dashboard` e `/history`, em vez de duplicar a chamada ao `react-markdown` — Princípio III.
- Os quatro estados possíveis (`processing`, `completed`, `failed`, vazio) são tratados explicitamente, sem tela em branco ou erro não tratado — Princípio IV.
- **Gate**: PASS. Nenhuma violação identificada.

## Project Structure

### Documentation (this feature)

```text
specs/008-visualizacao-digests/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── dashboard/
│   │   └── page.tsx              # reescrito: assina o digest mais recente
│   └── history/
│       └── page.tsx              # novo: listagem paginada
└── components/
    ├── AppHeader.tsx              # + link "Histórico"
    └── digests/
        ├── DigestMarkdown.tsx     # novo: wrapper de react-markdown com estilo MD3
        └── DigestSkeleton.tsx     # novo: skeleton loading
```

**Structure Decision**: Componentes específicos de digest ficam em `src/components/digests/`, um subdiretório novo — evita poluir `src/components/` (hoje só `AppHeader`/`ProtectedRoute`/`ThemeToggle`, componentes globais) com peças específicas de uma única feature.

## Decisões Técnicas

### 1. Paginação de `/history`: botão "Carregar mais" com cursor do Firestore

O spec deixou em aberto "paginação simples ou infinite scroll" — opto por um botão explícito ("Carregar mais") em vez de scroll infinito automático (`IntersectionObserver`): mais simples de implementar e testar, sem mudar a essência do requisito (RF-8 só exige carregar em lotes, não especifica o gatilho).

```ts
const PAGE_SIZE = 10;

async function loadPage(cursor: QueryDocumentSnapshot | null) {
  const digestsRef = collection(db, `users/${user.uid}/digests`);
  const q = cursor
    ? query(digestsRef, orderBy("createdAt", "desc"), startAfter(cursor), limit(PAGE_SIZE))
    : query(digestsRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  return { docs: snap.docs, lastDoc: snap.docs.at(-1) ?? cursor, hasMore: snap.docs.length === PAGE_SIZE };
}
```

O botão "Carregar mais" fica desabilitado enquanto uma página está carregando ou quando `hasMore` é `false`.

### 2. `/dashboard`: assinatura em tempo real do digest mais recente

```ts
useEffect(() => {
  if (!user) return;
  const digestsRef = collection(db, `users/${user.uid}/digests`);
  const q = query(digestsRef, orderBy("createdAt", "desc"), limit(1));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    setLatestDigest(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
    setIsLoadingLatest(false);
  });

  return unsubscribe; // RF-6 risco: cancelar o listener ao desmontar
}, [user]);
```

Renderização: `isLoadingLatest || latestDigest?.status === "processing"` → `DigestSkeleton`; `latestDigest === null` (após carregar) → estado vazio (RF-5); `status === "failed"` → mensagem de erro (RF-4); `status === "completed"` → `DigestMarkdown` com `content.intro` e cada `content.sections[].{title,summary}` (RF-3).

### 3. `src/components/digests/DigestMarkdown.tsx`

```tsx
import ReactMarkdown from "react-markdown";

export function DigestMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        p: (props) => <p className="mb-3 leading-relaxed text-on-surface-variant" {...props} />,
        strong: (props) => <strong className="text-on-surface" {...props} />,
        ul: (props) => <ul className="mb-3 list-disc pl-5 text-on-surface-variant" {...props} />,
        li: (props) => <li className="mb-1" {...props} />,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
```

Sem `rehype-raw`/`remark-html` — a configuração padrão do `react-markdown` já não interpreta HTML embutido, o que é o comportamento desejado (risco de XSS documentado no spec).

Uso na dashboard (RF-3): `<DigestMarkdown text={latestDigest.content.intro} />` seguido de um bloco por `content.sections[i]` com `title` como `<h2>` e `<DigestMarkdown text={section.summary} />`.

Uso em `/history` (RF-10, preview): mesmo componente, envolto em um contêiner com `line-clamp-3` (Tailwind) para truncar visualmente o preview sem precisar de uma função separada de corte de string.

### 4. `src/components/digests/DigestSkeleton.tsx`

Placeholder visual com a mesma estrutura de card usada para o digest completo (título, algumas linhas), usando `bg-surface-variant`/`animate-pulse` (utilitário nativo do Tailwind) — sem nova dependência.

### 5. Itens não-`completed` em `/history` (RF-11)

Cada item da lista verifica `status` antes de tentar renderizar `content`: `processing` mostra "Gerando..."; `failed` mostra "Falhou" — nenhum dos dois tenta acessar `content.intro` (que não existe nesses casos).

### 6. `AppHeader` (RF-12)

Adiciona `<Link href="/history">Histórico</Link>` ao grupo de navegação já existente (`Dashboard`, `Configurações`, `Sair`), mesmo padrão visual.

## Complexity Tracking

Nenhuma violação de constituição identificada.
