# ADR 0002: Route Handlers autenticados + Firebase Admin SDK para escritas críticas

**Status**: Accepted
**Data**: 2026-07-27 (retroativa — decisão tomada nas specs 005 e 006, 2026-07-27)
**Specs relacionadas**: 002, 003, 005, 006

## Contexto

O Princípio II da constitution exige que operações críticas de escrita rodem no servidor, nunca em Client Components. As specs 002 (criação de perfil no login) e 003 (salvar preferências em `/settings`) inicialmente violaram essa regra: `src/lib/firebase/auth.ts` e `src/app/settings/page.tsx` escreviam direto no Firestore usando o client SDK. As specs 005 e 006 fecharam essas duas lacunas.

## Decisão

Introduzir Route Handlers do Next.js (`src/app/api/settings/route.ts`, `src/app/api/auth/profile/route.ts`) que verificam o ID token do Firebase Auth do usuário via um singleton do Firebase Admin SDK inicializado de forma preguiçosa (`src/lib/firebase/admin.ts`), extraem `uid` (e `email`/`displayName` quando aplicável) exclusivamente do token verificado — nunca do corpo da requisição — e então executam a escrita no Firestore com o Admin SDK.

Padrão replicado nos dois endpoints:
- `Authorization: Bearer <idToken>` obrigatório, senão `401`.
- `getAdminAuth().verifyIdToken()`, distinguindo erros `app/*` (SDK mal configurado, `500`) de `auth/*` (token realmente inválido, `401`).
- `uid` do token decodificado é a única fonte de verdade para o caminho do documento (`users/{uid}`) — nenhuma escrita cross-user é estruturalmente possível.

## Alternativas Consideradas

- **Regras de segurança do Firestore, sem endpoint backend**: rejeitada — parte da lógica (cálculo de `targetHourUTC`, criação idempotente de perfil) precisa de computação server-side, não é só controle de acesso.
- **Serviço/Cloud Functions separado**: rejeitada em favor de manter tudo no mesmo app Next.js já implantado — evita um segundo deployable para um projeto de escopo pequeno (uma única aplicação Vercel, conforme a Visão e Escopo da constitution).

## Consequências

- Dois Route Handlers com um padrão de verificação de auth propositalmente replicado (não é duplicação acidental — é o mesmo contrato aplicado duas vezes).
- `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` tornaram-se variáveis de ambiente obrigatórias para desenvolvimento local completo (antes eram placeholders não usados desde a spec 001).
- Inicialização eager do Admin SDK quebrava a coleta de dados de página do `next build` sem credenciais reais — resolvido expondo `getAdminAuth()`/`getAdminDb()` como funções de acesso preguiçosas em vez de constantes eager no escopo do módulo (o mesmo padrão de bug e correção já visto antes no SDK client do Firebase).
- Esse padrão é o modelo a seguir para qualquer futura escrita crítica (ex.: quando o Cron Job de digests precisar gravar histórico em `users/{uid}/digests`).
