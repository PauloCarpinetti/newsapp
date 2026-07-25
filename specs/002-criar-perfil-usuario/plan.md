# Implementation Plan: Autenticação e Criação de Perfil de Usuário

**Branch**: `002-criar-perfil-usuario` | **Date**: 2026-07-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-criar-perfil-usuario/spec.md`

## Summary

Implementar o fluxo de autenticação com Google e criar automaticamente o documento de perfil de usuário em Firestore. O foco é fornecer um contexto de autenticação client-side reutilizável, proteger rotas privadas e assegurar que novos usuários recebam um perfil inicial com `config` e `schedule` prontos para suportar futuros digests.

## Technical Context

**Language/Version**: TypeScript com Next.js App Router e React 18+.

**Primary Dependencies**: `firebase` para autenticação e Firestore client-side, `next`, `react`, `typescript`, `lucide-react`.

**Storage**: Firestore usando a coleção `users` para perfis de usuário e a subcoleção `users/{uid}/digests` para histórico de digests.

**Testing**: Validação local manual do fluxo de autenticação, criação de perfil e redirecionamento. Planejamento de testes unitários futuros com Firebase mocks.

**Target Platform**: Web app Next.js para browser moderno, implementado em App Router.

**Project Type**: Web application full-stack com integração cliente Firebase e preparação para backend protegido.

**Performance Goals**: Evitar leituras redundantes no cliente usando `AuthContext`, manter o login leve e minimizar o tempo até a primeira exibição da interface após autenticação.

**Constraints**: O fluxo de autenticação deve usar o SDK client-side do Firebase. Segredos e credenciais devem permanecer em `.env.local` e não deverão ser comitados.

**Scale/Scope**: Perfil inicial de usuário para suportar digests individuais e rotinas de agendamento; não inclui a implementação completa de histórico de digests ou backend de conversão de horários.

## Constitution Check

- O plano mantém autenticação client-side para login e adia operações sensíveis de backend para fases posteriores.
- O modelo Firestore segue a orientação de leitura da constituição, colocando perfis em `users` e digests em subcoleções.
- **Gate**: PASS. A única ressalva é que `targetHourUTC` é inicializado no cliente por simplicidade, com responsabilidade futura de backend documentada como fora do escopo.

## Project Structure

### Documentation (this feature)

```text
specs/002-criar-perfil-usuario/
├── plan.md
├── spec.md
└── checklists/
    ├── requirements.md
    └── specs.md
```

### Source Code

```text
src/
├── app/
│   └── login/page.tsx
├── components/
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx
└── lib/
    └── firebase/
        ├── auth.ts
        └── config.ts
```

**Structure Decision**: Manter a aplicação como um único projeto Next.js com diretório `src/`, adicionando serviços Firebase sob `src/lib/firebase`, contexto de autenticação em `src/contexts` e wrappers de rota em `src/components`.

## Complexity Tracking

Nenhuma violação de constituição identificada. O plano preserva a separação entre autenticação client-side e operações backend futuras.
