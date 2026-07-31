import Parser from "rss-parser";
import * as cheerio from "cheerio";

// RSS: orçamento por item pensado pra manter o total por fonte equivalente ao
// antigo MAX_CHARS_PER_SOURCE (3000) distribuído pelos até 10 itens buscados.
const MAX_CHARS_PER_ITEM = 300;
const MAX_CHARS_PER_SOURCE = 3000;
const FETCH_TIMEOUT_MS = 10_000;

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

async function extractFromWebsite(url: string): Promise<AggregatedItem[]> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }
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
