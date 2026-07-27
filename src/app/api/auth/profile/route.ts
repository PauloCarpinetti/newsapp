import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error("Falha ao verificar o token de autenticação", error);
    const code = (error as { code?: string })?.code;
    if (code?.startsWith("app/")) {
      return NextResponse.json(
        { error: "Erro de configuração do servidor." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  try {
    const userRef = getAdminDb().doc(`users/${decoded.uid}`);
    const existing = await userRef.get();

    if (!existing.exists) {
      await userRef.set({
        uid: decoded.uid,
        email: decoded.email ?? "",
        displayName: decoded.name ?? null,
        createdAt: FieldValue.serverTimestamp(),
        config: {
          topics: [],
          sources: [],
          gptModel: "gpt-4o-mini",
          promptCustomization: null,
        },
        schedule: { localTime: "07:00", timezone: "UTC", targetHourUTC: 7 },
      });
    }

    return NextResponse.json({ created: !existing.exists });
  } catch (error) {
    console.error("Falha ao preparar o perfil", error);
    return NextResponse.json(
      { error: "Não foi possível preparar o perfil." },
      { status: 500 },
    );
  }
}
