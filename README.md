# AI Digest Aggregator

Aplicação inicial em Next.js com App Router, TypeScript e Tailwind para o AI Digest Aggregator.

## Como executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.local.example` para `.env.local` e preencha os valores necessários.
3. Execute `npm run dev` e abra `http://localhost:3000`.

## Configuração de ambiente

O arquivo `.env.local` deve conter as variáveis Firebase e OpenAI. Não commite esse arquivo.

`FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` (chave de conta de serviço do Firebase Admin SDK — Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada) são obrigatórias para os endpoints `/api/settings`, `/api/auth/profile` e `/api/cron/generate` funcionarem.

`OPENAI_API_KEY` é obrigatória para `/api/cron/generate` gerar digests. `CRON_SECRET` protege esse mesmo endpoint — gere um valor aleatório e configure-o também nas variáveis de ambiente do projeto na Vercel (o Cron nativo da Vercel injeta esse valor automaticamente no header `Authorization`).

## Funcionalidades atuais

- Landing page do produto
- Fluxo de login com Google, com a criação do perfil do usuário no Firestore feita por um endpoint autenticado (`POST /api/auth/profile`, Firebase Admin SDK), não mais por escrita direta do client
- Proteção de rotas privadas
- Página `/settings` para editar tópicos (como tags, até 10), fontes de informação, horário de recebimento e customização de prompt, com validação via `react-hook-form` + `zod`
- Salvamento de preferências via `POST /api/settings`, um endpoint autenticado (Firebase Admin SDK) que calcula `schedule.targetHourUTC` no servidor
- Cabeçalho compartilhado (`AppHeader`) nas páginas autenticadas, com navegação entre Dashboard/Configurações e logout
- Alternância de tema claro/escuro disponível em toda a aplicação, com preferência persistida e paleta baseada nos tokens de cor do Material Design 3 (`src/app/globals.css`)
- Pipeline de geração automática de digests (`GET /api/cron/generate`, protegido por `CRON_SECRET`, agendado a cada hora via `vercel.json`): agrega fontes RSS/website do usuário, gera um resumo estruturado via GPT-4o-mini e persiste em `users/{uid}/digests`, com isolamento de falhas por fonte/usuário e proteção contra reprocessamento duplicado
