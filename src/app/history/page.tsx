"use client";

import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DigestMarkdown } from "@/components/digests/DigestMarkdown";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import type { DigestContent } from "@/lib/schemas/digestSchema";

const PAGE_SIZE = 10;

type DigestListItem = {
  id: string;
  status: "processing" | "completed" | "failed";
  createdAt?: { toDate: () => Date };
  content?: DigestContent;
};

const statusLabels: Record<"processing" | "failed", string> = {
  processing: "Gerando...",
  failed: "Falhou",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <HistoryList />
    </ProtectedRoute>
  );
}

function HistoryList() {
  const { user } = useAuth();
  const [digests, setDigests] = useState<DigestListItem[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(
    null,
  );
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  async function loadMore(afterCursor: QueryDocumentSnapshot<DocumentData> | null) {
    if (!user) return;
    setIsLoading(true);

    const digestsRef = collection(db, `users/${user.uid}/digests`);
    const digestsQuery = afterCursor
      ? query(
          digestsRef,
          orderBy("createdAt", "desc"),
          startAfter(afterCursor),
          limit(PAGE_SIZE),
        )
      : query(digestsRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

    const snapshot = await getDocs(digestsQuery);
    const newItems = snapshot.docs.map(
      (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as DigestListItem,
    );

    setDigests((prev) => [...prev, ...newItems]);
    setCursor(snapshot.docs.at(-1) ?? afterCursor);
    setHasMore(snapshot.docs.length === PAGE_SIZE);
    setIsLoading(false);
    setIsInitialLoad(false);
  }

  useEffect(() => {
    if (!user) return;
    void loadMore(null);
    // Only re-run when the user changes — loadMore intentionally isn't a dep here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="min-h-screen bg-background text-on-background">
      <AppHeader />
      <main className="px-6 py-20">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="rounded-3xl border border-outline-variant bg-surface p-10 text-on-surface">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Histórico
            </p>
            <h1 className="mt-4 text-3xl font-semibold">Digests anteriores</h1>
          </div>

          {isInitialLoad && isLoading ? (
            <p className="text-on-surface-variant">Carregando...</p>
          ) : digests.length === 0 ? (
            <p className="text-on-surface-variant">
              Nenhum digest encontrado ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {digests.map((digest) => (
                <div
                  key={digest.id}
                  className="rounded-2xl border border-outline-variant bg-surface p-6"
                >
                  <p className="text-xs uppercase tracking-wide text-on-surface-variant">
                    {digest.createdAt
                      ? dateFormatter.format(digest.createdAt.toDate())
                      : "Data desconhecida"}
                  </p>
                  {digest.status === "completed" ? (
                    <div className="mt-2 line-clamp-3">
                      <DigestMarkdown text={digest.content?.intro ?? ""} />
                    </div>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-on-surface-variant">
                      {statusLabels[digest.status]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {hasMore && digests.length > 0 && (
            <button
              type="button"
              onClick={() => loadMore(cursor)}
              disabled={isLoading}
              className="w-full rounded-xl border border-outline px-4 py-3 font-semibold text-primary transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Carregando..." : "Carregar mais"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
