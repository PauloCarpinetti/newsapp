import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle(keepSignedIn: boolean) {
  try {
    await setPersistence(
      auth,
      keepSignedIn ? browserLocalPersistence : browserSessionPersistence,
    );

    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    const response = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!response.ok) {
      throw new Error("Falha ao preparar o perfil.");
    }

    return result.user;
  } catch (error) {
    console.error("Google login failed", error);
    throw new Error("Não foi possível concluir o login com o Google.");
  }
}

export async function logout() {
  await firebaseSignOut(auth);
}
