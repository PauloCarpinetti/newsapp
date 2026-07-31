import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  digestContentSchema,
  type DigestContent,
} from "@/lib/schemas/digestSchema";
import type { AggregatedItem } from "@/lib/services/scraperService";

let client: OpenAI | undefined;

function getOpenAIClient(): OpenAI {
  // Lazy pelo mesmo motivo do Admin SDK (specs 001/005): `new OpenAI()` lança
  // imediatamente se OPENAI_API_KEY não estiver definida, o que quebraria
  // `next build` se instanciado no escopo do módulo.
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

export function formatItemsForPrompt(items: AggregatedItem[]): string {
  return items
    .map((item, index) => {
      const urlLine = item.url ? `URL: ${item.url}` : "URL: (indisponível)";
      return `[Fonte ${index + 1}]\n${urlLine}\n${item.text}`;
    })
    .join("\n\n---\n\n");
}

export function filterKnownReferences(
  references: string[],
  knownUrls: Set<string>,
): string[] {
  return references.filter((url) => knownUrls.has(url)).slice(0, 3);
}

export async function generateDigestWithAI(
  items: AggregatedItem[],
  topics: string[],
  promptCustomization: string | null,
  model: string,
): Promise<{ content: DigestContent; tokensUsed: number }> {
  const completion = await getOpenAIClient().beta.chat.completions.parse({
    model,
    messages: [
      {
        role: "system",
        content: [
          "Você resume notícias e conteúdo de fontes diversas em um digest diário, em português.",
          `Tópicos de interesse do usuário: ${topics.join(", ") || "gerais"}.`,
          promptCustomization
            ? `Instruções adicionais do usuário: ${promptCustomization}`
            : "",
          "Gere uma introdução curta e seções organizadas por tópico, baseadas exclusivamente no conteúdo fornecido abaixo — nunca use conhecimento geral, suposições ou fatos que não estejam literalmente presentes no conteúdo fornecido, mesmo que pareçam plausíveis ou que você 'saiba' serem verdade.",
          "Só crie uma seção para um dos tópicos de interesse do usuário se o conteúdo fornecido tiver informação real e específica sobre ele. Não é obrigatório gerar uma seção por tópico — se nenhum trecho do conteúdo cobrir um tópico, simplesmente não crie seção para ele, em vez de preencher com generalidades ou detalhes inventados.",
          "Dentro dessa restrição de fidelidade, torne cada resumo o mais detalhado possível — cubra os principais pontos que estejam de fato presentes no conteúdo agregado daquele tópico, mais do que um único parágrafo curto.",
          "Cada seção pode incluir até 3 URLs em 'references'. Uma URL só pode ser citada se aparecer literalmente em uma linha 'URL: ...' do conteúdo fornecido — nunca invente, adivinhe ou modifique uma URL. Se nenhuma fonte relevante tiver URL, deixe 'references' como uma lista vazia.",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { role: "user", content: formatItemsForPrompt(items) },
    ],
    response_format: zodResponseFormat(digestContentSchema, "digest"),
  });

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("A IA não retornou um digest em formato válido.");
  }

  const knownUrls = new Set(
    items.map((item) => item.url).filter((url): url is string => Boolean(url)),
  );
  const content: DigestContent = {
    ...parsed,
    sections: parsed.sections.map((section) => ({
      ...section,
      references: filterKnownReferences(section.references, knownUrls),
    })),
  };

  return { content, tokensUsed: completion.usage?.total_tokens ?? 0 };
}
