# AI Digest Aggregator

Agregador de notícias e fontes pessoais que gera, todo dia no horário escolhido por cada usuário, um resumo (digest) personalizado via IA — a partir dos tópicos, fontes RSS/website e customizações de prompt que o próprio usuário configura. Login com Google, geração 100% automática (sem ação manual do usuário), leitura em tempo real no dashboard e histórico paginado dos digests anteriores.

Next.js (App Router) + TypeScript + Tailwind no frontend, Firebase (Auth + Firestore) para dados, GPT-4o-mini (OpenAI) para geração dos resumos. Rodando em produção na Vercel.

## Arquitetura de produção

- **Frontend + API routes**: Next.js na Vercel, deploy automático a cada push no `main` (integração nativa Vercel ↔ GitHub, sem workflow de deploy próprio).
- **Auth + dados**: Firebase Authentication (login Google) e Firestore, com [`firestore.rules`](firestore.rules) versionado no repo — veja "Regras de segurança do Firestore" abaixo.
- **Geração dos digests**: `GET /api/cron/generate`, protegido por `CRON_SECRET`, disparado a cada hora por um workflow do GitHub Actions (não pelo Cron nativo da Vercel) — veja "Disparo do Cron em produção" abaixo.
- **Decisões de arquitetura**: documentadas em [`docs/adrs/`](docs/adrs/) conforme tomadas (não é um changelog — só decisões com trade-offs reais).

## Como executar localmente

1. Instale as dependências com `npm install`.
2. Copie `.env.local.example` para `.env.local` e preencha os valores necessários.
3. Execute `npm run dev` e abra `http://localhost:3000`.

## Configuração de ambiente

O arquivo `.env.local` deve conter as variáveis Firebase e OpenAI. Não commite esse arquivo.

`FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` (chave de conta de serviço do Firebase Admin SDK — Firebase Console → Configurações do Projeto → Contas de Serviço → Gerar nova chave privada) são obrigatórias para os endpoints `/api/settings`, `/api/auth/profile` e `/api/cron/generate` funcionarem.

`OPENAI_API_KEY` é obrigatória para `/api/cron/generate` gerar digests. `CRON_SECRET` protege esse mesmo endpoint — gere um valor aleatório e configure-o também nas variáveis de ambiente do projeto na Vercel e como secret do GitHub Actions (veja "Disparo do Cron em produção" abaixo).

## Regras de segurança do Firestore

`firestore.rules` neste repositório é a fonte da verdade — o Firebase Console não deve ser editado diretamente sem refletir a mudança aqui primeiro. O padrão é: o client só lê os próprios documentos (`users/{uid}` e `users/{uid}/digests/{digestId}`); toda escrita passa por um endpoint autenticado do Next.js usando o Admin SDK, então a escrita direta do client é sempre negada.

Como este projeto não usa a Firebase CLI, a publicação é manual:

1. Copie o conteúdo de `firestore.rules`.
2. Firebase Console → projeto `newsapp-f4267` → Firestore Database → aba "Regras".
3. Cole substituindo o conteúdo atual e clique em "Publicar".

Se no futuro a Firebase CLI for instalada, `firebase deploy --only firestore:rules` publica a partir deste mesmo arquivo (o `.firebaserc` já aponta pro projeto correto).

## Disparo do Cron em produção

O plano Hobby da Vercel só dispara Cron Jobs nativos 1x/dia, mas o pipeline (`GET /api/cron/generate`) precisa rodar a cada hora para respeitar o `schedule.targetHourUTC` de cada usuário. Por isso o disparo horário em produção é feito por um workflow do GitHub Actions (`.github/workflows/cron-digest.yml`), sem depender de um bloco `crons` no `vercel.json` (removido — o projeto não usa Cron nativo da Vercel). O workflow chama a URL de produção com o header `Authorization: Bearer $CRON_SECRET`, usando dois secrets do repositório (`CRON_SECRET` e `PRODUCTION_URL`, em Settings → Secrets and variables → Actions → New repository secret).

Limitações conhecidas do GitHub Actions Scheduled Workflows (aceitáveis para este projeto, mas vale documentar):
- O agendamento é "melhor esforço" — em picos de carga da plataforma o disparo pode atrasar alguns minutos.
- O GitHub desativa automaticamente workflows agendados após 60 dias sem nenhum commit no branch padrão; reative em Actions → Cron - Gerar digests → "Enable workflow" se isso acontecer.
- `workflow_dispatch` está habilitado no workflow para disparo manual (aba Actions → Cron - Gerar digests → Run workflow), útil pra validar o pipeline sem esperar a próxima hora cheia.

## Funcionalidades atuais

- Landing page do produto
- Fluxo de login com Google, com a criação do perfil do usuário no Firestore feita por um endpoint autenticado (`POST /api/auth/profile`, Firebase Admin SDK), não mais por escrita direta do client
- Proteção de rotas privadas
- Página `/settings` para editar tópicos (como tags, até 10), fontes de informação, horário de recebimento e customização de prompt, com validação via `react-hook-form` + `zod`
- Salvamento de preferências via `POST /api/settings`, um endpoint autenticado (Firebase Admin SDK) que calcula `schedule.targetHourUTC` no servidor
- Cabeçalho compartilhado (`AppHeader`) nas páginas autenticadas, com navegação entre Dashboard/Configurações/Histórico e logout
- Alternância de tema claro/escuro disponível em toda a aplicação, com preferência persistida e paleta baseada nos tokens de cor do Material Design 3 (`src/app/globals.css`)
- Pipeline de geração automática de digests (`GET /api/cron/generate`, protegido por `CRON_SECRET`, agendado a cada hora via GitHub Actions — veja "Disparo do Cron em produção"): agrega fontes RSS/website do usuário, gera um resumo detalhado por tópico via GPT-4o-mini (com até 3 referências reais por tópico, nunca inventadas — filtradas em código contra as URLs de origem, não só por instrução ao modelo) e persiste em `users/{uid}/digests`, com isolamento de falhas por fonte/usuário e proteção contra reprocessamento duplicado
- `/dashboard` exibe o digest mais recente em tempo real (skeleton enquanto `processing`, mensagem amigável em `failed`, estado vazio para quem ainda não tem nenhum), com as referências de cada tópico numa caixa colapsável fechada por padrão; `/history` lista os digests anteriores com paginação — ambos renderizando o texto gerado pela IA via `react-markdown`
