# Implementation Plan: Resumos Detalhados e Referências por Tópico

**Branch**: `009-referencias-por-topico` | **Date**: 2026-07-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/009-referencias-por-topico/spec.md`

## Summary

`scraperService.aggregateSources` deixa de retornar uma única string concatenada e passa a retornar `AggregatedItem[]` (`{ text, url }`), preservando a URL de origem de cada item (RSS: uma por notícia via `item.link`; website: uma por fonte, a URL cadastrada). `aiService.generateDigestWithAI` formata esses itens numa lista numerada com URL explícita por item, pede resumos mais detalhados e instrui a IA a citar até 3 URLs por seção **somente** entre as fornecidas — e, como defesa adicional contra alucinação (não confiar só na instrução do prompt), um filtro server-side (`filterKnownReferences`) remove qualquer URL retornada que não esteja literalmente entre as URLs conhecidas antes de persistir o digest. `digestSchema` ganha `sections[].references: string[]`. Na UI, um novo componente `DigestReferences` (caixa `<details>/<summary>` nativa, fechada por padrão, fundo `bg-surface-variant`) é renderizado por seção em `/dashboard` — `/history` não precisa de mudança, pois já só mostra um preview do `intro`, sem detalhar seções.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router e React 18+ (mesma base das specs 001-008).

**Primary Dependencies**: `openai` (Structured Outputs via `zodResponseFormat`, já em uso desde a spec 007), `rss-parser`/`cheerio` (já em uso no `scraperService`). **Nenhuma dependência nova** — a caixa colapsável usa `<details>/<summary>` nativo do HTML.

**Storage**: Escrita em `users/{uid}/digests/{digestId}.content.sections[].references` (extensão do documento já escrito pela spec 007, mesmo caminho de escrita via Admin SDK no Cron). Nenhuma mudança nas regras de segurança (`firestore.rules`) — é só mais um campo dentro de `content`, já coberto pela regra de leitura existente.

**Testing**: `vitest`, seguindo a convenção já estabelecida no projeto (só funções puras/isoladas ganham teste unitário — não páginas/componentes, não código que faz I/O real). Duas funções novas e puras em `aiService.ts` (`formatItemsForPrompt`, `filterKnownReferences`) ganham `aiService.test.ts`. `scraperService.test.ts` não muda — `truncateText` continua com a mesma assinatura.

**Target Platform**: Web app Next.js — mudança abrange o Cron Job (server, Node runtime) e a página `/dashboard` (client component).

**Project Type**: Web application full-stack — pipeline de geração (server) + exibição (client), mesma divisão das specs 007/008.

**Performance Goals**: Sem mudança de perfil de performance perceptível — o volume de texto enviado à IA por fonte permanece no mesmo orçamento de caracteres de hoje (ver Decisão Técnica 1), só redistribuído para preservar URL por item.

**Constraints**: A IA MUST NUNCA ter uma URL alucinada persistida — isso é garantido por dois mecanismos independentes (prompt + filtro server-side), não só pela instrução ao modelo. O componente de referências MUST tratar `references` ausente (digest antigo) como lista vazia, sem quebrar a renderização.

**Scale/Scope**: Um componente novo (`DigestReferences`), duas funções puras novas (`formatItemsForPrompt`, `filterKnownReferences`), mudança de assinatura em duas funções existentes (`aggregateSources`, `generateDigestWithAI`), um campo novo no schema, um ponto de renderização a mais em `/dashboard`.

## Constitution Check

- **Princípio II** (credenciais/server-side): sem mudança — a chamada à OpenAI continua exclusivamente no Cron Job (Admin SDK/server), nenhum novo segredo introduzido.
- **Princípio III** (manutenibilidade): `AggregatedItem`, `formatItemsForPrompt` e `filterKnownReferences` são extraídos como funções pequenas e nomeadas com responsabilidade única, em vez de inflar `generateDigestWithAI` com lógica inline; `DigestReferences` é um componente dedicado, não uma ramificação condicional dentro de `DigestMarkdown`.
- **Princípio IV** (resiliência): `filterKnownReferences` é a aplicação direta deste princípio — o valor retornado pela IA não é confiado cegamente antes de persistir; e a UI trata `references` ausente/vazio como estado normal (RF-9), não como erro, preservando compatibilidade com digests gerados antes desta spec.
- **Princípio V** (decisões documentadas): esta spec introduz um padrão arquitetural novo — agregação estruturada com atribuição de URL por item, citação restrita pela IA, e validação defensiva server-side contra alucinação de referências. Isso conta como decisão arquitetural significativa — **MUST gerar uma ADR 0007** após a implementação, documentando o padrão (mesmo formato das ADRs 0004/0006).
- **Gate**: PASS. Nenhuma violação identificada; a exigência de ADR (Princípio V) fica agendada, não pendente sem plano.

## Project Structure

### Documentation (this feature)

```text
specs/009-referencias-por-topico/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── lib/
│   ├── schemas/
│   │   └── digestSchema.ts         # + sections[].references: string[]
│   └── services/
│       ├── scraperService.ts       # aggregateSources agora retorna AggregatedItem[]
│       ├── scraperService.test.ts  # sem mudança (truncateText inalterado)
│       ├── aiService.ts            # + formatItemsForPrompt, filterKnownReferences; prompt atualizado
│       └── aiService.test.ts       # novo: testa as duas funções puras acima
├── app/
│   ├── api/cron/generate/route.ts  # ajuste de tipos: AggregatedItem[] em vez de string
│   └── dashboard/page.tsx          # + <DigestReferences /> por seção
└── components/
    └── digests/
        └── DigestReferences.tsx    # novo: caixa colapsável de referências
```

**Structure Decision**: Segue a mesma organização já estabelecida — lógica de pipeline em `src/lib/services/`, schema em `src/lib/schemas/`, componentes de exibição de digest em `src/components/digests/` (criado na spec 008). Nenhum diretório novo.

## Decisões Técnicas

### 1. `AggregatedItem` e orçamento de caracteres por item

Hoje `MAX_CHARS_PER_SOURCE = 3000` é aplicado ao texto inteiro de uma fonte (até 10 itens de RSS concatenados, ou a página inteira de um website). Preservar URL por item exige parar de concatenar tudo numa string só — mas sem perder o controle de custo/tamanho do prompt que esse limite já garantia.

```ts
export type AggregatedItem = { text: string; url: string | null };

const MAX_CHARS_PER_ITEM = 300;   // RSS: ~ o mesmo orçamento médio de hoje (3000 / até 10 itens)
const MAX_CHARS_PER_SOURCE = 3000; // website: item único por fonte, orçamento inalterado

async function extractFromRss(url: string): Promise<AggregatedItem[]> {
  const feed = await new Parser().parseURL(url);
  return feed.items.slice(0, 10).map((item) => ({
    text: truncateText(`${item.title ?? ""}\n${item.contentSnippet ?? item.content ?? ""}`, MAX_CHARS_PER_ITEM),
    url: item.link ?? null,
  }));
}

async function extractFromWebsite(url: string): Promise<AggregatedItem[]> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return [{ text: truncateText(text, MAX_CHARS_PER_SOURCE), url }];
}

export async function aggregateSources(sources: Source[]): Promise<AggregatedItem[]> {
  const settled = await Promise.allSettled(
    sources.map((source) => {
      if (source.type === "twitter") {
        throw new Error("Fontes do tipo twitter ainda não são suportadas.");
      }
      return source.type === "rss" ? extractFromRss(source.url) : extractFromWebsite(source.url);
    }),
  );

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`Falha ao agregar fonte ${sources[index]?.url}:`, result.reason instanceof Error ? result.reason.message : result.reason);
    }
  });

  return settled
    .filter((r): r is PromiseFulfilledResult<AggregatedItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter((item) => item.text.length > 0);
}
```

O isolamento de falhas por fonte (`Promise.allSettled`, ADR 0004) é preservado sem alteração — só o formato do valor resolvido muda de `string` para `AggregatedItem[]`.

### 2. `aiService.ts`: prompt com URLs candidatas + filtro defensivo

```ts
import { digestContentSchema, type DigestContent } from "@/lib/schemas/digestSchema";
import type { AggregatedItem } from "./scraperService";

export function formatItemsForPrompt(items: AggregatedItem[]): string {
  return items
    .map((item, index) => {
      const urlLine = item.url ? `URL: ${item.url}` : "URL: (indisponível)";
      return `[Fonte ${index + 1}]\n${urlLine}\n${item.text}`;
    })
    .join("\n\n---\n\n");
}

export function filterKnownReferences(references: string[], knownUrls: Set<string>): string[] {
  return references.filter((url) => knownUrls.has(url)).slice(0, 3);
}

export async function generateDigestWithAI(
  items: AggregatedItem[],
  topics: string[],
  promptCustomization: string | null,
  model: string,
): Promise<{ content: DigestContent; tokensUsed: number }> {
  const completion = await getOpenAIClient().beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "system",
        content: [
          "Você resume notícias e conteúdo de fontes diversas em um digest diário, em português.",
          `Tópicos de interesse do usuário: ${topics.join(", ") || "gerais"}.`,
          promptCustomization ? `Instruções adicionais do usuário: ${promptCustomization}` : "",
          "Gere uma introdução curta e seções organizadas por tópico, baseadas apenas no conteúdo fornecido.",
          "Cada resumo de seção deve ser mais detalhado que um único parágrafo curto — cubra os principais pontos do conteúdo agregado daquele tópico, sempre fiel ao que foi fornecido, nunca inventando fatos.",
          "Cada seção pode incluir até 3 URLs em 'references'. Uma URL só pode ser citada se aparecer literalmente em uma linha 'URL: ...' do conteúdo fornecido — nunca invente, adivinhe ou modifique uma URL. Se nenhuma fonte relevante tiver URL, deixe 'references' como lista vazia.",
        ].filter(Boolean).join("\n"),
      },
      { role: "user", content: formatItemsForPrompt(items) },
    ],
    response_format: zodResponseFormat(digestContentSchema, "digest"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) throw new Error("A IA não retornou um digest em formato válido.");

  const knownUrls = new Set(items.map((item) => item.url).filter((url): url is string => Boolean(url)));
  const content: DigestContent = {
    ...parsed,
    sections: parsed.sections.map((section) => ({
      ...section,
      references: filterKnownReferences(section.references, knownUrls),
    })),
  };

  return { content, tokensUsed: completion.usage?.total_tokens ?? 0 };
}
```

`filterKnownReferences` é a mitigação concreta do risco "IA cita URL alucinada" (spec, Riscos e Mitigações) — mesmo que o modelo ignore a instrução do prompt, nenhuma URL fora do conjunto real chega a ser persistida. RF-3 fica garantido por código, não só por instrução em linguagem natural.

### 3. `digestSchema.ts`

```ts
export const digestContentSchema = z.object({
  intro: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      references: z.array(z.string()).max(3),
    }),
  ),
});
```

`references` fica `string` simples (sem `.url()`) — a validade da URL já é garantida por construção (só pode vir do conjunto de URLs reais das fontes, filtrado em `filterKnownReferences`), evitando depender de suporte a `format: "uri"` no modo strict do Structured Outputs da OpenAI.

### 4. `route.ts` (`/api/cron/generate`)

Ajuste mínimo de tipos — comportamento de idempotência/isolamento (ADR 0004) inalterado:

```ts
const items = await aggregateSources(sources);

if (items.length === 0) {
  await digestRef.update({ status: "failed", errorMessage: "Nenhuma fonte retornou conteúdo utilizável." });
  return;
}

const { content, tokensUsed } = await generateDigestWithAI(
  items,
  userData.config?.topics ?? [],
  userData.config?.promptCustomization ?? null,
  userData.config?.gptModel ?? "gpt-4o-mini",
);
```

### 5. `src/components/digests/DigestReferences.tsx`

```tsx
export function DigestReferences({ references }: { references: string[] }) {
  if (references.length === 0) return null;

  return (
    <details className="mt-2 rounded-xl bg-surface-variant text-on-surface-variant">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">
        Referências ({references.length})
      </summary>
      <ul className="space-y-1 px-3 pb-3 text-sm">
        {references.map((url) => (
          <li key={url} className="break-all">
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:opacity-80">
              {url}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

`bg-surface-variant`/`text-on-surface-variant` é o mesmo par de tokens MD3 já usado pelo `DigestSkeleton` (spec 008) para diferenciar uma superfície do `bg-surface` do card sem sair do sistema de cores — satisfaz RF-7 sem decisão de cor nova. `<details>` fechado por padrão (sem atributo `open`) satisfaz RF-6 nativamente, sem estado React nem dependência nova.

### 6. `dashboard/page.tsx`: uso do novo componente

```tsx
{latestDigest.content?.sections.map((section, index) => (
  <div key={index} className="mt-4">
    <h3 className="text-base font-semibold text-on-surface">{section.title}</h3>
    <div className="mt-1">
      <DigestMarkdown text={section.summary} />
    </div>
    <DigestReferences references={section.references ?? []} />
  </div>
))}
```

`section.references ?? []` cobre o Cenário 5 do spec (digest antigo sem o campo) — `DigestReferences` já retorna `null` para lista vazia, então nada extra precisa ser feito para RF-9.

### 7. `/history` não precisa de mudança

A listagem em `/history` já só renderiza um preview de `content.intro` (`line-clamp-3`, spec 008/RF-10) — nunca detalha `sections[]` individualmente. Como as referências são por seção, não há onde encaixá-las ali sem redesenhar o preview, o que está fora do escopo desta spec.

## Complexity Tracking

Nenhuma violação de constituição identificada.
