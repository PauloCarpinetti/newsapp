"use client";

import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-on-background">
        <AppHeader />
        <main className="px-6 py-20">
          <div className="mx-auto max-w-3xl rounded-3xl border border-outline-variant bg-surface p-10 text-on-surface">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Dashboard
            </p>
            <h1 className="mt-4 text-3xl font-semibold">Bem-vindo ao painel</h1>
            <p className="mt-3 text-on-surface-variant">
              {user?.displayName || user?.email || "Usuário autenticado"}
            </p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
