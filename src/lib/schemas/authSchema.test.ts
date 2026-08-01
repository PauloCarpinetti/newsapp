import { describe, expect, it } from "vitest";
import { authSchema } from "./authSchema";

const validPayload = {
  email: "paulo@example.com",
  password: "senha123",
};

describe("authSchema", () => {
  it("accepts a valid payload", () => {
    const result = authSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = authSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Insira um e-mail válido.");
    }
  });

  it("rejects a password shorter than 6 characters", () => {
    const result = authSchema.safeParse({ ...validPayload, password: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "A senha precisa ter pelo menos 6 caracteres.",
      );
    }
  });

  it("accepts a password with exactly 6 characters", () => {
    const result = authSchema.safeParse({ ...validPayload, password: "abcdef" });
    expect(result.success).toBe(true);
  });
});
