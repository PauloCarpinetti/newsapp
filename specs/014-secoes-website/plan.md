# Implementation Plan: Seções Reais e Validação de Fontes Website

**Branch**: `014-secoes-website` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-secoes-website/spec.md`

## Summary

`extractFromWebsite` (`scraperService.ts`) ganha duas funções puras novas — `looksLikeContentSite` (valida metadados do `<head>`) e `extractSectionLinks` (descobre até 3 URLs de seção a partir da navegação) — mais uma função de busca isolada por seção (`fetchSection`). A função principal passa a: validar a página, descobrir seções, buscar cada uma isoladamente (`Promise.allSettled`, mesmo padrão da ADR 0004 aplicado um nível mais fundo), e retornar `[itemDaHome, ...itensDeSeção]` em vez de um único item.

## Technical Context

**Language/Version**: TypeScript, mesma base do resto do pipeline (specs 007/009).

**Primary Dependencies**: `cheerio` (já em uso) — suficiente para parsear `<head>` e links de `<nav>`/`<header>`. **Nenhuma dependência nova.**

**Storage**: Nenhuma — mudança inteiramente na camada de agregação (`scraperService.ts`), antes de qualquer persistência. `AggregatedItem` (spec 009) não muda de forma, só de cardinalidade.

**Testing**: `looksLikeContentSite` e `extractSectionLinks` são puras (recebem um `$` já carregado de uma string HTML fixa, sem rede) — ganham testes em `scraperService.test.ts`, mesmo padrão de `truncateText`. `fetchSection`/`extractFromWebsite` fazem I/O de rede — não ganham teste unitário, mesmo padrão já estabelecido para `extractFromRss`/`extractFromWebsite` desde a spec 007 (só funções puras são testadas neste projeto).

**Target Platform**: Server — `scraperService.ts` só roda dentro do Cron Job (`/api/cron/generate`), nunca no client.

**Project Type**: Extensão pontual de um módulo já existente.

**Performance Goals**: Até 3 requisições HTTP adicionais por fonte `website` (uma por seção descoberta), em paralelo entre si via `Promise.allSettled`, cada uma sujeita ao mesmo `FETCH_TIMEOUT_MS` (10s) já usado pela home.

**Constraints**: Uma falha ao buscar uma seção específica MUST NOT propagar e derrubar a fonte inteira — `fetchSection` isolada via `Promise.allSettled`, mesmo padrão de `aggregateSources` (nível de fonte) e `extractFromRss`'s cap de itens, agora reaplicado num terceiro nível (seções dentro de uma fonte `website`).

**Scale/Scope**: Duas funções puras novas + uma função de busca isolada + reescrita de `extractFromWebsite` — tudo no mesmo arquivo já existente.

## Constitution Check

- **Princípio III** (manutenibilidade): `looksLikeContentSite` e `extractSectionLinks` extraídas como funções puras e nomeadas, testáveis isoladamente, em vez de lógica inline dentro de `extractFromWebsite` — mesmo padrão já usado para `formatItemsForPrompt`/`filterKnownReferences` na spec 009.
- **Princípio IV** (resiliência): isolamento de falha por seção (`Promise.allSettled` dentro de `extractFromWebsite`) é uma reaplicação direta do padrão que a própria ADR 0004 já registrou como "modelo a seguir para qualquer processamento em lote futuro" — não um padrão novo. A validação de metadados (RF-1) também é resiliência: rejeita cedo uma fonte inútil antes de gastar uma chamada de IA nela.
- **Princípio V** (decisões documentadas): como a spec já registra em "Assunções", isto reaplica um padrão arquitetural já documentado (ADR 0004), não introduz um novo — **não é esperado que gere uma ADR nova**. Se a implementação revelar alguma nuance genuinamente nova (ex.: um trade-off não previsto na heurística de seções), reavaliar nesse momento.
- **Gate**: PASS. Nenhuma violação, nenhuma ADR nova esperada.

## Project Structure

### Documentation (this feature)

```text
specs/014-secoes-website/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
└── lib/
    └── services/
        ├── scraperService.ts       # extractFromWebsite reescrita; + looksLikeContentSite, extractSectionLinks, fetchSection
        └── scraperService.test.ts  # + testes de looksLikeContentSite e extractSectionLinks
```

**Structure Decision**: Nenhum arquivo novo — tudo contido no módulo que já existe desde a spec 007.

## Decisões Técnicas

### 1. `looksLikeContentSite($): boolean`

```ts
function looksLikeContentSite($: ReturnType<typeof cheerio.load>): boolean {
  const hasTitle = $("head title").text().trim().length > 0;
  if (!hasTitle) return false;

  const hasDescription = Boolean($('head meta[name="description"]').attr("content"));
  const hasOpenGraph = $('head meta[property^="og:"]').length > 0;
  const hasJsonLd = $('head script[type="application/ld+json"]').length > 0;

  return hasDescription || hasOpenGraph || hasJsonLd;
}
```

Heurística deliberadamente leniente: exige `<title>` **e** ao menos um sinal adicional (descrição, Open Graph ou JSON-LD) — qualquer site de conteúdo minimamente bem construído passa; uma página em branco, quebrada ou estacionada normalmente falha em pelo menos um dos dois critérios (RF-1).

### 2. `extractSectionLinks($, baseUrl): string[]`

```ts
const MAX_SECTIONS = 3;
const BLOCKED_SECTION_KEYWORDS = [
  "login", "cadastro", "assinatura", "assine",
  "contato", "termos", "privacidade", "sobre", "busca", "newsletter",
];

function extractSectionLinks(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string,
): string[] {
  const base = new URL(baseUrl);
  const candidates = new Set<string>();

  $("nav a[href], header a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }

    if (resolved.hostname !== base.hostname) return;
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;

    const path = resolved.pathname.replace(/\/+$/, "");
    if (!path) return; // é a própria home

    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0 || segments.length > 2) return; // provavelmente um artigo, não uma seção

    const lowerPath = path.toLowerCase();
    if (BLOCKED_SECTION_KEYWORDS.some((word) => lowerPath.includes(word))) return;

    resolved.hash = "";
    resolved.search = "";
    candidates.add(resolved.toString());
  });

  return Array.from(candidates).slice(0, MAX_SECTIONS);
}
```

Filtros, em ordem: mesmo domínio (RF-3, exclui domínios externos), esquema http(s) (ignora `mailto:`/`javascript:`/etc.), exclui a própria raiz, caminho raso (1-2 segmentos — heurística para "seção", não "artigo específico", já que URLs de notícia individuais tipicamente têm caminhos mais longos, com data/slug), lista de bloqueio de páginas não-editoriais. `Set` garante deduplicação; `.slice(0, MAX_SECTIONS)` aplica o teto de 3 confirmado com o usuário.

### 3. `fetchSection(url): Promise<AggregatedItem>`

```ts
const MAX_CHARS_PER_SECTION = 1000;

async function fetchSection(url: string): Promise<AggregatedItem> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar seção ${url}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { text: truncateText(text, MAX_CHARS_PER_SECTION), url };
}
```

`MAX_CHARS_PER_SECTION` (1000) é menor que `MAX_CHARS_PER_SOURCE` (3000, usado só pela home) — com até 4 itens por fonte `website` agora (home + 3 seções), um orçamento menor por seção mantém o tamanho total do prompt sob controle sem crescer proporcionalmente ao número de seções descobertas.

### 4. `extractFromWebsite` reescrita

```ts
async function extractFromWebsite(url: string): Promise<AggregatedItem[]> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  if (!looksLikeContentSite($)) {
    throw new Error(
      `${url} não parece ser um site de conteúdo válido (sem metadados de SEO).`,
    );
  }

  const sectionUrls = extractSectionLinks($, url);

  $("script, style, nav, footer, header, noscript").remove();
  const homeText = $("body").text().replace(/\s+/g, " ").trim();
  const homeItem: AggregatedItem = {
    text: truncateText(homeText, MAX_CHARS_PER_SOURCE),
    url,
  };

  const sectionResults = await Promise.allSettled(sectionUrls.map(fetchSection));
  sectionResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `Falha ao agregar seção ${sectionUrls[index]}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });

  const sectionItems = sectionResults
    .filter(
      (result): result is PromiseFulfilledResult<AggregatedItem> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);

  return [homeItem, ...sectionItems];
}
```

Pontos-chave:
- Falha de validação (RF-1) lança um `Error` normal — capturado pelo `Promise.allSettled` já existente em `aggregateSources` (nível de fonte), sem precisar de nenhuma mudança ali (RF-2).
- Descoberta de seções roda sobre o `$` **antes** de remover `nav`/`header` do DOM (a extração de links depende exatamente dos elementos que a extração de texto da home remove em seguida).
- Falha em uma seção individual é isolada via `Promise.allSettled` + `console.warn`, mesmo padrão de `aggregateSources` (RF-4).
- Item da home sempre incluído primeiro, independente de quantas seções (0 a 3) forem encontradas/bem-sucedidas (RF-6).
- Nenhuma mudança em `aggregateSources` nem em `filterKnownReferences` — o conjunto de URLs conhecidas simplesmente cresce (home + seções), a garantia de "nunca citar URL fora do conjunto" (RF-7) continua a mesma lógica já validada na spec 009.

## Complexity Tracking

Nenhuma violação de constituição identificada.
