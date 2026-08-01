"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/firebase/auth";

export function AppHeader() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="border-b border-outline-variant bg-surface text-on-surface">
      <nav className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <Link href="/dashboard" className="font-semibold">
          AI Digest Aggregator
        </Link>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm sm:gap-6">
          <Link href="/dashboard" className="hover:text-primary">
            Dashboard
          </Link>
          <Link href="/settings" className="hover:text-primary">
            Configurações
          </Link>
          <Link href="/history" className="hover:text-primary">
            Histórico
          </Link>
          <Link href="/profile" className="hover:text-primary">
            Perfil
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isSigningOut}
            className="flex items-center gap-1 text-on-surface-variant hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={16} />
            {isSigningOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </nav>
    </header>
  );
}
