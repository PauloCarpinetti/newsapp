"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/AuthContext";

const CONFIRMATION_WORD = "EXCLUIR";

export function DeleteAccountDialog() {
  const { user } = useAuth();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!user) return;
    setIsDeleting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!response.ok) {
        throw new Error("Falha ao excluir a conta.");
      }

      await logout();
      router.replace("/");
    } catch (err) {
      console.error("Erro ao excluir a conta:", err);
      setError(
        err instanceof Error ? err.message : "Não foi possível excluir a conta.",
      );
      setIsDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-error p-6">
      <h2 className="text-lg font-semibold text-error">Zona de risco</h2>
      <p className="mt-2 text-sm text-on-surface-variant">
        Excluir sua conta apaga permanentemente seu perfil, preferências e todo o
        histórico de digests. Esta ação não pode ser desfeita.
      </p>

      <label className="mt-4 block text-sm font-medium text-on-surface-variant">
        Digite {CONFIRMATION_WORD} para confirmar
      </label>
      <input
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background"
      />

      <button
        type="button"
        onClick={handleDelete}
        disabled={confirmText !== CONFIRMATION_WORD || isDeleting}
        className="mt-4 w-full rounded-xl bg-error py-3 font-semibold text-on-error transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeleting ? "Excluindo..." : "Excluir conta permanentemente"}
      </button>

      {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
    </div>
  );
}
