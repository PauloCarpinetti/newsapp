# ADR 0003: Tokens de cor semânticos do Material Design 3 para o tema claro/escuro

**Status**: Accepted
**Data**: 2026-07-27 (retroativa — decisão tomada na spec 004, 2026-07-25)
**Specs relacionadas**: 001, 002, 003, 004

## Contexto

As specs 001-003 usaram classes utilitárias do Tailwind (`bg-slate-950`, `text-cyan-400`, `text-rose-400`, `text-emerald-400` etc.) hardcoded diretamente no JSX de cada página. A spec 004 precisava adicionar alternância de tema claro/escuro — inviável com cores hardcoded, já que cada referência de cor exigiria uma classe condicional por tema, espalhada por todo o código.

## Decisão

Definir variáveis CSS customizadas em `src/app/globals.css` para os papéis de cor semânticos do Material Design 3 (`primary`, `secondary`, `tertiary`, `error`, `surface`, `background`, `outline`, e os pares `on-*`/`container` correspondentes) — um conjunto no `:root` para o tema claro, e uma sobrescrita em `:root[data-theme="dark"]` para o escuro. Essas variáveis são mapeadas para nomes de cor do Tailwind via `theme.extend.colors` em `tailwind.config.ts`, usando a estratégia `darkMode` baseada em seletor (`["selector", '[data-theme="dark"]']`, suportada desde o Tailwind 3.4). A paleta exata foi derivada da identidade visual já usada pelo projeto (fundo escuro neutro + acento ciano/teal), não da paleta "baseline" genérica do Material 3.

## Alternativas Consideradas

- **Variante `dark:` do Tailwind com pares de cor hardcoded por elemento**: rejeitada — não escala (cada elemento precisaria de duas decisões de cor) e não dá uma fonte única de verdade para a paleta.
- **Biblioteca de design system completa (ex. Material UI)**: rejeitada por ser desproporcional para um app pequeno já construído diretamente sobre Tailwind.
- **Adotar a paleta "baseline" padrão do Material 3 (roxo)**: rejeitada para preservar a identidade visual já estabelecida nas specs 001-003.

## Consequências

- Toda UI nova ou migrada MUST usar as classes baseadas em token (`bg-surface`, `text-on-surface`, `bg-primary text-on-primary` etc.) em vez das cores brutas do Tailwind — reforçado nas specs 005/006.
- Foi necessário adicionar uma pequena camada de reset sobre o Preflight do Tailwind (`color-scheme` por tema, `::selection`, `:focus-visible`) para que controles nativos de formulário (`<select>`, `<input type="time">`, já usados em `/settings`) sigam o tema correto.
- Um script inline anti-flash no `<head>` do `layout.tsx` aplica o tema salvo (`localStorage`, com fallback para `prefers-color-scheme`) antes da hidratação, evitando flash do tema errado — exige `suppressHydrationWarning` no `<html>` para o mismatch esperado entre server e client.
