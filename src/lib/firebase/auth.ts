import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

async function applyPersistence(keepSignedIn: boolean) {
  await setPersistence(
    auth,
    keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
  );
}

async function createProfile(idToken: string) {
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error("Falha ao preparar o perfil.");
  }
}

export function mapAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/weak-password":
      return "A senha é muito fraca.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "E-mail ou senha incorretos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Tente novamente mais tarde.";
    case "auth/invalid-email":
      return "Insira um e-mail válido.";
    default:
      console.error("Erro de autenticação", error);
      return "Não foi possível concluir a operação.";
  }
}

export async function loginWithGoogle(keepSignedIn: boolean) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await signInWithPopup(auth, provider);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    console.error("Google login failed", error);
    throw new Error("Não foi possível concluir o login com o Google.");
  }
}

export async function registerWithEmail(
  email: string,
  password: string,
  keepSignedIn: boolean,
) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
  keepSignedIn: boolean,
) {
  try {
    await applyPersistence(keepSignedIn);
    const result = await signInWithEmailAndPassword(auth, email, password);
    await createProfile(await result.user.getIdToken());
    return result.user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function logout() {
  await firebaseSignOut(auth);
}
