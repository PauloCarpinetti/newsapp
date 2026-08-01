# Seções Reais e Validação de Fontes Website

**Short name:** secoes-website

**Feature Branch**: `014-secoes-website`

**Created**: 2026-08-01

**Status**: Draft

## Resumo
Fontes do tipo `website` hoje contribuem um único item de agregação: o texto da página inicial, com a URL raiz do site como única referência possível — por isso toda referência gerada por essas fontes aponta sempre pra raiz, nunca pra algo mais específico. Esta spec faz duas mudanças em `extractFromWebsite`: (1) valida, via metadados de SEO no `<head>` da página, que a fonte parece de fato ser um site de conteúdo real antes de usá-la; (2) descobre até 3 links de seção na navegação do site (ex.: "Esportes", "Política") e busca o conteúdo de cada uma, cada uma virando um item próprio com sua própria URL real — dando à IA referências mais específicas que a raiz, sem exigir que sejam a notícia exata.

## Contexto e Motivação
Achado ao vivo depois da spec 009: um usuário com uma única fonte `website` viu que toda referência gerada apontava pra raiz do site, nunca pra nada mais específico — porque é literalmente a única URL que `extractFromWebsite` conhece pra essa fonte hoje. Além disso, nada garante que a URL cadastrada pelo usuário em `/settings` é de fato um site de conteúdo (poderia ser uma página quebrada, estacionada, ou irrelevante), o que arrisca desperdiçar uma chamada de IA resumindo lixo.

## Objetivos
- `extractFromWebsite` MUST verificar, em código (não pedindo à IA), se a página tem metadados de SEO típicos de um site de conteúdo real antes de usá-la como fonte.
- Uma fonte que falhar nessa verificação MUST ser tratada como uma falha isolada dessa fonte (mesmo padrão de `Promise.allSettled` já usado — ADR 0004), não interrompendo a agregação das demais fontes do usuário.
- `extractFromWebsite` MUST descobrir até 3 links de seção a partir da navegação do site (ex.: menu principal), excluindo a própria raiz, domínios externos e páginas claramente não relacionadas a conteúdo (login, contato, termos, etc.).
- Cada seção encontrada e buscada com sucesso MUST virar um item de agregação próprio, com sua própria URL real — disponível para a IA citar como referência (spec 009), sem exigir que corresponda exatamente ao tópico de interesse do usuário.
- A página inicial MUST continuar sendo incluída como item de fallback, preservando a cobertura que já existe hoje.

## Escopo (In Scope)
- `src/lib/services/scraperService.ts`: `extractFromWebsite` reescrita para (a) extrair e validar metadados do `<head>` antes de prosseguir, (b) descobrir e buscar até 3 links de seção da navegação, (c) retornar múltiplos `AggregatedItem` (home + seções), em vez de só um.
- Duas novas funções puras extraídas para serem testáveis sem rede: uma que decide se os metadados do `<head>` indicam um site de conteúdo real, e uma que filtra/seleciona os links de seção candidatos a partir do HTML já carregado.

## Fora de Escopo
- Casar tópicos de interesse do usuário com seções específicas do site (ex.: tentar achar a seção "Inteligência Artificial") — decisão confirmada com o usuário: seções gerais bastam, a IA já escolhe qual referência citar em cada resumo (spec 009), sem precisar de lógica de correspondência por palavra-chave, que seria frágil para tópicos que não têm uma seção de menu correspondente.
- Buscar artigos individuais dentro de uma seção (ex.: seguir um link de dentro da página de "Esportes" até uma notícia específica) — permanece fora de escopo; uma seção geral já é aceitável como referência (decisão confirmada com o usuário).
- Qualquer mudança em fontes `rss` ou no tratamento de fontes `twitter` (continuam não suportadas).
- Qualquer mudança no prompt da IA ou nas regras de fidelidade/citação já estabelecidas nas specs 009/ADR 0007 — esta spec só melhora os dados de entrada (mais itens, com URLs mais específicas), reaproveitando o mecanismo de citação e o filtro `filterKnownReferences` já existentes sem alteração.
- Fontes `website` já cadastradas não são revalidadas retroativamente — a verificação de "site de conteúdo real" só roda a cada execução do Cron, não altera nada já persistido.

## Dados (Data Dictionary)
Nenhum campo novo em `users/{uid}` nem em `Digest`. `AggregatedItem` (estrutura interna, spec 009) continua `{ text, url }` — esta spec só muda quantos itens uma fonte `website` produz (de 1 para até 4: home + até 3 seções), não a forma do item.

## Requisitos Funcionais (Testáveis)

### US1 — Validar que a Fonte é um Site de Conteúdo Real (Priority: P1)
RF-1: Antes de agregar qualquer conteúdo de uma fonte `website`, o sistema MUST verificar se a página tem metadados de SEO típicos de um site de conteúdo (título, e ao menos um entre: meta descrição, tags Open Graph, dados estruturados JSON-LD).
- Aceitação: Uma fonte apontando para uma página sem título nem nenhum desses metadados é rejeitada antes de qualquer resumo ser gerado a partir dela.

RF-2: Uma fonte `website` que falhar na verificação de metadados MUST ser tratada como uma falha isolada dessa fonte — as demais fontes do mesmo usuário continuam sendo agregadas normalmente.
- Aceitação: Um usuário com uma fonte inválida e uma fonte válida ainda recebe um digest usando o conteúdo da fonte válida, sem erro visível relacionado à fonte inválida.

### US2 — Extrair Seções Reais como Referências (Priority: P1)
RF-3: Para uma fonte `website` que passar na validação, o sistema MUST tentar descobrir até 3 links de seção a partir da navegação da página (ex.: menu principal), excluindo a URL raiz e domínios externos.
- Aceitação: Para um site de notícias real com um menu de navegação típico, ao menos uma URL de seção diferente da raiz é identificada como candidata.

RF-4: Cada link de seção candidato MUST ser buscado de forma isolada — uma falha ao buscar uma seção específica MUST NOT impedir que as demais seções (ou a página inicial) sejam usadas.
- Aceitação: Se uma das até 3 seções candidatas falhar ao ser buscada (timeout, erro HTTP), as outras seções bem-sucedidas e a página inicial ainda geram itens de agregação normalmente.

RF-5: Cada seção buscada com sucesso MUST virar um item de agregação próprio, com sua URL real de seção (não a raiz do site).
- Aceitação: Um digest gerado a partir de uma fonte `website` com seções descobertas pode conter referências apontando para URLs de seção específicas, não só para a raiz.

RF-6: A página inicial MUST continuar sendo incluída como um item de agregação, independente de seções terem sido encontradas ou não.
- Aceitação: Mesmo quando nenhuma seção é descoberta (ex.: site sem menu de navegação identificável), a fonte `website` ainda contribui pelo menos o item da página inicial, como acontece hoje.

RF-7: Nenhuma URL fora do conjunto de itens realmente agregados (home + seções encontradas) MUST chegar a ser citada como referência — garantia já existente (`filterKnownReferences`, spec 009) permanece válida sem alteração, agora sobre um conjunto maior de URLs candidatas reais.
- Aceitação: Toda referência num digest gerado a partir de uma fonte `website` corresponde exatamente à URL da home ou de uma das seções de fato buscadas naquela execução.

## Critérios de Sucesso
- SC-1: Fontes `website` que não parecem sites de conteúdo real (sem metadados de SEO básicos) nunca chegam a gerar uma chamada de IA baseada no seu conteúdo.
- SC-2: Para a maioria dos sites de notícias reais configurados como fonte `website`, os digests gerados passam a citar ao menos uma URL de seção específica, não só a raiz, em algum momento ao longo de múltiplas gerações.
- SC-3: Uma falha ao buscar uma seção específica nunca impede a geração do restante do digest.
- SC-4: 100% das referências de fontes `website` continuam sendo URLs reais e conhecidas — nenhuma alucinada (garantia herdada da spec 009, não regride).

## Cenários de Aceitação
1. Cenário: Fonte válida com seções
   - Dado um usuário com uma fonte `website` de um site de notícias real, com menu de navegação
   - Quando o digest é gerado
   - Então a fonte contribui a página inicial e até 3 itens de seção, cada um com sua própria URL

2. Cenário: Fonte sem metadados de SEO
   - Dado um usuário com uma fonte `website` apontando para uma página sem título nem metadados de SEO reconhecíveis
   - Quando o digest é gerado
   - Então essa fonte é descartada como uma falha isolada, sem impedir a geração do digest a partir das demais fontes

3. Cenário: Falha ao buscar uma seção específica
   - Dado uma fonte `website` válida cuja página inicial lista uma seção que retorna erro HTTP ao ser buscada
   - Quando o digest é gerado
   - Então as demais seções e a página inicial ainda geram itens normalmente, sem interromper a agregação

4. Cenário: Site sem seções identificáveis
   - Dado uma fonte `website` válida cuja navegação não tem links de seção reconhecíveis
   - Quando o digest é gerado
   - Então a fonte ainda contribui ao menos o item da página inicial, como acontecia antes desta spec

## Entidades Chave
- `AggregatedItem` — já definida na spec 009 (`{ text, url }`); esta spec só muda a cardinalidade de itens que uma fonte `website` produz.

## Assunções
- A verificação "é um site de conteúdo real" é feita inteiramente em código (parsing do `<head>`), não pedindo à IA para julgar — decisão consistente com o princípio já estabelecido na ADR 0007 (garantias verificáveis MUST ser aplicadas em código, não só por instrução de prompt), e mais barata (sem custo de tokens).
- "Seção correspondente ao tema de interesse do usuário" (pedido original) foi simplificado para "seções gerais descobertas na navegação, sem correspondência por palavra-chave com os tópicos do usuário" — decisão confirmada com o usuário antes desta spec, para evitar uma lógica de matching frágil (tópicos como "Inteligência Artificial" raramente têm uma seção de menu com esse nome exato).
- "Não precisa ser a reportagem específica, mas pelo menos uma seção" (confirmado com o usuário) — esta spec para no nível de seção, sem seguir links de dentro de uma seção até artigos individuais.
- Até 3 seções por fonte `website` (confirmado com o usuário) — equilíbrio entre variedade de referências e o custo/latência de requisições HTTP adicionais por fonte.
- O isolamento de falhas por seção reaplica o mesmo padrão de duas camadas de `Promise.allSettled` já estabelecido e documentado como "modelo a seguir para qualquer processamento em lote futuro" na ADR 0004 — não introduz um padrão arquitetural novo, então não é esperado que exija uma ADR nova (a confirmar em `plan.md`).

## Dependências
- Conclusão da spec 007 (`scraperService`, `Source`) e da spec 009 (`AggregatedItem`, `filterKnownReferences`, referências citáveis).
- Nenhuma dependência nova de biblioteca — `cheerio` (já em uso) é suficiente para parsear metadados do `<head>` e links de navegação.

## Riscos e Mitigações
- Risco: a verificação de metadados de SEO pode ter falsos negativos (um site de notícias real, mas com HTML incomum, sem os metadados típicos) e ser rejeitado indevidamente.
  - Mitigação: aceito como limitação conhecida — a fonte rejeitada falha graciosamente (mesmo tratamento de uma fonte com erro de rede), sem quebrar o restante do digest; o usuário pode notar isso e trocar a fonte se for um caso real.
- Risco: a heurística de descoberta de seções pode capturar links que não são seções de conteúdo de verdade (ex.: "Assine", "Login", ícones de redes sociais).
  - Mitigação: filtro explícito por lista de palavras conhecidas de páginas não-editoriais (login, cadastro, assinatura, contato, termos, privacidade, sobre, busca) e por domínio (só mesmo domínio da fonte) — reduz, mas não elimina 100%, falsos positivos; aceito como heurística razoável para o escopo deste projeto.
- Risco: mais requisições HTTP por fonte `website` (até 4 no total: home + 3 seções) aumenta a chance de alguma fonte demorar mais ou falhar parcialmente.
  - Mitigação: RF-4 exige isolamento por seção (`Promise.allSettled`), mesmo padrão de resiliência já validado em produção (ADR 0004) — uma seção lenta/quebrada nunca derruba a fonte inteira nem o digest do usuário.

## Artefatos Criados
- `specs/014-secoes-website/spec.md`
- `.specify/feature.json` apontando para `specs/014-secoes-website`

## Próximos Passos
- Escrever `checklists/requirements.md` e autovalidar.
- `plan.md` com as funções exatas de validação de metadados e descoberta de seções.
- `tasks.md`.
- Implementar.

*Gerado em: 2026-08-01*
