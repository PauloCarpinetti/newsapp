"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Dashboard
          </p>
          <h1 className="mt-4 text-3xl font-semibold">Bem-vindo ao painel</h1>
          <p className="mt-3 text-slate-400">
            {user?.displayName || user?.email || "Usuário autenticado"}
          </p>
        </div>
      </main>
    </ProtectedRoute>
  );
}
