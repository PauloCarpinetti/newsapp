"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDoc } from "firebase/firestore";
import { Plus, Trash2, X } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  settingsSchema,
  type SettingsFormValues,
} from "@/lib/schemas/settingsSchema";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsForm />
    </ProtectedRoute>
  );
}

const defaultSource: SettingsFormValues["sources"][number] = {
  type: "rss",
  url: "",
};

const MAX_TOPICS = 10;

function SettingsForm() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [topicInput, setTopicInput] = useState("");
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      topics: [],
      sources: [defaultSource],
      localTime: "07:00",
      promptCustomization: "",
      timezone: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sources",
  });

  const topics = watch("topics");

  useEffect(() => {
    setValue("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [setValue]);

  useEffect(() => {
    async function loadUserData() {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        setValue("topics", data.config?.topics ?? []);
        setValue(
          "sources",
          data.config?.sources?.length ? data.config.sources : [defaultSource],
        );
        setValue("localTime", data.schedule?.localTime ?? "07:00");
        setValue(
          "promptCustomization",
          data.config?.promptCustomization ?? "",
        );
      }
      setIsLoadingData(false);
    }
    loadUserData();
  }, [user, setValue]);

  function addTopic() {
    const value = topicInput.trim();
    if (!value || topics.length >= MAX_TOPICS) return;
    setValue("topics", [...topics, value], { shouldValidate: true });
    setTopicInput("");
  }

  function removeTopic(index: number) {
    setValue(
      "topics",
      topics.filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  }

  const onSubmit = async (data: SettingsFormValues) => {
    if (!user) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Falha ao salvar preferências.");
      }

      setFeedback({
        type: "success",
        message: "Preferências salvas com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao salvar preferências:", error);
      setFeedback({
        type: "error",
        message: "Ocorreu um erro ao salvar as configurações.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant">
        <AppHeader />
        <div className="p-10">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-background">
      <AppHeader />
      <main className="px-6 py-20">
        <div className="mx-auto max-w-2xl rounded-3xl border border-outline-variant bg-surface p-8 text-on-surface shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Configurações
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            Preferências do Resumo
          </h1>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Tópicos de Interesse (até {MAX_TOPICS})
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                {topics.map((topic, index) => (
                  <span
                    key={`${topic}-${index}`}
                    className="flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-sm text-on-primary-container"
                  >
                    {topic}
                    <button
                      type="button"
                      onClick={() => removeTopic(index)}
                      aria-label={`Remover tópico ${topic}`}
                      className="hover:opacity-70"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={topicInput}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTopic();
                    }
                  }}
                  placeholder="Ex: Inteligência Artificial"
                  disabled={topics.length >= MAX_TOPICS}
                  className="min-w-0 flex-1 rounded-md border border-outline bg-background p-2 text-on-background shadow-sm disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={addTopic}
                  disabled={topics.length >= MAX_TOPICS}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-outline px-3 text-sm text-primary hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>
              {errors.topics && (
                <span className="mt-1 block text-sm text-error">
                  {errors.topics.message}
                </span>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-on-surface-variant">
                Fontes de Informação
              </label>
              {fields.map((field, index) => (
                <div key={field.id} className="mb-2">
                  <div className="flex items-center gap-2">
                    <select
                      {...register(`sources.${index}.type`)}
                      className="shrink-0 rounded-md border border-outline bg-background p-2 text-on-background"
                    >
                      <option value="rss">RSS</option>
                      <option value="twitter">Twitter</option>
                      <option value="website">Website</option>
                    </select>
                    <input
                      {...register(`sources.${index}.url`)}
                      placeholder="URL ou @usuario"
                      className="min-w-0 flex-1 rounded-md border border-outline bg-background p-2 text-on-background"
                    />
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="shrink-0 text-error hover:opacity-80"
                      aria-label="Remover fonte"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                  {errors.sources?.[index]?.url && (
                    <span className="mt-1 block text-sm text-error">
                      {errors.sources[index]?.url?.message}
                    </span>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => append(defaultSource)}
                className="mt-2 flex items-center gap-1 text-sm text-primary hover:opacity-80"
              >
                <Plus size={16} /> Adicionar Fonte
              </button>
              {errors.sources?.message && (
                <span className="mt-1 block text-sm text-error">
                  {errors.sources.message}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Horário de Recebimento (seu fuso horário)
              </label>
              <input
                type="time"
                {...register("localTime")}
                className="mt-1 block rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
              />
              {errors.localTime && (
                <span className="mt-1 block text-sm text-error">
                  {errors.localTime.message}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Instruções para a IA (Opcional)
              </label>
              <textarea
                {...register("promptCustomization")}
                placeholder="Ex: Foque apenas nas notícias mais críticas e use tom formal."
                className="mt-1 block w-full rounded-md border border-outline bg-background p-2 text-on-background shadow-sm"
                rows={3}
              />
              {errors.promptCustomization && (
                <span className="mt-1 block text-sm text-error">
                  {errors.promptCustomization.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-on-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Salvando..." : "Salvar Preferências"}
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
      </main>
    </div>
  );
}
