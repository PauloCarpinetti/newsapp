import { describe, expect, it } from "vitest";
import { profileSchema } from "./profileSchema";

const validPayload = {
  displayName: "Paulo Carpinetti",
  socialLinks: {
    twitter: "https://x.com/paulo",
    instagram: "",
    linkedin: "",
  },
};

describe("profileSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = profileSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts all social links empty", () => {
    const result = profileSchema.safeParse({
      ...validPayload,
      socialLinks: { twitter: "", instagram: "", linkedin: "" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty display name", () => {
    const result = profileSchema.safeParse({ ...validPayload, displayName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Informe um nome.");
    }
  });

  it("rejects a display name over 100 characters", () => {
    const result = profileSchema.safeParse({
      ...validPayload,
      displayName: "a".repeat(101),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Máximo de 100 caracteres.");
    }
  });

  it("rejects a malformed social link URL", () => {
    const result = profileSchema.safeParse({
      ...validPayload,
      socialLinks: { twitter: "not-a-url", instagram: "", linkedin: "" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Insira uma URL válida");
    }
  });

  it("accepts a valid URL for each social field", () => {
    const result = profileSchema.safeParse({
      ...validPayload,
      socialLinks: {
        twitter: "https://x.com/paulo",
        instagram: "https://instagram.com/paulo",
        linkedin: "https://linkedin.com/in/paulo",
      },
    });
    expect(result.success).toBe(true);
  });
});
