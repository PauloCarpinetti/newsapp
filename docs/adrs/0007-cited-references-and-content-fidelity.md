# ADR 0007: Referências citáveis com filtro defensivo e fidelidade de conteúdo forçada em código

**Status**: Accepted

**Data**: 2026-07-31

**Specs relacionadas**: 007, 009

## Contexto

A spec 009 estendeu o pipeline de geração de digests (spec 007) em duas frentes: resumos por tópico mais detalhados, e até 3 referências (URLs reais) por tópico. Isso exigiu resolver dois riscos de fidelidade ao conteúdo, um antecipado no design e outro só descoberto ao vivo em produção logo depois do primeiro merge:

1. **Referências inventadas**: até a spec 009, `scraperService.aggregateSources` concatenava o texto de todas as fontes numa única string, descartando qualquer URL de origem — não havia como citar uma fonte real mesmo se quiséssemos. Preservar a URL por item é pré-requisito pra qualquer citação confiável, mas isso sozinho não impede o modelo de citar uma URL que pareça real mas não esteja de fato entre as fornecidas.
2. **Conteúdo de seção inventado** (achado ao vivo, não antecipado no `plan.md` original): com uma fonte fraca (uma única página de site, ~3000 caracteres de manchetes genéricas) e vários tópicos configurados pelo usuário, o pedido de resumo "mais detalhado" da spec 009 levou o modelo a preencher tópicos sem cobertura real com conhecimento geral dele (treinamento), em vez de admitir que não havia conteúdo suficiente — uma seção inteira sobre um clube de futebol, outra sobre Fórmula 1 e IA, nenhuma das duas com qualquer base real no texto agregado daquele digest.

Em ambos os casos, uma instrução em linguagem natural no prompt ("nunca invente", "seja fiel ao conteúdo") não é uma garantia — é uma preferência que o modelo pode ignorar sob pressão de outra instrução (como "seja mais detalhado").

## Decisão

**Agregação estruturada com URL por item**: `scraperService.aggregateSources` retorna `AggregatedItem[]` (`{ text, url }`) em vez de uma string única — RSS preserva `item.link` por notícia, website preserva a URL da própria fonte cadastrada. Essa estrutura é formatada explicitamente no prompt (`formatItemsForPrompt`, um bloco `[Fonte N] / URL: ... / texto` por item), dando ao modelo a lista real de candidatas a citação.

**Filtro defensivo em código, não só instrução de prompt**: depois da resposta da IA, `filterKnownReferences` remove de `sections[].references` qualquer URL que não esteja literalmente entre as URLs conhecidas dos itens agregados daquele digest, além de aplicar o teto de 3 por seção. O prompt instrui o modelo a se comportar assim, mas a garantia real — a que efetivamente chega no Firestore e na UI — vem desse filtro em código, não da complacência do modelo.

**Fidelidade de conteúdo como restrição primária do prompt, com permissão explícita pra omitir seções**: reordenado o system prompt pra declarar "baseie-se exclusivamente no conteúdo fornecido, nunca conhecimento geral" *antes* do pedido de mais detalhe (não depois, como na primeira versão da spec 009) — e adicionada a instrução explícita de que gerar uma seção por tópico não é obrigatório: se o conteúdo agregado não cobre um tópico de interesse do usuário, a seção correspondente simplesmente não é criada, em vez de preenchida com generalidades ou detalhes plausíveis, porém inventados.

## Alternativas Consideradas

- **Confiar só na instrução de prompt para as referências** (sem `filterKnownReferences`): rejeitada desde o design original da spec 009 — uma instrução de linguagem natural não é uma garantia verificável, e o custo de implementar o filtro é baixo (uma função pura, testada unitariamente).
- **Limitar tokens/comprimento da resposta como forma indireta de conter a fabricação de conteúdo**: rejeitada — reduzir o limite de tokens não distingue entre "resumo detalhado e fiel" e "resumo detalhado e inventado"; o problema é de fidelidade, não de tamanho, então a correção precisa mirar fidelidade diretamente (ordem/conteúdo da instrução), não um proxy indireto.
- **Validar o conteúdo do resumo contra o texto de origem via um segundo modelo (LLM-as-judge) ou correspondência textual**: considerada e descartada por ora — desproporcional para o volume atual do projeto (estudo de caso solo) e não há um caso de negócio que justifique o custo/latência extra de uma segunda chamada de IA por digest; a mitigação de prompt (fidelidade primária + permissão de omitir) resolveu o caso real observado sem essa complexidade.

## Consequências

- Referências exibidas na UI têm garantia de código de serem URLs reais das fontes do usuário — nunca alucinadas — independente de quão bem o modelo segue a instrução do prompt.
- Um digest pode legitimamente ter menos seções do que tópicos configurados pelo usuário, quando as fontes cadastradas não cobrem todos eles — esse é o comportamento correto, não um bug; documentado aqui pra não ser "corrigido" no futuro por engano forçando geração de conteúdo sem base.
- A fidelidade do *conteúdo* do resumo (diferente da fidelidade das *referências*) ainda depende inteiramente da instrução de prompt — não há, como há para as referências, uma verificação em código que compare o resumo gerado contra o texto de origem. Aceito como limitação conhecida por ora (ver "Alternativas Consideradas"); se recorrer com fontes mais fortes/verbosas, vale revisitar.
- Este é o padrão a seguir para qualquer geração de conteúdo por IA futura neste projeto: quando uma garantia é verificável em código (como "essa URL existe na entrada"), ela MUST ser aplicada em código — uma instrução de prompt sozinha é tratada como preferência, não como garantia.
