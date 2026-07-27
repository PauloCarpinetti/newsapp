import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { settingsSchema } from "@/lib/schemas/settingsSchema";
import { calculateTargetHourUTC } from "@/lib/utils/time";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (error) {
    console.error("Falha ao verificar o token de autenticação", error);
    // Distinguish "Admin SDK misconfigured" (app/*) from a genuinely bad
    // token (auth/*) so a missing FIREBASE_PRIVATE_KEY doesn't masquerade
    // as a client-side auth problem.
    const code = (error as { code?: string })?.code;
    if (code?.startsWith("app/")) {
      return NextResponse.json(
        { error: "Erro de configuração do servidor." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parseResult = settingsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { topics, sources, promptCustomization, localTime, timezone } =
    parseResult.data;

  try {
    const targetHourUTC = calculateTargetHourUTC(localTime, timezone);

    await getAdminDb().doc(`users/${uid}`).update({
      "config.topics": topics,
      "config.sources": sources,
      "config.promptCustomization": promptCustomization ?? null,
      "schedule.localTime": localTime,
      "schedule.timezone": timezone,
      "schedule.targetHourUTC": targetHourUTC,
    });

    return NextResponse.json({ targetHourUTC, timezone });
  } catch (error) {
    console.error("Falha ao salvar preferências", error);
    return NextResponse.json(
      { error: "Não foi possível salvar as preferências." },
      { status: 500 },
    );
  }
}
