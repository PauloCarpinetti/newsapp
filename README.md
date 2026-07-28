# AI Digest Aggregator

Aplicação inicial em Next.js com App Router, TypeScript e Tailwind para o AI Digest Aggregator.

## Como executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.local.example` para `.env.local` e preencha os valores necessários.
3. Execute `npm run dev` e abra `http://localhost:3000`.

## Configuração de ambiente

O arquivo `.env.local` deve conter as variáveis Firebase e OpenAI. Não commite esse arquivo.

`FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` (chave de conta de serviço do Firebase Admin SDK — Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada) são obrigatórias para os endpoints `/api/settings` e `/api/auth/profile` funcionarem.

## Funcionalidades atuais

- Landing page do produto
- Fluxo de login com Google, com a criação do perfil do usuário no Firestore feita por um endpoint autenticado (`POST /api/auth/profile`, Firebase Admin SDK), não mais por escrita direta do client
- Proteção de rotas privadas
- Página `/settings` para editar tópicos (como tags, até 10), fontes de informação, horário de recebimento e customização de prompt, com validação via `react-hook-form` + `zod`
- Salvamento de preferências via `POST /api/settings`, um endpoint autenticado (Firebase Admin SDK) que calcula `schedule.targetHourUTC` no servidor
- Cabeçalho compartilhado (`AppHeader`) nas páginas autenticadas, com navegação entre Dashboard/Configurações e logout
- Alternância de tema claro/escuro disponível em toda a aplicação, com preferência persistida e paleta baseada nos tokens de cor do Material Design 3 (`src/app/globals.css`)
