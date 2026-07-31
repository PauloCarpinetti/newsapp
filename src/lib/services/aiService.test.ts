import { describe, expect, it } from "vitest";
import { filterKnownReferences, formatItemsForPrompt } from "./aiService";
import type { AggregatedItem } from "./scraperService";

describe("formatItemsForPrompt", () => {
  it("formats an item with a URL", () => {
    const items: AggregatedItem[] = [{ text: "conteúdo", url: "https://example.com/a" }];
    const result = formatItemsForPrompt(items);
    expect(result).toBe("[Fonte 1]\nURL: https://example.com/a\nconteúdo");
  });

  it("formats an item without a URL", () => {
    const items: AggregatedItem[] = [{ text: "conteúdo", url: null }];
    const result = formatItemsForPrompt(items);
    expect(result).toBe("[Fonte 1]\nURL: (indisponível)\nconteúdo");
  });

  it("joins multiple items with a separator and increments the index", () => {
    const items: AggregatedItem[] = [
      { text: "primeiro", url: "https://example.com/1" },
      { text: "segundo", url: null },
    ];
    const result = formatItemsForPrompt(items);
    expect(result).toBe(
      "[Fonte 1]\nURL: https://example.com/1\nprimeiro\n\n---\n\n[Fonte 2]\nURL: (indisponível)\nsegundo",
    );
  });

  it("returns an empty string for no items", () => {
    expect(formatItemsForPrompt([])).toBe("");
  });
});

describe("filterKnownReferences", () => {
  it("keeps only URLs present in the known set", () => {
    const knownUrls = new Set(["https://example.com/a", "https://example.com/b"]);
    const result = filterKnownReferences(
      ["https://example.com/a", "https://example.com/invented"],
      knownUrls,
    );
    expect(result).toEqual(["https://example.com/a"]);
  });

  it("caps the result at 3 references", () => {
    const knownUrls = new Set([
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
      "https://example.com/4",
    ]);
    const result = filterKnownReferences(
      [
        "https://example.com/1",
        "https://example.com/2",
        "https://example.com/3",
        "https://example.com/4",
      ],
      knownUrls,
    );
    expect(result).toHaveLength(3);
  });

  it("returns an empty array when nothing matches", () => {
    const knownUrls = new Set(["https://example.com/a"]);
    expect(filterKnownReferences(["https://example.com/invented"], knownUrls)).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(filterKnownReferences([], new Set())).toEqual([]);
  });
});
