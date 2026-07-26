import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settingsSchema";

const validPayload = {
  topics: "Inteligência Artificial, Next.js",
  sources: [{ type: "rss" as const, url: "https://example.com/feed.xml" }],
  localTime: "07:00",
  promptCustomization: "Foque em notícias críticas.",
};

describe("settingsSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = settingsSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts a payload without promptCustomization (optional field)", () => {
    const { promptCustomization: _promptCustomization, ...rest } = validPayload;
    const result = settingsSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("rejects empty topics", () => {
    const result = settingsSchema.safeParse({ ...validPayload, topics: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Adicione pelo menos um tópico.",
      );
    }
  });

  it("rejects a source with an invalid URL", () => {
    const result = settingsSchema.safeParse({
      ...validPayload,
      sources: [{ type: "rss", url: "not-a-url" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Insira uma URL válida");
    }
  });

  it("rejects an empty sources array", () => {
    const result = settingsSchema.safeParse({ ...validPayload, sources: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Adicione pelo menos uma fonte.",
      );
    }
  });

  it("rejects localTime outside the HH:MM format", () => {
    const result = settingsSchema.safeParse({
      ...validPayload,
      localTime: "7:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Formato inválido (HH:MM)");
    }
  });

  it("rejects promptCustomization over 500 characters", () => {
    const result = settingsSchema.safeParse({
      ...validPayload,
      promptCustomization: "a".repeat(501),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Máximo de 500 caracteres");
    }
  });
});
