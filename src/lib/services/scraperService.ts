import Parser from "rss-parser";
import * as cheerio from "cheerio";

const MAX_CHARS_PER_SOURCE = 3000;
const FETCH_TIMEOUT_MS = 10_000;

export type Source = {
  type: "rss" | "twitter" | "website";
  url: string;
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

async function extractFromRss(url: string): Promise<string> {
  const feed = await new Parser().parseURL(url);
  return feed.items
    .slice(0, 10)
    .map((item) => `${item.title ?? ""}\n${item.contentSnippet ?? item.content ?? ""}`)
    .join("\n\n");
}

async function extractFromWebsite(url: string): Promise<string> {
  const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);
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
        source.type === "rss"
          ? await extractFromRss(source.url)
          : await extractFromWebsite(source.url);
      return truncateText(text, MAX_CHARS_PER_SOURCE);
    }),
  );

  return settled
    .filter(
      (result): result is PromiseFulfilledResult<string> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value)
    .filter(Boolean)
    .join("\n\n---\n\n");
}
