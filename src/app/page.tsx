const features = [
  "Autenticação com Google",
  "Perfil inicial do usuário",
  "Configuração local segura",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-20 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            AI Digest Aggregator
          </p>
          <h1 className="text-4xl font-semibold sm:text-6xl">
            Sua base inicial para digests inteligentes e perfil do usuário.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            Esta versão inicial já oferece a fundação visual e estrutural do
            produto, com App Router, Tailwind e o começo do fluxo de
            autenticação.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <h2 className="text-lg font-semibold text-white">{feature}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Estrutura preparada para evoluir com novos recursos do produto.
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
