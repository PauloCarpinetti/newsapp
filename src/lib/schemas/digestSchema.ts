import { z } from "zod";

export const digestContentSchema = z.object({
  intro: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      references: z.array(z.string()).max(3),
    }),
  ),
});

export type DigestContent = z.infer<typeof digestContentSchema>;
