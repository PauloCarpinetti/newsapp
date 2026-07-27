import Link from "next/link";

const features = [
  "Autenticação com Google",
  "Perfil inicial do usuário",
  "Configuração local segura",
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
            Sua base inicial para digests inteligentes e perfil do usuário.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-on-surface-variant">
            Esta versão inicial já oferece a fundação visual e estrutural do
            produto, com App Router, Tailwind e o começo do fluxo de
            autenticação.
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
              key={feature}
              className="rounded-2xl border border-outline-variant bg-surface p-6"
            >
              <h2 className="text-lg font-semibold text-on-surface">
                {feature}
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Estrutura preparada para evoluir com novos recursos do produto.
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
