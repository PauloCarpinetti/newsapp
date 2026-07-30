import { NextRequest, NextResponse } from "next/server";
import {
  FieldValue,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { aggregateSources, type Source } from "@/lib/services/scraperService";
import { generateDigestWithAI } from "@/lib/services/aiService";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const currentHourUTC = new Date().getUTCHours();

    const usersSnapshot = await db
      .collection("users")
      .where("schedule.targetHourUTC", "==", currentHourUTC)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ processed: 0, total: 0 });
    }

    const results = await Promise.allSettled(
      usersSnapshot.docs.map((userDoc) => processUser(db, userDoc)),
    );

    const processed = results.filter((r) => r.status === "fulfilled").length;
    return NextResponse.json({ processed, total: usersSnapshot.size });
  } catch (error) {
    console.error("Erro crítico no Cron Job de geração de digests", error);
    return NextResponse.json(
      { error: "Não foi possível executar o processamento agendado." },
      { status: 500 },
    );
  }
}

async function processUser(
  db: Firestore,
  userDoc: QueryDocumentSnapshot,
): Promise<void> {
  const digestsRef = db.collection(`users/${userDoc.id}/digests`);

  const latest = await digestsRef.orderBy("createdAt", "desc").limit(1).get();
  if (!latest.empty) {
    const data = latest.docs[0].data();
    const createdAt: Date | undefined = data.createdAt?.toDate?.();
    const isToday =
      createdAt !== undefined &&
      createdAt.toISOString().slice(0, 10) ===
        new Date().toISOString().slice(0, 10);
    if (isToday && data.status !== "failed") {
      return;
    }
  }

  const digestRef = digestsRef.doc();
  await digestRef.set({
    createdAt: FieldValue.serverTimestamp(),
    status: "processing",
    isRead: false,
  });

  try {
    const userData = userDoc.data();
    const sources: Source[] = userData.config?.sources ?? [];
    const items = await aggregateSources(sources);

    if (items.length === 0) {
      await digestRef.update({
        status: "failed",
        errorMessage: "Nenhuma fonte retornou conteúdo utilizável.",
      });
      return;
    }

    const { content, tokensUsed } = await generateDigestWithAI(
      items,
      userData.config?.topics ?? [],
      userData.config?.promptCustomization ?? null,
      userData.config?.gptModel ?? "gpt-4o-mini",
    );

    await digestRef.update({ status: "completed", content, tokensUsed });
  } catch (error) {
    console.error(`Erro ao processar usuário ${userDoc.id}:`, error);
    await digestRef.update({
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}
