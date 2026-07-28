import Link from "next/link";

const features = [
  {
    title: "Tópicos sob medida",
    description:
      "Escolha até 10 temas de interesse e a IA prioriza o que realmente importa pra você.",
  },
  {
    title: "Suas fontes, do seu jeito",
    description:
      "Agregue feeds RSS e sites que você já confia — o digest é montado a partir deles.",
  },
  {
    title: "Chega na hora certa",
    description:
      "Defina o horário de entrega e receba um resumo novo, gerado automaticamente, todos os dias.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-20 text-on-background">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <section className="rounded-3xl border border-outline-variant bg-surface p-10 shadow-sm">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            AI Digest Aggregator
          </p>
          <h1 className="text-4xl font-semibold sm:text-6xl">
            Seu resumo diário de notícias, direto ao ponto.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-on-surface-variant">
            Escolha seus tópicos e fontes favoritas, defina o horário, e
            receba todos os dias um digest gerado por IA — sem precisar
            garimpar notícia por notícia.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-on-primary transition hover:opacity-90"
          >
            Entrar
          </Link>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-outline-variant bg-surface p-6"
            >
              <h2 className="text-lg font-semibold text-on-surface">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
