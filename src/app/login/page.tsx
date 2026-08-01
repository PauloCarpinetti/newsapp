"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  resetPassword,
} from "@/lib/firebase/auth";
import { authSchema, type AuthFormValues } from "@/lib/schemas/authSchema";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<AuthFormValues>({ resolver: zodResolver(authSchema) });

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      await loginWithGoogle(keepSignedIn);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro inesperado durante o login.",
      );
    } finally {
      setLoading(false);
    }
  }

  const onSubmitEmail = async (data: AuthFormValues) => {
    setError(null);
    setResetSent(false);
    setLoading(true);

    try {
      if (mode === "login") {
        await loginWithEmail(data.email, data.password, keepSignedIn);
      } else {
        await registerWithEmail(data.email, data.password, keepSignedIn);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  async function handleForgotPassword() {
    setError(null);
    setResetSent(false);

    const parsed = authSchema.shape.email.safeParse(getValues("email"));
    if (!parsed.success) {
      setError("Informe um e-mail válido para redefinir a senha.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(parsed.data);
      setResetSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
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
          Entre com o Google ou com e-mail e senha.
        </p>

        <label className="mt-6 flex items-center gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
            className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
          />
          Manter conectado
        </label>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Aguarde..." : "Entrar com Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase text-on-surface-variant">
          <span className="h-px flex-1 bg-outline-variant" /> ou
          <span className="h-px flex-1 bg-outline-variant" />
        </div>

        <form onSubmit={handleSubmit(onSubmitEmail)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface-variant">
              E-mail
            </label>
            <input
              type="email"
              {...register("email")}
              className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
            />
            {errors.email && (
              <span className="mt-1 block text-sm text-error">
                {errors.email.message}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface-variant">
              Senha
            </label>
            <input
              type="password"
              {...register("password")}
              className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
            />
            {errors.password && (
              <span className="mt-1 block text-sm text-error">
                {errors.password.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl border border-primary py-3 font-semibold text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Aguarde..." : mode === "login" ? "Entrar com e-mail" : "Criar conta"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:opacity-80"
            >
              {mode === "login" ? "Criar conta" : "Já tenho conta"}
            </button>
            {mode === "login" && (
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-primary hover:opacity-80"
              >
                Esqueci minha senha
              </button>
            )}
          </div>
        </form>

        {resetSent && (
          <p className="mt-4 text-sm text-tertiary">
            Se esse e-mail tiver uma conta, enviamos um link de redefinição.
          </p>
        )}
        {error ? <p className="mt-4 text-sm text-error">{error}</p> : null}
      </div>
    </main>
  );
}
