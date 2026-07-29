# ADR 0005: Assinatura em tempo real, paginação por cursor e renderização segura de markdown gerado por IA

**Status**: Accepted
**Data**: 2026-07-29 (spec 008)
**Specs relacionadas**: 004, 007, 008

## Contexto

A spec 008 entregou a primeira interface de leitura do produto (`/dashboard` e `/history`), introduzindo três padrões que não existiam em nenhuma spec anterior: (1) o dashboard precisa refletir a conclusão do Cron Job (spec 007) sem exigir reload manual; (2) `/history` precisa listar um número potencialmente grande de digests sem buscar a coleção inteira; e (3) o texto gerado pela IA (`content.intro`/`content.sections[].summary`, spec 007) precisa ser exibido formatado (negrito, parágrafos), não como markdown bruto — mas é conteúdo gerado por um modelo de linguagem, não escrito por um desenvolvedor confiável.

## Decisão

**Assinatura em tempo real com `onSnapshot`**: o dashboard assina (não busca uma vez) o digest mais recente do usuário (`orderBy("createdAt", "desc")`, `limit(1)`), assim a transição de `processing` para `completed`/`failed` aparece automaticamente enquanto a página está aberta. O listener é cancelado (`unsubscribe()`) no `useEffect` de limpeza, evitando vazamento de assinatura ao navegar para outra página.

**Paginação por cursor do Firestore em `/history`**: em vez de buscar toda a subcoleção `digests` de um usuário, cada página usa `limit(PAGE_SIZE)` com `startAfter(cursor)` a partir do último documento já carregado, acionada por um botão "Carregar mais" explícito (não scroll infinito automático).

**Renderização de markdown com configuração padrão, sem plugins de HTML bruto**: `react-markdown` é usado sem `rehype-raw` ou qualquer plugin que interprete HTML embutido no texto. Como o conteúdo vem do modelo de IA (não de um usuário autenticado nem de um desenvolvedor), ele é tratado como não confiável por padrão — a configuração padrão do `react-markdown` já não renderiza HTML bruto, então a decisão aqui é justamente *não* adicionar nada que abrisse essa superfície.

## Alternativas Consideradas

- **Buscar o digest mais recente uma única vez (`getDoc`) com polling manual ou exigir reload**: rejeitada — o usuário abriria a dashboard, veria o skeleton, e precisaria ficar recarregando a página manualmente para saber se o digest ficou pronto. `onSnapshot` é a forma nativa do Firestore de resolver exatamente esse problema sem polling.
- **Scroll infinito automático (`IntersectionObserver`) em `/history`**: rejeitada em favor do botão "Carregar mais" — mesmo resultado funcional (carregamento em lotes), com menos complexidade de implementação e teste para o volume de digests esperado neste projeto.
- **Paginação por offset/número de página**: rejeitada — o Firestore não suporta `OFFSET` eficiente (precisaria ler e descartar todos os documentos anteriores a cada página); cursores (`startAfter`) são o mecanismo nativo e eficiente do Firestore para esse padrão.
- **Habilitar `rehype-raw` para permitir formatação mais rica (ex.: se a IA gerar HTML)**: rejeitada — o prompt de sistema (spec 007) já pede explicitamente markdown simples, e habilitar interpretação de HTML embutido em texto gerado por um LLM é uma superfície de XSS desnecessária para o ganho (a IA não precisa de HTML, markdown já cobre negrito/itálico/listas/parágrafos).

## Consequências

- Cada usuário com a dashboard aberta mantém uma assinatura ativa (`onSnapshot`) enquanto a página estiver montada — leituras adicionais no Firestore comparado a uma busca única, aceitável no volume atual do projeto; se o número de usuários simultâneos crescer muito, vale revisitar (ex.: reduzir para long-polling manual após a primeira conclusão).
- `/history` nunca imprime "página 3 de 12" ou permite pular direto para uma página arbitrária — apenas avançar sequencialmente a partir do cursor atual. Aceitável para um histórico cronológico, onde navegação sequencial é o caso de uso natural.
- Qualquer conteúdo textual futuro gerado por IA e exibido na UI (não só digests) deve seguir o mesmo princípio: `react-markdown` (ou equivalente) sem plugins de HTML bruto, tratando a saída do modelo como não confiável por padrão.
- O padrão de paginação por cursor (`startAfter` + `limit`) é o modelo a seguir para qualquer outra listagem futura no projeto que precise evitar buscar coleções inteiras de uma vez.
