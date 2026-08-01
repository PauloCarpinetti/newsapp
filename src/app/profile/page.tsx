"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import {
  profileSchema,
  type ProfileFormValues,
} from "@/lib/schemas/profileSchema";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileForm />
    </ProtectedRoute>
  );
}

function ProfileForm() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      socialLinks: { twitter: "", instagram: "", linkedin: "" },
    },
  });

  useEffect(() => {
    async function loadProfileData() {
      if (!user) return;
      setValue("displayName", user.displayName ?? "");

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setValue("socialLinks.twitter", data.profile?.socialLinks?.twitter ?? "");
        setValue("socialLinks.instagram", data.profile?.socialLinks?.instagram ?? "");
        setValue("socialLinks.linkedin", data.profile?.socialLinks?.linkedin ?? "");
      }
      setIsLoadingData(false);
    }
    loadProfileData();
  }, [user, setValue]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!user) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      await updateProfile(user, { displayName: data.displayName });

      const idToken = await user.getIdToken();
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar o perfil.");
      }

      setFeedback({ type: "success", message: "Perfil atualizado com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar o perfil:", error);
      setFeedback({
        type: "error",
        message: "Não foi possível salvar o perfil.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant">
        <AppHeader />
        <div className="p-10">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      <AppHeader />
      <main className="px-6 py-20">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="rounded-3xl border border-outline-variant bg-surface p-8 text-on-surface shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Perfil
            </p>
            <h1 className="mt-4 text-3xl font-semibold">Sua conta</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
              {user?.photoURL && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt="Foto de perfil"
                  className="h-16 w-16 rounded-full"
                />
              )}

              <div>
                <label className="block text-sm font-medium text-on-surface-variant">
                  Nome de exibição
                </label>
                <input
                  {...register("displayName")}
                  className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
                />
                {errors.displayName && (
                  <span className="mt-1 block text-sm text-error">
                    {errors.displayName.message}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant">
                  E-mail
                </label>
                <p className="mt-1 text-on-surface-variant">{user?.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface-variant">
                  Redes sociais (opcional)
                </label>
                <div className="mt-2 space-y-2">
                  <input
                    {...register("socialLinks.twitter")}
                    placeholder="URL do Twitter/X"
                    className="block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
                  />
                  {errors.socialLinks?.twitter && (
                    <span className="block text-sm text-error">
                      {errors.socialLinks.twitter.message}
                    </span>
                  )}
                  <input
                    {...register("socialLinks.instagram")}
                    placeholder="URL do Instagram"
                    className="block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
                  />
                  {errors.socialLinks?.instagram && (
                    <span className="block text-sm text-error">
                      {errors.socialLinks.instagram.message}
                    </span>
                  )}
                  <input
                    {...register("socialLinks.linkedin")}
                    placeholder="URL do LinkedIn"
                    className="block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
                  />
                  {errors.socialLinks?.linkedin && (
                    <span className="block text-sm text-error">
                      {errors.socialLinks.linkedin.message}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-xl bg-primary py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Salvando..." : "Salvar Perfil"}
              </button>

              {feedback && (
                <p
                  className={`text-sm ${
                    feedback.type === "success" ? "text-tertiary" : "text-error"
                  }`}
                >
                  {feedback.message}
                </p>
              )}
            </form>
          </div>

          <DeleteAccountDialog />
        </div>
      </main>
    </div>
  );
}
