import * as z from "zod";

export const authSchema = z.object({
  email: z.string().email("Insira um e-mail válido."),
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
});

export type AuthFormValues = z.infer<typeof authSchema>;
