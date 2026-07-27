# AI Digest Aggregator

Aplicação inicial em Next.js com App Router, TypeScript e Tailwind para o AI Digest Aggregator.

## Como executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.local.example` para `.env.local` e preencha os valores necessários.
3. Execute `npm run dev` e abra `http://localhost:3000`.

## Configuração de ambiente

O arquivo `.env.local` deve conter as variáveis Firebase e OpenAI. Não commite esse arquivo.

## Funcionalidades atuais

- Landing page do produto
- Fluxo de login com Google
- Proteção de rotas privadas
- Criação automática de perfil do usuário no Firestore
- Página `/settings` para editar tópicos, fontes de informação, horário de recebimento e customização de prompt, com validação via `react-hook-form` + `zod` e cálculo automático de `schedule.targetHourUTC`
- Cabeçalho compartilhado (`AppHeader`) nas páginas autenticadas, com navegação entre Dashboard/Configurações e logout
- Alternância de tema claro/escuro disponível em toda a aplicação, com preferência persistida e paleta baseada nos tokens de cor do Material Design 3 (`src/app/globals.css`)
