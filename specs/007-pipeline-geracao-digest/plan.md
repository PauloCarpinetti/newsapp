# Implementation Plan: Épico 2 (Motor da IA) — Pipeline de Geração Automática de Digests

**Branch**: `007-pipeline-geracao-digest` | **Date**: 2026-07-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-pipeline-geracao-digest/spec.md`

## Summary

`GET /api/cron/generate` (protegido por `CRON_SECRET`) seleciona usuários elegíveis por `schedule.targetHourUTC`, e para cada um: verifica idempotência diária, agrega fontes `rss`/`website` em paralelo com `Promise.allSettled` (isolamento de falha por fonte, truncamento por fonte), gera um digest estruturado via `client.beta.chat.completions.parse` da SDK da OpenAI com `zodResponseFormat`, e persiste o resultado em `users/{uid}/digests` via Admin SDK. Falha em um usuário não afeta os demais (`Promise.allSettled` no nível de usuário também).

## Technical Context

**Language/Version**: TypeScript com Next.js App Router (Route Handlers) e Node.js runtime (não Edge — `firebase-admin` e as libs de parsing exigem Node).

**Primary Dependencies**: `openai` (já instalado, v4.104.0 — inclui `openai/helpers/zod` e `client.beta.chat.completions.parse`), `firebase-admin` (já instalado, reaproveita `src/lib/firebase/admin.ts` das specs 005/006), `zod` (já instalado). **Novas**: `rss-parser` (parsing de feeds RSS/Atom) e `cheerio` (extração de texto de HTML, sem navegador headless).

**Storage**: Firestore — leitura de `users` (query por `schedule.targetHourUTC`) e leitura/escrita em `users/{uid}/digests` (nova subcoleção, schema definido no spec).

**Testing**: `scraperService.ts` expõe uma função pura de truncamento (`truncateText`) coberta por `vitest`, seguindo o padrão já usado para `calculateTargetHourUTC`/`settingsSchema`. O pipeline completo (rede real, IA real) é validado manualmente via `curl` com o `CRON_SECRET`, como já praticado nas specs 005/006 — mockar `firebase-admin` e a API da OpenAI para testar a rota inteira teria custo desproporcional para este projeto.

**Target Platform**: Vercel (Route Handler + Vercel Cron Jobs via `vercel.json`). Execução local via `curl` manual — Cron real só dispara em produção.

**Project Type**: Web application full-stack — primeiro uso de um job agendado/processamento em lote do projeto.

**Performance Goals**: Uma execução deve processar todos os usuários elegíveis da hora dentro do `maxDuration` da rota (60s, ajustável conforme o plano Vercel usado). Cada usuário é processado de forma isolada e paralela aos demais.

**Constraints**: Nenhuma chamada de rede (scraping ou IA) pode acontecer sem o segredo do Cron validado primeiro. Nenhuma chamada à IA pode acontecer sem conteúdo agregado. `src/lib/firebase/admin.ts` e o novo client OpenAI só podem ser inicializados de forma preguiçosa (lição já aprendida duas vezes nas specs 001/005 — inicialização eager quebra `next build` sem credenciais reais).

**Scale/Scope**: Uma rota, dois serviços novos (`scraperService`, `aiService`), um schema novo (`digestSchema`), um arquivo de configuração (`vercel.json`).

## Constitution Check

- Toda credencial (`CRON_SECRET`, `OPENAI_API_KEY`, Admin SDK) permanece server-side; a rota valida o segredo antes de qualquer operação — Princípio II.
- Responsabilidades separadas em módulos coesos (`scraperService`, `aiService`, `digestSchema`, camada de dados via `admin.ts`) em vez de uma rota monolítica — Princípio III, e é um requisito explícito do spec.
- Falhas de scraping e de fontes individuais MUST NOT bloquear o restante do pipeline; erros são registrados de forma estruturada (`errorMessage`) sem vazar segredos — Princípio IV, diretamente endereçado pelo RF-9/RF-10/RF-11.
- Consumo de tokens é monitorado (`tokensUsed` persistido) e protegido contra chamadas desnecessárias (RF-12/RF-13) — Princípio IV.
- Esta é uma decisão arquitetural significativa (primeiro job agendado do projeto) — MUST gerar uma ADR após a implementação, registrando o padrão de idempotência e isolamento de falhas adotado (ver ADR 0002 como precedente de formato).
- **Gate**: PASS. Nenhuma violação identificada.

## Project Structure

### Documentation (this feature)

```text
specs/007-pipeline-geracao-digest/
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
│       └── cron/
│           └── generate/
│               └── route.ts        # novo: GET protegido, orquestra o pipeline
└── lib/
    ├── firebase/
    │   └── admin.ts                 # reaproveitado sem mudanças (specs 005/006)
    ├── schemas/
    │   └── digestSchema.ts          # novo: zod schema do conteúdo estruturado
    ├── services/
    │   ├── scraperService.ts        # novo: aggregateSources + truncateText (testável)
    │   └── aiService.ts             # novo: generateDigestWithAI
    └── utils/
        └── time.ts                  # reaproveitado sem mudanças
vercel.json                          # novo: agendamento do Cron Job
```

**Structure Decision**: `src/lib/services/` é um diretório novo, paralelo a `src/lib/schemas/` e `src/lib/utils/` já existentes — cada serviço tem uma única responsabilidade (busca de conteúdo vs. chamada de IA), sem depender um do outro; a rota (`route.ts`) é a única camada que os orquestra em sequência.

## Decisões Técnicas

### 1. Contrato do endpoint

`GET /api/cron/generate`

Header: `Authorization: Bearer <CRON_SECRET>`. Sem corpo — a rota é acionada pelo Vercel Cron (que injeta esse header automaticamente quando `CRON_SECRET` está configurado no projeto) ou manualmente via `curl` em desenvolvimento.

Respostas:
- `200 { processed: number, total: number }` — sucesso (mesmo que alguns usuários individualmente tenham falhado — `processed` conta quantos foram tentados, não quantos tiveram sucesso; o status real de cada um fica no próprio documento `digest`).
- `401 { error: string }` — segredo ausente ou incorreto.
- `500 { error: string }` — falha crítica antes mesmo de iniciar o processamento por usuário (ex.: falha na query inicial ao Firestore).

```ts
export const maxDuration = 60; // segundos — ajustar conforme o plano Vercel em uso
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  // ...
}
```

### 2. Seleção de usuários e idempotência (`route.ts`)

```ts
const db = getAdminDb();
const currentHourUTC = new Date().getUTCHours();

const usersSnapshot = await db
  .collection("users")
  .where("schedule.targetHourUTC", "==", currentHourUTC)
  .get();

const results = await Promise.allSettled(
  usersSnapshot.docs.map((userDoc) => processUser(db, userDoc)),
);
```

`processUser` verifica idempotência (RF-12) buscando o digest mais recente do usuário (`orderBy("createdAt", "desc").limit(1)` — índice de campo único, sem exigir índice composto) e comparando a data (fuso UTC) com hoje; se já existe um digest de hoje com `status` `processing` ou `completed`, retorna sem reprocessar.

```ts
async function processUser(db: Firestore, userDoc: QueryDocumentSnapshot) {
  const digestsRef = db.collection(`users/${userDoc.id}/digests`);

  const latest = await digestsRef.orderBy("createdAt", "desc").limit(1).get();
  if (!latest.empty) {
    const data = latest.docs[0].data();
    const createdAt: Date | undefined = data.createdAt?.toDate?.();
    const isToday = createdAt?.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    if (isToday && data.status !== "failed") return; // RF-12
  }

  const digestRef = digestsRef.doc();
  await digestRef.set({ createdAt: FieldValue.serverTimestamp(), status: "processing", isRead: false });

  try {
    const userData = userDoc.data();
    const rawText = await aggregateSources(userData.config?.sources ?? []);

    if (!rawText.trim()) {
      await digestRef.update({ status: "failed", errorMessage: "Nenhuma fonte retornou conteúdo utilizável." }); // RF-13
      return;
    }

    const { content, tokensUsed } = await generateDigestWithAI(
      rawText,
      userData.config?.topics ?? [],
      userData.config?.promptCustomization ?? null,
      userData.config?.gptModel ?? "gpt-4o-mini",
    );

    await digestRef.update({ status: "completed", content, tokensUsed });
  } catch (error) {
    console.error(`Erro ao processar usuário ${userDoc.id}:`, error);
    await digestRef.update({
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
```

Consultar pelo digest mais recente (em vez de um filtro composto `createdAt >= hoje AND status in [...]`) evita a necessidade de criar um índice composto manualmente no Firestore — relevante para um projeto solo sem pipeline de infraestrutura dedicado.

### 3. `src/lib/services/scraperService.ts`

```ts
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const MAX_CHARS_PER_SOURCE = 3000;
const FETCH_TIMEOUT_MS = 10_000;

type Source = { type: "rss" | "twitter" | "website"; url: string };

export function truncateText(text: string, maxChars: number): string {
  return text.slice(0, maxChars);
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function extractFromRss(url: string): Promise<string> {
  const feed = await new Parser().parseURL(url);
  return feed.items
    .slice(0, 10)
    .map((item) => `${item.title ?? ""}\n${item.contentSnippet ?? item.content ?? ""}`)
    .join("\n\n");
}

async function extractFromWebsite(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  const $ = cheerio.load(await response.text());
  $("script, style, nav, footer, header, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export async function aggregateSources(sources: Source[]): Promise<string> {
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      if (source.type === "twitter") {
        throw new Error("Fontes do tipo twitter ainda não são suportadas.");
      }
      const text =
        source.type === "rss" ? await extractFromRss(source.url) : await extractFromWebsite(source.url);
      return truncateText(text, MAX_CHARS_PER_SOURCE);
    }),
  );

  return settled
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean)
    .join("\n\n---\n\n");
}
```

`Promise.allSettled` (não `Promise.all`) implementa RF-9: uma fonte rejeitada não derruba as demais. Fontes `twitter` sempre rejeitam com uma mensagem clara, tratadas exatamente como qualquer outra falha de fonte — sem caminho especial. `cheerio` remove tags de ruído comum antes de extrair texto; qualidade "boa o suficiente" para o digest, não um extrator de artigo com precisão de leitor.

### 4. `src/lib/schemas/digestSchema.ts`

```ts
import { z } from "zod";

export const digestContentSchema = z.object({
  intro: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
    }),
  ),
});

export type DigestContent = z.infer<typeof digestContentSchema>;
```

### 5. `src/lib/services/aiService.ts`

```ts
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { digestContentSchema, type DigestContent } from "@/lib/schemas/digestSchema";

let client: OpenAI | undefined;
function getOpenAIClient(): OpenAI {
  // Lazy pelo mesmo motivo do Admin SDK (specs 001/005): `new OpenAI()` lança
  // imediatamente se OPENAI_API_KEY não estiver definida, o que quebraria
  // `next build` se instanciado no escopo do módulo.
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export async function generateDigestWithAI(
  rawText: string,
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
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { role: "user", content: rawText },
    ],
    response_format: zodResponseFormat(digestContentSchema, "digest"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("A IA não retornou um digest em formato válido.");
  }

  return { content: parsed, tokensUsed: completion.usage?.total_tokens ?? 0 };
}
```

`zodResponseFormat` + `beta.chat.completions.parse` (SDK 4.104.0, já instalada) garantem RF-6: a resposta é validada contra `digestContentSchema` pela própria SDK — se o modelo não conseguir produzir um JSON conforme, `parsed` vem `undefined` e a função lança, caindo no tratamento de falha (RF-11) em vez de persistir um digest malformado.

### 6. `vercel.json`

```json
{
  "crons": [
    { "path": "/api/cron/generate", "schedule": "0 * * * *" }
  ]
}
```

Dispara a cada hora, no minuto 0. Requer `CRON_SECRET` configurado nas variáveis de ambiente do projeto na Vercel (além de `.env.local` para testes manuais) — a Vercel injeta o header `Authorization: Bearer $CRON_SECRET` automaticamente em chamadas originadas do Cron nativo.

## Complexity Tracking

Nenhuma violação de constituição identificada. A separação em `scraperService`/`aiService`/`digestSchema` é exigida pelo próprio spec (evitar lógica monolítica na rota), não uma complexidade adicional não justificada.
