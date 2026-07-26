# Implementation Plan: Navegação Compartilhada, Tema Claro/Escuro e Base Visual (Material Design 3)

**Branch**: `004-navegacao-compartilhada` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-navegacao-compartilhada/spec.md`

## Summary

Adicionar `AppHeader` (navegação + logout nas páginas autenticadas), um CTA de login na landing page, um `ThemeToggle` global com persistência em `localStorage` e fallback para `prefers-color-scheme`, e uma base visual em `globals.css` com tokens de cor semânticos do Material Design 3 (claro/escuro) que substituem as classes Tailwind hardcoded (`bg-slate-950`, `text-cyan-400` etc.) usadas hoje em `page.tsx`, `login/page.tsx`, `dashboard/page.tsx` e `settings/page.tsx`.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router e React 18+ (mesma base das specs 001-003).

**Primary Dependencies**: Nenhuma dependência nova — `lucide-react` (já instalado) fornece os ícones `Sun`/`Moon`/`LogOut`; tema e cores são resolvidos só com Tailwind (`darkMode` por seletor, já suportado pela versão 3.4.19 instalada) e CSS custom properties nativas.

**Storage**: Nenhuma mudança no Firestore. Preferência de tema em `localStorage` (client-only, por navegador).

**Testing**: A lógica de resolução do tema inicial (`localStorage` vs. `prefers-color-scheme`) é extraída como função pura em `src/lib/utils/theme.ts`, seguindo o padrão de `time.ts` (spec 003), mas sem exigência de teste automatizado nesta spec — validação manual dos 6 cenários de aceitação, como nas specs 001/002.

**Target Platform**: Web app Next.js para navegadores modernos evergreen (Chromium e Firefox como referência mínima para o RF-10/SC-6).

**Project Type**: Web application full-stack, com esta feature concentrada em UI/client-side (nenhuma rota de API nova).

**Performance Goals**: Aplicar o tema salvo antes da primeira pintura, evitando o "flash" de tema errado (FOUC) ao carregar qualquer página.

**Constraints**: Não introduzir bibliotecas de UI/tema novas; reaproveitar a identidade visual já usada (fundo escuro neutro + acento ciano/teal) ao derivar a paleta MD3, em vez de adotar a paleta "baseline" genérica do Material 3.

**Scale/Scope**: Um cabeçalho, um botão de tema, ~7 variáveis de cor por papel semântico (x2 temas) e a migração de 4 páginas já existentes para consumi-las.

## Constitution Check

- Toda a lógica de tema roda no client (leitura de `localStorage`/`matchMedia`, escrita de atributo em `<html>`); nenhuma operação sensível ou credencial envolvida — consistente com o Princípio II.
- `AppHeader` centraliza logout e navegação em um único componente reutilizado, e `theme.ts` isola a lógica de resolução de tema como função pura — consistente com o Princípio III (Manutenibilidade).
- Migrar cores hardcoded para tokens CSS é uma redução de complexidade futura (uma fonte de verdade para cor), não um aumento — nenhuma justificativa de `Complexity Tracking` necessária.
- **Gate**: PASS. Nenhuma violação identificada.

## Project Structure

### Documentation (this feature)

```text
specs/004-navegacao-compartilhada/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   ├── layout.tsx           # script inline anti-flash + <ThemeToggle /> global
│   ├── globals.css          # tokens MD3 (:root + [data-theme="dark"]) + reset
│   ├── page.tsx              # landing: CTA de login + cores MD3
│   ├── login/page.tsx        # cores MD3
│   ├── dashboard/page.tsx    # <AppHeader /> + cores MD3
│   └── settings/page.tsx     # <AppHeader /> + cores MD3
├── components/
│   ├── AppHeader.tsx          # novo
│   └── ThemeToggle.tsx        # novo
└── lib/
    └── utils/
        └── theme.ts            # novo: resolveInitialTheme(stored, prefersDark)
tailwind.config.ts               # darkMode por seletor + mapeamento de cores MD3
```

**Structure Decision**: `AppHeader` fica em `src/components` (mesmo nível de `ProtectedRoute`, já existente), renderizado apenas dentro das páginas autenticadas — nunca no layout raiz, para não vazar para `/` e `/login` (RF-5). `ThemeToggle`, ao contrário, é montado uma vez em `layout.tsx` porque é global por natureza.

## Decisões Técnicas

### 1. Tokens de cor MD3 (`tailwind.config.ts` + `globals.css`)

`tailwind.config.ts` mapeia nomes semânticos para variáveis CSS, permitindo usar classes como `bg-surface`, `text-on-surface`, `bg-primary text-on-primary`, `border-outline`:

```ts
theme: {
  extend: {
    colors: {
      primary: "var(--md-sys-color-primary)",
      "on-primary": "var(--md-sys-color-on-primary)",
      "primary-container": "var(--md-sys-color-primary-container)",
      "on-primary-container": "var(--md-sys-color-on-primary-container)",
      secondary: "var(--md-sys-color-secondary)",
      "on-secondary": "var(--md-sys-color-on-secondary)",
      "secondary-container": "var(--md-sys-color-secondary-container)",
      "on-secondary-container": "var(--md-sys-color-on-secondary-container)",
      tertiary: "var(--md-sys-color-tertiary)",
      "on-tertiary": "var(--md-sys-color-on-tertiary)",
      "tertiary-container": "var(--md-sys-color-tertiary-container)",
      "on-tertiary-container": "var(--md-sys-color-on-tertiary-container)",
      error: "var(--md-sys-color-error)",
      "on-error": "var(--md-sys-color-on-error)",
      "error-container": "var(--md-sys-color-error-container)",
      "on-error-container": "var(--md-sys-color-on-error-container)",
      background: "var(--md-sys-color-background)",
      "on-background": "var(--md-sys-color-on-background)",
      surface: "var(--md-sys-color-surface)",
      "on-surface": "var(--md-sys-color-on-surface)",
      "surface-variant": "var(--md-sys-color-surface-variant)",
      "on-surface-variant": "var(--md-sys-color-on-surface-variant)",
      outline: "var(--md-sys-color-outline)",
      "outline-variant": "var(--md-sys-color-outline-variant)",
    },
  },
},
darkMode: ["selector", '[data-theme="dark"]'],
```

Paleta derivada da identidade visual já usada (fundo escuro neutro + acento ciano/teal), estruturada nos papéis MD3, definida em `globals.css`:

```css
:root {
  --md-sys-color-primary: #006874;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #97f0ff;
  --md-sys-color-on-primary-container: #001f24;
  --md-sys-color-secondary: #4a6267;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #cde7ec;
  --md-sys-color-on-secondary-container: #051f23;
  --md-sys-color-tertiary: #52606e;
  --md-sys-color-on-tertiary: #ffffff;
  --md-sys-color-tertiary-container: #d5e4f7;
  --md-sys-color-on-tertiary-container: #0e1d29;
  --md-sys-color-error: #ba1a1a;
  --md-sys-color-on-error: #ffffff;
  --md-sys-color-error-container: #ffdad6;
  --md-sys-color-on-error-container: #410002;
  --md-sys-color-background: #fafdfd;
  --md-sys-color-on-background: #191c1d;
  --md-sys-color-surface: #fafdfd;
  --md-sys-color-on-surface: #191c1d;
  --md-sys-color-surface-variant: #dbe4e6;
  --md-sys-color-on-surface-variant: #3f484a;
  --md-sys-color-outline: #6f797a;
  --md-sys-color-outline-variant: #bfc8ca;
  color-scheme: light;
}

:root[data-theme="dark"] {
  --md-sys-color-primary: #4fd8eb;
  --md-sys-color-on-primary: #00363d;
  --md-sys-color-primary-container: #004f58;
  --md-sys-color-on-primary-container: #97f0ff;
  --md-sys-color-secondary: #b1cbd0;
  --md-sys-color-on-secondary: #1c3438;
  --md-sys-color-secondary-container: #334b4f;
  --md-sys-color-on-secondary-container: #cde7ec;
  --md-sys-color-tertiary: #b9c8d8;
  --md-sys-color-on-tertiary: #24323f;
  --md-sys-color-tertiary-container: #3a4856;
  --md-sys-color-on-tertiary-container: #d5e4f7;
  --md-sys-color-error: #ffb4ab;
  --md-sys-color-on-error: #690005;
  --md-sys-color-error-container: #93000a;
  --md-sys-color-on-error-container: #ffdad6;
  --md-sys-color-background: #0f1416;
  --md-sys-color-on-background: #e0e3e3;
  --md-sys-color-surface: #0f1416;
  --md-sys-color-on-surface: #e0e3e3;
  --md-sys-color-surface-variant: #3f484a;
  --md-sys-color-on-surface-variant: #bfc8ca;
  --md-sys-color-outline: #899294;
  --md-sys-color-outline-variant: #3f484a;
  color-scheme: dark;
}
```

`color-scheme` por tema garante que controles nativos do navegador (o `<select>` e o `<input type="time">` já usados em `settings/page.tsx`, além de scrollbars) sigam o tema atual em vez de ficarem sempre claros.

### 2. Sem "flash" de tema (FOUC)

Um `<script>` inline (não um módulo React) no `<head>` de `layout.tsx`, executado antes da hidratação, lê `localStorage.theme` (fallback `window.matchMedia('(prefers-color-scheme: dark)')`) e define `document.documentElement.dataset.theme` de forma síncrona. Esse script duplica, em JS puro mínimo, a mesma decisão que `resolveInitialTheme` implementa em TypeScript para o `ThemeToggle` — duplicação pequena e aceitável, já que um script bloqueante não pode importar um módulo bundlado antes da primeira pintura.

### 3. `ThemeToggle`

Componente client (`"use client"`) que, após montado, lê `document.documentElement.dataset.theme` (já definido pelo script inline) para saber o estado atual, e ao ser clicado alterna o atributo `data-theme` e persiste em `localStorage.theme`. Ícones `Sun`/`Moon` de `lucide-react` indicam o tema atual.

### 4. `AppHeader`

Componente client simples com `<Link>` para `/dashboard` e `/settings`, e um botão "Sair" que chama `logout()` (de `src/lib/firebase/auth.ts`) dentro de um handler que também usa `useRouter().replace("/login")` após a promessa resolver — mesmo padrão já usado em `login/page.tsx`.

### 5. Reset/normalização

Tailwind Preflight (`@tailwind base`) já cobre a maior parte do reset (box-sizing, margens de heading/lista, herança de fonte em controles de formulário). `globals.css` complementa apenas o que falta: `color-scheme` por tema (acima), uma regra `::selection` usando os tokens MD3, e um `outline` de foco consistente (`:focus-visible`) para acessibilidade e paridade entre navegadores.

## Complexity Tracking

Nenhuma violação de constituição identificada.
