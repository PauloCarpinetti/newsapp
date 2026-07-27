"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginWithGoogle } from "@/lib/firebase/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle();
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado durante o login.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-20 text-on-background">
      <div className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-8 text-on-surface shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
          Login
        </p>
        <h1 className="mt-4 text-3xl font-semibold">Acesse sua conta</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          Entre com o Google para criar ou recuperar o perfil do usuário.
        </p>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar com Google"}
        </button>

        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
      </div>
    </main>
  );
}
