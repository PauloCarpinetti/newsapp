# Resumos Detalhados e Referências por Tópico

**Short name:** referencias-por-topico

**Feature Branch**: `009-referencias-por-topico`

**Created**: 2026-07-30

**Status**: Draft

## Resumo
Estender o conteúdo do digest gerado pela IA (spec 007) em duas frentes: (1) resumos por tópico mais detalhados, e (2) uma lista de referências (links reais de volta às fontes de origem) exibida numa caixa colapsável, fechada por padrão, abaixo do resumo de cada tópico — com fundo de cor levemente diferente do card pra não poluir o layout.

## Contexto e Motivação
Hoje `content.sections[].summary` é curto e não carrega nenhum link de volta à fonte que originou aquele trecho — o usuário não tem como verificar ou aprofundar no que gerou o resumo. Além disso, a pipeline de agregação atual (`scraperService.aggregateSources`) concatena o texto de todas as fontes num único blob de string e descarta qualquer URL de origem nesse processo — mesmo que quiséssemos citar uma fonte hoje, essa informação já não existe mais no momento em que o texto chega à IA. Esta spec resolve as duas coisas juntas, porque a segunda depende da primeira: não dá pra ter referências confiáveis sem primeiro preservar a URL de cada item agregado.

## Objetivos
- Resumos por tópico com mais profundidade/contexto do que a versão atual, sem inventar conteúdo além do que foi agregado das fontes do usuário.
- A IA MUST registrar a URL do site de notícias que originou cada resumo, para que o usuário consiga acessar a página real da fonte a partir do digest — hoje essa informação é descartada na agregação e o usuário não tem como chegar até a fonte original.
- Cada tópico ganha até 3 referências (URLs) das fontes que de fato embasaram aquele resumo.
- A IA nunca inventa uma URL — só pode citar entre as URLs reais fornecidas na entrada (nunca alucinar um link).
- Fontes `rss` contribuem com a URL de cada item (`item.link`); fontes `website` contribuem com a URL da própria fonte cadastrada (não um link de artigo específico extraído da página — ver Fora de Escopo). Em ambos os casos, é a URL real do site de notícias que o usuário vê ao clicar.
- Referências aparecem numa caixa colapsável (fechada por padrão) abaixo do resumo de cada tópico, com fundo levemente diferente da superfície do card.

## Escopo (In Scope)
- `src/lib/services/scraperService.ts`: `aggregateSources` passa a retornar uma lista estruturada de itens (texto + URL de origem) em vez de uma única string — RSS gera um item por artigo (`item.link`); website gera um único item por fonte, com a URL cadastrada da própria fonte.
- `src/lib/schemas/digestSchema.ts`: novo campo `sections[].references: string[]` (0 a 3 URLs), opcional na leitura (digests antigos não têm o campo).
- `src/lib/services/aiService.ts`: prompt atualizado para (a) pedir resumos mais detalhados por tópico, (b) fornecer a lista de URLs candidatas junto com o texto de cada fonte agregada, (c) instruir explicitamente a IA a só citar URLs dessa lista, no máximo 3 por tópico, deixando vazio quando nenhuma se encaixar.
- `src/app/api/cron/generate/route.ts`: ajuste de tipos para o novo formato de retorno de `aggregateSources` — sem mudança de comportamento no isolamento de falhas/idempotência já existentes (spec 007/ADR 0004).
- Componente de exibição do digest (`src/components/digests/`): nova caixa colapsável de referências por seção, renderizada só quando `references.length > 0`, usando os tokens de cor MD3 já em uso (spec 004) para o fundo diferenciado.

## Fora de Escopo
- Extrair links de artigos individuais de dentro de uma fonte `website` (scraping mais profundo da página, ex. seguir `<a>` tags) — decisão confirmada com o usuário: fontes website citam a própria URL cadastrada, não uma URL de artigo específico. Pode virar spec futura se fizer falta.
- Checagem de disponibilidade/validade das URLs no momento da geração (link morto não é detectado).
- Qualquer mudança na arquitetura de leitura em tempo real, paginação do histórico, ou demais aspectos da spec 008 — esta spec só adiciona conteúdo ao que já é exibido.
- Enriquecimento retroativo de digests já gerados antes desta spec — o campo `references` simplesmente não existe nesses documentos; a UI trata isso como "sem referências", não como erro.
- Configuração pelo usuário do número máximo de referências — o limite de 3 é fixo nesta versão.

## Dados (Data Dictionary)
Campo novo em `users/{uid}/digests/{digestId}` (estende a entidade `Digest` da spec 007):
- `content.sections[].references: string[]` — lista de 0 a 3 URLs completas (com protocolo) das fontes que embasaram aquele resumo. Ausente ou vazio quando nenhuma fonte com URL disponível foi relevante para o tópico.

## Requisitos Funcionais (Testáveis)

### US1 — Resumos Mais Detalhados
RF-1: A IA MUST gerar resumos por tópico mais detalhados do que a versão atual (mais contexto/profundidade, não apenas 1-2 frases), permanecendo fiel ao conteúdo agregado das fontes do usuário, sem inventar informação.
- Aceitação: Comparado a um digest gerado antes desta spec, `sections[].summary` de um novo digest cobre mais aspectos do conteúdo agregado daquele tópico, sem introduzir fatos que não estejam no texto de origem.

### US2 — Referências por Tópico
RF-2: Cada item de `content.sections[]` gerado pela IA MUST incluir um campo `references` com 0 a 3 URLs.
- Aceitação: Todo digest gerado após esta spec tem, em cada seção, um array `references` (pode ser vazio) nunca com mais de 3 itens.

RF-3: A IA MUST citar apenas URLs que estavam de fato presentes na lista de fontes fornecida como entrada — nunca inventar, adivinhar ou alterar uma URL.
- Aceitação: Toda URL presente em `references` corresponde exatamente a uma URL real fornecida na agregação daquele digest (verificável comparando com `item.link` do RSS ou a URL cadastrada da fonte website usada).

RF-4: Fontes do tipo `rss` MUST contribuir com a URL de cada item individual (`item.link`) como candidata a referência; fontes do tipo `website` MUST contribuir apenas com a URL da própria fonte cadastrada.
- Aceitação: Uma referência originada de uma fonte RSS aponta para uma notícia específica; uma referência originada de uma fonte website é idêntica à URL cadastrada pelo usuário em Configurações para aquela fonte.

RF-5: Quando nenhuma fonte relevante para um tópico tiver URL disponível, `references` MUST ficar vazio — a ausência de referência nunca impede a geração do `summary` daquele tópico.
- Aceitação: Uma seção sem nenhuma referência disponível ainda exibe seu resumo normalmente, sem erro nem seção ausente no digest.

### US3 — Exibição das Referências
RF-6: Quando `sections[].references` tiver ao menos 1 item, a UI MUST exibir uma caixa colapsável abaixo do resumo daquele tópico, fechada por padrão, com um rótulo indicando a quantidade (ex.: "Referências (3)").
- Aceitação: Um tópico com referências mostra a caixa fechada por padrão ao carregar a página; expandir mostra os links.

RF-7: A caixa de referências MUST ter um fundo de cor levemente diferente da superfície do card do digest, usando os tokens de cor MD3 já em uso no projeto (spec 004) — sem introduzir cor fora do sistema nem contraste excessivo.
- Aceitação: Visualmente, a caixa de referências é perceptível como uma região distinta do card, sem "gritar" nem quebrar a hierarquia visual do resumo.

RF-8: Cada referência exibida MUST ser um link real e clicável, abrindo em nova aba.
- Aceitação: Clicar em uma referência abre a URL correspondente numa nova aba do navegador.

RF-9: Quando `sections[].references` estiver ausente ou vazio, a UI MUST NOT exibir a caixa colapsável para aquele tópico (nem vazia, nem com um placeholder do tipo "sem referências").
- Aceitação: Um tópico sem referências não mostra nenhum elemento de caixa/accordion abaixo do resumo.

## Critérios de Sucesso
- SC-1: Resumos gerados após esta spec são perceptivelmente mais detalhados que os anteriores, mantendo fidelidade ao conteúdo agregado.
- SC-2: 100% das URLs exibidas como referência correspondem a uma URL real fornecida na agregação daquele digest — nenhuma URL inventada chega à UI.
- SC-3: Nenhum tópico exibe mais de 3 referências.
- SC-4: A caixa de referências nunca aparece expandida por padrão, e nunca aparece vazia/sem itens.

## Cenários de Aceitação
1. Cenário: Tópico com referências de RSS
   - Dado um tópico cujo conteúdo agregado veio de uma fonte RSS com itens que têm `link`
   - Quando o digest é gerado
   - Então o tópico exibe uma caixa colapsável fechada com até 3 links reais dos itens RSS usados

2. Cenário: Tópico só com fonte website
   - Dado um tópico cujo conteúdo agregado veio só de uma fonte `website`
   - Quando o digest é gerado
   - Então a referência exibida (se houver) é exatamente a URL cadastrada da fonte, não uma URL de artigo específico

3. Cenário: Tópico sem nenhuma fonte com URL disponível
   - Dado um tópico cujas fontes de origem não geraram nenhuma URL candidata
   - Quando o digest é gerado
   - Então o resumo aparece normalmente e nenhuma caixa de referências é exibida

4. Cenário: Expandir referências
   - Dado um tópico com 2 referências
   - Quando o usuário clica no rótulo "Referências (2)"
   - Então a caixa expande mostrando os 2 links clicáveis, com fundo levemente diferente do resto do card

5. Cenário: Digest antigo sem o campo
   - Dado um digest gerado antes desta spec (sem `sections[].references` no documento)
   - Quando o usuário visualiza esse digest no dashboard ou no histórico
   - Então o resumo aparece normalmente e nenhuma caixa de referências quebrada é exibida

## Entidades Chave
- `Digest.content.sections[].references` — novo campo, lista de URLs (ver Data Dictionary). Extensão da entidade `Digest` já definida na spec 007.
- `AggregatedItem` (estrutura interna, não persistida) — `{ text: string, url: string | null }`, produzida por `scraperService.aggregateSources`, substituindo o retorno atual (`Promise<string>` único).

## Assunções
- "Resumo um pouco mais detalhado" é interpretado como mais profundidade dentro do conteúdo já agregado — não uma mudança no volume de fontes buscadas nem no modelo de IA usado (continua `gpt-4o-mini`, salvo indicação em contrário).
- "Referências" significa links de volta às fontes de origem que embasaram o resumo — não citação bibliográfica formal nem citação inline dentro do texto do resumo.
- "Drop box" no pedido original foi confirmado com o usuário como uma caixa colapsável (accordion), fechada por padrão — não uma lista sempre visível.
- Fontes do tipo `website` referenciam a URL da própria fonte cadastrada, não um link de artigo específico extraído da página — decisão confirmada com o usuário (ver Fora de Escopo).
- O limite de 3 referências por tópico é fixo no prompt da IA, não configurável pelo usuário nesta spec.
- As regras de segurança do Firestore (spec 002, endurecidas e versionadas em `firestore.rules` na sessão de 2026-07-30) já cobrem a leitura do novo campo sem qualquer mudança — é só mais um campo dentro de `content.sections[]`, que o client já lê integralmente hoje.

## Dependências
- Conclusão da spec 007 (pipeline de geração) e spec 008 (UI de leitura) — esta spec estende ambas.
- Nenhuma dependência nova de biblioteca — mudança de schema (Zod) + prompt (OpenAI Structured Outputs) + UI (caixa colapsável pode usar `<details>/<summary>` nativo do HTML, sem nova dependência).

## Riscos e Mitigações
- Risco: A IA cita, entre as URLs candidatas fornecidas, uma que é real mas não é a mais relevante para aquele resumo específico.
  - Mitigação: Aceito como limitação conhecida desta primeira versão — RF-3 garante que a URL é sempre real (nunca quebrada/inventada), ainda que a relevância exata não seja garantida pelo modelo. Candidato a refinamento futuro se virar problema perceptível.
- Risco: Resumos mais detalhados aumentam o consumo de tokens (custo) por chamada à OpenAI.
  - Mitigação: Sem teto rígido de tokens definido nesta spec; `tokensUsed` já é persistido por digest (spec 007) e pode ser observado após a implementação para decidir se um limite é necessário numa spec futura.
- Risco: Mudar a assinatura de retorno de `aggregateSources` (de `string` único para uma lista estruturada) toca o núcleo do pipeline de geração já validado em produção (spec 007).
  - Mitigação: Atualizar os testes unitários existentes do `scraperService`/`time` antes de considerar a spec pronta; validar manualmente um digest real gerado ponta a ponta (como já é praxe neste projeto) antes do merge.

## Artefatos Criados
- `specs/009-referencias-por-topico/spec.md`
- `.specify/feature.json` apontando para `specs/009-referencias-por-topico`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md`: detalhar a estrutura exata de `AggregatedItem`, o formato da mensagem enviada à IA (como a lista de URLs candidatas é apresentada), e o componente de UI da caixa colapsável (tokens de cor MD3 escolhidos para o fundo).
- `tasks.md`.
- Implementar.

*Gerado em: 2026-07-30*
