import * as z from "zod";

const socialUrl = z
  .string()
  .url("Insira uma URL válida")
  .optional()
  .or(z.literal(""));

export const profileSchema = z.object({
  displayName: z
    .string()
    .min(1, "Informe um nome.")
    .max(100, "Máximo de 100 caracteres."),
  socialLinks: z.object({
    twitter: socialUrl,
    instagram: socialUrl,
    linkedin: socialUrl,
  }),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
