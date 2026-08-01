import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { profileSchema } from "@/lib/schemas/profileSchema";

async function verifyRequest(
  request: NextRequest,
): Promise<{ uid: string; error?: undefined } | { uid?: undefined; error: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  const idToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return {
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch (error) {
    console.error("Falha ao verificar o token de autenticação", error);
    const code = (error as { code?: string })?.code;
    if (code?.startsWith("app/")) {
      return {
        error: NextResponse.json(
          { error: "Erro de configuração do servidor." },
          { status: 500 },
        ),
      };
    }
    return {
      error: NextResponse.json({ error: "Token inválido." }, { status: 401 }),
    };
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const parseResult = profileSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Dados inválidos.", issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  const { displayName, socialLinks } = parseResult.data;

  try {
    await getAdminDb()
      .doc(`users/${auth.uid}`)
      .update({
        displayName,
        "profile.socialLinks": {
          twitter: socialLinks.twitter || null,
          instagram: socialLinks.instagram || null,
          linkedin: socialLinks.linkedin || null,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao salvar o perfil", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o perfil." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (auth.error) return auth.error;

  try {
    const db = getAdminDb();
    const digestsSnapshot = await db.collection(`users/${auth.uid}/digests`).get();

    const batch = db.batch();
    digestsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(db.doc(`users/${auth.uid}`));
    await batch.commit();

    await getAdminAuth().deleteUser(auth.uid);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir a conta", error);
    return NextResponse.json(
      { error: "Não foi possível excluir a conta." },
      { status: 500 },
    );
  }
}
