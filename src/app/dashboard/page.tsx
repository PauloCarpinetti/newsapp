"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DigestMarkdown } from "@/components/digests/DigestMarkdown";
import { DigestReferences } from "@/components/digests/DigestReferences";
import { DigestSkeleton } from "@/components/digests/DigestSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import type { DigestContent } from "@/lib/schemas/digestSchema";
import { digestDateFormatter } from "@/lib/utils/date";

type LatestDigest = {
  id: string;
  status: "processing" | "completed" | "failed";
  content?: DigestContent;
  createdAt?: { toDate: () => Date };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [latestDigest, setLatestDigest] = useState<LatestDigest | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  useEffect(() => {
    if (!user) return;

    const digestsRef = collection(db, `users/${user.uid}/digests`);
    const digestsQuery = query(digestsRef, orderBy("createdAt", "desc"), limit(1));

    const unsubscribe = onSnapshot(digestsQuery, (snapshot) => {
      setLatestDigest(
        snapshot.empty
          ? null
          : ({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as LatestDigest),
      );
      setIsLoadingLatest(false);
    });

    return unsubscribe;
  }, [user]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-on-background">
        <AppHeader />
        <main className="px-6 py-20">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-3xl border border-outline-variant bg-surface p-10 text-on-surface">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                Dashboard
              </p>
              <h1 className="mt-4 text-3xl font-semibold">
                Bem-vindo ao painel
              </h1>
              <p className="mt-3 text-on-surface-variant">
                {user?.displayName || user?.email || "Usuário autenticado"}
              </p>
            </div>

            {isLoadingLatest || latestDigest?.status === "processing" ? (
              <DigestSkeleton />
            ) : latestDigest === null ? (
              <div className="rounded-2xl border border-outline-variant bg-surface p-6 text-on-surface-variant">
                <h2 className="text-lg font-semibold text-on-surface">
                  Seu primeiro digest ainda não foi gerado
                </h2>
                <p className="mt-2 text-sm">
                  Assim que o horário configurado em Preferências chegar, seu
                  resumo aparecerá aqui automaticamente.
                </p>
              </div>
            ) : latestDigest.status === "failed" ? (
              <div className="rounded-2xl border border-outline-variant bg-surface p-6">
                <h2 className="text-lg font-semibold text-error">
                  Não foi possível gerar seu último digest
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Vamos tentar novamente no próximo horário agendado.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-outline-variant bg-surface p-6">
                <h2 className="text-lg font-semibold text-on-surface">
                  Seu digest de{" "}
                  {latestDigest.createdAt
                    ? digestDateFormatter.format(latestDigest.createdAt.toDate())
                    : "hoje"}
                </h2>
                <div className="mt-4">
                  <DigestMarkdown text={latestDigest.content?.intro ?? ""} />
                </div>
                {latestDigest.content?.sections.map((section, index) => (
                  <div key={index} className="mt-4">
                    <h3 className="text-base font-semibold text-on-surface">
                      {section.title}
                    </h3>
                    <div className="mt-1">
                      <DigestMarkdown text={section.summary} />
                    </div>
                    <DigestReferences references={section.references ?? []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
