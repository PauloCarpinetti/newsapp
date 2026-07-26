# Implementation Plan: Preferências de Conteúdo e Agendamento do Usuário

**Branch**: `003-preferencias-usuario` | **Date**: 2026-07-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-preferencias-usuario/spec.md`

## Summary

Criar a página protegida `/settings`, onde o usuário edita tópicos, fontes de informação, horário local e customização de prompt. O formulário usa `react-hook-form` + `zodResolver` sobre um schema Zod dedicado (`settingsSchema.ts`), carrega os valores atuais de `users/{uid}` ao montar, e ao salvar recalcula `schedule.targetHourUTC` com um utilitário puro (`calculateTargetHourUTC`) antes de persistir via `updateDoc`. `settingsSchema.ts` e `calculateTargetHourUTC` recebem testes unitários com `vitest`, já instalado desde a spec 001.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router e React 18+ (mesma base das specs 001/002).

**Primary Dependencies**: `react-hook-form`, `zod`, `@hookform/resolvers/zod`, `lucide-react` (todos já instalados desde a spec 001), `firebase` (Firestore client) e os artefatos de auth da spec 002 (`AuthContext`, `ProtectedRoute`, `firebase/config`).

**Storage**: Firestore, atualizando os mapas `config` e `schedule` do documento `users/{uid}` já criado pela spec 002 (nenhuma coleção ou documento novo).

**Testing**: `vitest` (já configurado em `package.json` como `npm test`) para testes unitários de `settingsSchema.ts` e `calculateTargetHourUTC`. A página `settings/page.tsx` continua validada manualmente, seguindo o mesmo padrão das specs 001/002.

**Target Platform**: Web app Next.js para navegador moderno, App Router, mesma stack das specs anteriores.

**Project Type**: Web application full-stack, com esta feature concentrada no client-side (formulário + leitura/escrita direta no Firestore client SDK).

**Performance Goals**: Carregamento do formulário deve refletir os dados existentes sem travar a UI; cálculo de `targetHourUTC` é síncrono e instantâneo (sem chamadas de rede).

**Constraints**: Não introduzir novos campos no dicionário de dados de `users/{uid}`; usar `updateDoc` com notação de ponto para não sobrescrever `uid`, `email` ou `createdAt`; manter a aproximação client-side de `targetHourUTC` (sem tratamento de DST, conforme já assumido na spec 002).

**Scale/Scope**: Uma página (`/settings`) e dois módulos utilitários puros; sem novas rotas de API nem alterações no backend.

## Constitution Check

- A feature mantém toda a lógica sensível (leitura/escrita do perfil) client-side, autenticada via `AuthContext`/`ProtectedRoute` já existentes — consistente com a fundação de segurança da spec 002.
- `settingsSchema.ts` e `time.ts` são módulos puros e isolados, facilitando manutenção e testes conforme o Princípio III (Manutenibilidade e Clareza).
- Os testes unitários exigidos no RF-7/CS-4 do spec atendem ao Princípio V (requisitos e critérios de aceitação testáveis) com verificação automatizada, além da validação manual já praticada.
- **Gate**: PASS. Nenhuma violação identificada; a aproximação client-side de `targetHourUTC` já está documentada como decisão aceita (fora de escopo) desde a spec 002.

## Project Structure

### Documentation (this feature)

```text
specs/003-preferencias-usuario/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code

```text
src/
├── app/
│   └── settings/
│       └── page.tsx
├── lib/
│   ├── schemas/
│   │   ├── settingsSchema.ts
│   │   └── settingsSchema.test.ts
│   └── utils/
│       ├── time.ts
│       └── time.test.ts
```

**Structure Decision**: Os testes ficam colocados junto aos módulos que cobrem (`*.test.ts` ao lado do arquivo fonte), seguindo o padrão de include default do `vitest` já configurado em `package.json` — sem necessidade de um diretório `tests/` separado ou de configuração adicional do vitest.

## Complexity Tracking

Nenhuma violação de constituição identificada. A feature reaproveita toda a infraestrutura de auth/Firestore das specs 001/002 e adiciona apenas módulos puros + uma página client-side.
