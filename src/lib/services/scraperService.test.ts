import { describe, expect, it } from "vitest";
import { truncateText } from "./scraperService";

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
