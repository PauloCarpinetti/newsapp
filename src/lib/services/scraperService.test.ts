import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import {
  extractSectionLinks,
  looksLikeContentSite,
  truncateText,
} from "./scraperService";

describe("truncateText", () => {
  it("leaves text shorter than the limit unchanged", () => {
    expect(truncateText("hello", 100)).toBe("hello");
  });

  it("cuts text longer than the limit to exactly maxChars", () => {
    const text = "a".repeat(500);
    const result = truncateText(text, 300);
    expect(result).toHaveLength(300);
    expect(result).toBe("a".repeat(300));
  });

  it("keeps an empty string empty", () => {
    expect(truncateText("", 100)).toBe("");
  });

  it("handles text exactly at the limit", () => {
    const text = "a".repeat(100);
    expect(truncateText(text, 100)).toBe(text);
  });
});

describe("looksLikeContentSite", () => {
  it("accepts a title plus a meta description", () => {
    const $ = cheerio.load(
      `<head><title>Jornal X</title><meta name="description" content="Notícias"></head>`,
    );
    expect(looksLikeContentSite($)).toBe(true);
  });

  it("accepts a title plus an Open Graph tag", () => {
    const $ = cheerio.load(
      `<head><title>Jornal X</title><meta property="og:site_name" content="Jornal X"></head>`,
    );
    expect(looksLikeContentSite($)).toBe(true);
  });

  it("accepts a title plus JSON-LD structured data", () => {
    const $ = cheerio.load(
      `<head><title>Jornal X</title><script type="application/ld+json">{}</script></head>`,
    );
    expect(looksLikeContentSite($)).toBe(true);
  });

  it("rejects a page without a title", () => {
    const $ = cheerio.load(
      `<head><meta name="description" content="Notícias"></head>`,
    );
    expect(looksLikeContentSite($)).toBe(false);
  });

  it("rejects a title alone, with no other SEO signal", () => {
    const $ = cheerio.load(`<head><title>Jornal X</title></head>`);
    expect(looksLikeContentSite($)).toBe(false);
  });
});

describe("extractSectionLinks", () => {
  const baseUrl = "https://jornal.example.com/";

  it("returns valid shallow section links", () => {
    const $ = cheerio.load(`
      <nav>
        <a href="/esportes">Esportes</a>
        <a href="/politica">Política</a>
      </nav>
    `);
    const result = extractSectionLinks($, baseUrl);
    expect(result).toEqual([
      "https://jornal.example.com/esportes",
      "https://jornal.example.com/politica",
    ]);
  });

  it("excludes the homepage itself", () => {
    const $ = cheerio.load(`<nav><a href="/">Início</a></nav>`);
    expect(extractSectionLinks($, baseUrl)).toEqual([]);
  });

  it("excludes links to external domains", () => {
    const $ = cheerio.load(
      `<nav><a href="https://outrosite.example.com/esportes">Esportes</a></nav>`,
    );
    expect(extractSectionLinks($, baseUrl)).toEqual([]);
  });

  it("excludes links matching a blocked keyword", () => {
    const $ = cheerio.load(`<nav><a href="/login">Entrar</a></nav>`);
    expect(extractSectionLinks($, baseUrl)).toEqual([]);
  });

  it("excludes deep, article-like paths", () => {
    const $ = cheerio.load(
      `<nav><a href="/esportes/2026/08/01/titulo-do-artigo">Notícia</a></nav>`,
    );
    expect(extractSectionLinks($, baseUrl)).toEqual([]);
  });

  it("caps the result at 3 sections", () => {
    const $ = cheerio.load(`
      <nav>
        <a href="/esportes">Esportes</a>
        <a href="/politica">Política</a>
        <a href="/economia">Economia</a>
        <a href="/cultura">Cultura</a>
        <a href="/mundo">Mundo</a>
      </nav>
    `);
    expect(extractSectionLinks($, baseUrl)).toHaveLength(3);
  });
});
