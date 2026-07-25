import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";

const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const profileRef = doc(db, "users", user.uid);
    const existingProfile = await getDoc(profileRef);

    if (!existingProfile.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || null,
        createdAt: serverTimestamp(),
        config: {
          topics: [],
          sources: [],
          gptModel: "gpt-4o-mini",
          promptCustomization: null,
        },
        schedule: {
          localTime: "07:00",
          timezone: "UTC",
          targetHourUTC: 7,
        },
      });
    }

    return user;
  } catch (error) {
    console.error("Google login failed", error);
    throw new Error("Não foi possível concluir o login com o Google.");
  }
}

export async function logout() {
  await firebaseSignOut(auth);
}
