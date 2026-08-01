import { describe, expect, it } from "vitest";
import { mapAuthError } from "./auth";

function errorWithCode(code: string) {
  return { code };
}

describe("mapAuthError", () => {
  it("maps email-already-in-use to a specific message", () => {
    expect(mapAuthError(errorWithCode("auth/email-already-in-use"))).toBe(
      "Este e-mail já está em uso.",
    );
  });

  it("maps wrong-password and user-not-found to the same generic message", () => {
    const wrongPassword = mapAuthError(errorWithCode("auth/wrong-password"));
    const userNotFound = mapAuthError(errorWithCode("auth/user-not-found"));
    expect(wrongPassword).toBe(userNotFound);
    expect(wrongPassword).toBe("E-mail ou senha incorretos.");
  });

  it("maps invalid-credential to the same generic message as wrong-password", () => {
    expect(mapAuthError(errorWithCode("auth/invalid-credential"))).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(mapAuthError(errorWithCode("auth/some-unmapped-code"))).toBe(
      "Não foi possível concluir a operação.",
    );
  });

  it("falls back to a generic message for a non-Firebase error", () => {
    expect(mapAuthError(new Error("network down"))).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});
