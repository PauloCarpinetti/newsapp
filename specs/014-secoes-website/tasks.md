# Tasks: Seções Reais e Validação de Fontes Website

**Input**: Design documents from `/specs/014-secoes-website/`

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: As duas funções puras, testadas isoladamente, antes de tocar em `extractFromWebsite`.

**⚠️ CRITICAL**: Nenhum trabalho de US1/US2 pode começar até esta fase estar completa.

- [ ] T001 Add `looksLikeContentSite($): boolean` to `src/lib/services/scraperService.ts`: exige `<title>` não-vazio e ao menos um entre meta descrição, tag Open Graph, ou script JSON-LD.
- [ ] T002 [P] Write tests in `scraperService.test.ts` for `looksLikeContentSite`: título+descrição → true; título+OG → true; título+JSON-LD → true; sem título → false; título sozinho, sem os demais sinais → false.
- [ ] T003 Add `extractSectionLinks($, baseUrl): string[]` to `scraperService.ts`, com `MAX_SECTIONS = 3` e `BLOCKED_SECTION_KEYWORDS`: filtra links de `nav`/`header` por mesmo domínio, esquema http(s), exclui a raiz, caminho de 1-2 segmentos, exclui palavras bloqueadas, deduplica, corta em 3.
- [ ] T004 [P] Write tests in `scraperService.test.ts` for `extractSectionLinks`: retorna seções rasas válidas; exclui a própria raiz; exclui links externos; exclui links com palavra bloqueada (ex. `/login`); exclui caminhos profundos (ex. `/esportes/2026/08/01/titulo-do-artigo`); corta em 3 quando há mais de 3 candidatas válidas.
- [ ] T005 [P] Run `npm test` and confirm all new and existing suites pass.

**Checkpoint**: As duas funções de decisão estão corretas isoladamente, sem nenhuma mudança de comportamento em `extractFromWebsite` ainda.

---

## Phase 2: User Story - Validar que a Fonte é um Site de Conteúdo Real (Priority: P1)

**Goal**: Fontes sem metadados de SEO básicos são rejeitadas antes de gerar conteúdo a partir delas.

**Independent Test**: Uma fonte `website` apontando pra uma página sem `<title>`/metadados falha de forma isolada; as demais fontes do usuário continuam funcionando.

- [ ] T006 [US1] Wire `looksLikeContentSite` into `extractFromWebsite`: lançar `Error` claro se a validação falhar, antes de qualquer extração de texto (RF-1).
- [ ] T007 [US1] Manual validation: apontar uma fonte `website` pra uma URL sem metadados de SEO reais e confirmar que ela é descartada como falha isolada, sem impedir a geração do digest a partir das demais fontes do mesmo usuário (RF-1, RF-2).

**Checkpoint**: Cenário de aceitação 2 do spec passa.

---

## Phase 3: User Story - Extrair Seções Reais como Referências (Priority: P1)

**Goal**: Fontes `website` válidas passam a contribuir até 4 itens (home + até 3 seções), cada um com sua própria URL real.

**Independent Test**: Uma fonte `website` de um site de notícias real com menu de navegação produz múltiplos itens de agregação, cada um com URL distinta da raiz.

- [ ] T008 [US2] Add `fetchSection(url): Promise<AggregatedItem>` to `scraperService.ts`, com `MAX_CHARS_PER_SECTION = 1000`, mesma extração de texto já usada pela home.
- [ ] T009 [US2] Rewrite `extractFromWebsite`: descobrir seções (`extractSectionLinks`) sobre o `$` antes da remoção de `nav`/`header`; buscar cada seção isoladamente (`Promise.allSettled` + `console.warn` em rejeições, mesmo padrão de `aggregateSources`); retornar `[itemDaHome, ...itensDeSeçãoBemSucedidos]` (RF-3, RF-4, RF-5, RF-6).
- [ ] T010 [US2] Manual validation: fonte real com seções descobertas gera múltiplos itens com URLs distintas (RF-3, RF-5); forçar uma seção a falhar (ex. URL de seção incorreta) e confirmar que as demais e a home ainda geram itens normalmente (RF-4); fonte sem seções identificáveis ainda contribui ao menos o item da home (RF-6); nenhuma referência no digest final aponta pra fora do conjunto de URLs realmente agregadas (RF-7, reconfirma a garantia da spec 009 sobre um conjunto maior de candidatas).

**Checkpoint**: Cenários de aceitação 1, 3 e 4 do spec passam.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Ensure the feature is validated, documented, and consistent with the rest of the project.

- [ ] T011 [P] Add a note in `README.md`'s pipeline bullet describing that fontes `website` agora contribuem referências de seção, não só a raiz do site.
- [ ] T012 [P] Confirm `npx tsc --noEmit`, `npm run build`, `npm run lint`, and `npm test` all pass.
- [ ] T013 [P] Manual end-to-end validation of the 4 acceptance scenarios in spec.md, usando uma fonte `website` real (ex. a mesma usada nas validações da spec 009) — via chamada direta de `aggregateSources`/`generateDigestWithAI` (mesma técnica de script descartável já usada em specs anteriores) ou via o pipeline real.
