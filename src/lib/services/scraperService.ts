import Parser from "rss-parser";
import * as cheerio from "cheerio";

// RSS: orçamento por item pensado pra manter o total por fonte equivalente ao
// antigo MAX_CHARS_PER_SOURCE (3000) distribuído pelos até 10 itens buscados.
const MAX_CHARS_PER_ITEM = 300;
const MAX_CHARS_PER_SOURCE = 3000;
const MAX_CHARS_PER_SECTION = 1000;
const MAX_SECTIONS = 3;
const FETCH_TIMEOUT_MS = 10_000;

const BLOCKED_SECTION_KEYWORDS = [
  "login",
  "cadastro",
  "assinatura",
  "assine",
  "contato",
  "termos",
  "privacidade",
  "sobre",
  "busca",
  "newsletter",
];

export type Source = {
  type: "rss" | "twitter" | "website";
  url: string;
};

export type AggregatedItem = {
  text: string;
  url: string | null;
};

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

async function extractFromRss(url: string): Promise<AggregatedItem[]> {
  const feed = await new Parser().parseURL(url);
  return feed.items.slice(0, 10).map((item) => ({
    text: truncateText(
      `${item.title ?? ""}\n${item.contentSnippet ?? item.content ?? ""}`,
      MAX_CHARS_PER_ITEM,
    ),
    url: item.link ?? null,
  }));
}

export function looksLikeContentSite(
  $: ReturnType<typeof cheerio.load>,
): boolean {
  const hasTitle = $("head title").text().trim().length > 0;
  if (!hasTitle) return false;

  const hasDescription = Boolean(
    $('head meta[name="description"]').attr("content"),
  );
  const hasOpenGraph = $('head meta[property^="og:"]').length > 0;
  const hasJsonLd = $('head script[type="application/ld+json"]').length > 0;

  return hasDescription || hasOpenGraph || hasJsonLd;
}

export function extractSectionLinks(
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
    if (!path) return;

    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0 || segments.length > 2) return;

    const lowerPath = path.toLowerCase();
    if (BLOCKED_SECTION_KEYWORDS.some((word) => lowerPath.includes(word))) {
      return;
    }

    resolved.hash = "";
    resolved.search = "";
    candidates.add(resolved.toString());
  });

  return Array.from(candidates).slice(0, MAX_SECTIONS);
}

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

export async function aggregateSources(sources: Source[]): Promise<AggregatedItem[]> {
  const settled = await Promise.allSettled(
    sources.map((source) => {
      if (source.type === "twitter") {
        throw new Error("Fontes do tipo twitter ainda não são suportadas.");
      }
      return source.type === "rss"
        ? extractFromRss(source.url)
        : extractFromWebsite(source.url);
    }),
  );

  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(
        `Falha ao agregar fonte ${sources[index]?.url}:`,
        result.reason instanceof Error ? result.reason.message : result.reason,
      );
    }
  });

  return settled
    .filter(
      (result): result is PromiseFulfilledResult<AggregatedItem[]> =>
        result.status === "fulfilled",
    )
    .flatMap((result) => result.value)
    .filter((item) => item.text.length > 0);
}
