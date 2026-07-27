import * as z from "zod";

export const settingsSchema = z.object({
  topics: z
    .array(z.string().min(1))
    .min(1, "Adicione pelo menos um tópico.")
    .max(10, "No máximo 10 tópicos."),
  sources: z
    .array(
      z.object({
        type: z.enum(["rss", "twitter", "website"]),
        url: z.string().url("Insira uma URL válida"),
      }),
    )
    .min(1, "Adicione pelo menos uma fonte."),
  localTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Formato inválido (HH:MM)"),
  promptCustomization: z
    .string()
    .max(500, "Máximo de 500 caracteres")
    .optional(),
  timezone: z.string().min(1, "Fuso horário inválido."),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
