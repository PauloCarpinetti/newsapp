import * as z from "zod";

export const settingsSchema = z.object({
  topics: z.string().min(1, "Adicione pelo menos um tópico."),
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
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
