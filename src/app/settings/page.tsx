"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import {
  settingsSchema,
  type SettingsFormValues,
} from "@/lib/schemas/settingsSchema";
import { calculateTargetHourUTC } from "@/lib/utils/time";

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

function SettingsForm() {
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [feedback, setFeedback] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      topics: "",
      sources: [defaultSource],
      localTime: "07:00",
      promptCustomization: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "sources",
  });

  useEffect(() => {
    async function loadUserData() {
      if (!user) return;
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        const data = snap.data();
        setValue("topics", (data.config?.topics ?? []).join(", "));
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

  const onSubmit = async (data: SettingsFormValues) => {
    if (!user) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const targetHourUTC = calculateTargetHourUTC(
        data.localTime,
        userTimezone,
      );

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        "config.topics": data.topics
          .split(",")
          .map((topic) => topic.trim())
          .filter(Boolean),
        "config.sources": data.sources,
        "config.promptCustomization": data.promptCustomization || null,
        "schedule.localTime": data.localTime,
        "schedule.timezone": userTimezone,
        "schedule.targetHourUTC": targetHourUTC,
      });

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
      <div className="min-h-screen bg-slate-950 p-10 text-slate-300">
        Carregando configurações...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-slate-950/30">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
          Configurações
        </p>
        <h1 className="mt-4 text-3xl font-semibold">
          Preferências do Resumo
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Tópicos de Interesse (separados por vírgula)
            </label>
            <input
              {...register("topics")}
              placeholder="Ex: Inteligência Artificial, Next.js, Economia"
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100 shadow-sm"
            />
            {errors.topics && (
              <span className="mt-1 block text-sm text-rose-400">
                {errors.topics.message}
              </span>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Fontes de Informação
            </label>
            {fields.map((field, index) => (
              <div key={field.id} className="mb-2">
                <div className="flex items-center gap-2">
                  <select
                    {...register(`sources.${index}.type`)}
                    className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  >
                    <option value="rss">RSS</option>
                    <option value="twitter">Twitter</option>
                    <option value="website">Website</option>
                  </select>
                  <input
                    {...register(`sources.${index}.url`)}
                    placeholder="URL ou @usuario"
                    className="flex-1 rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-rose-400 hover:text-rose-300"
                    aria-label="Remover fonte"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
                {errors.sources?.[index]?.url && (
                  <span className="mt-1 block text-sm text-rose-400">
                    {errors.sources[index]?.url?.message}
                  </span>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => append(defaultSource)}
              className="mt-2 flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
            >
              <Plus size={16} /> Adicionar Fonte
            </button>
            {errors.sources?.message && (
              <span className="mt-1 block text-sm text-rose-400">
                {errors.sources.message}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Horário de Recebimento (seu fuso horário)
            </label>
            <input
              type="time"
              {...register("localTime")}
              className="mt-1 block rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100 shadow-sm"
            />
            {errors.localTime && (
              <span className="mt-1 block text-sm text-rose-400">
                {errors.localTime.message}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Instruções para a IA (Opcional)
            </label>
            <textarea
              {...register("promptCustomization")}
              placeholder="Ex: Foque apenas nas notícias mais críticas e use tom formal."
              className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100 shadow-sm"
              rows={3}
            />
            {errors.promptCustomization && (
              <span className="mt-1 block text-sm text-rose-400">
                {errors.promptCustomization.message}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-xl bg-cyan-500 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Salvando..." : "Salvar Preferências"}
          </button>

          {feedback && (
            <p
              className={`text-sm ${
                feedback.type === "success"
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {feedback.message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
