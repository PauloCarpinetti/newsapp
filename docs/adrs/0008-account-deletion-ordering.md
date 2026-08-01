# ADR 0008: Ordem de exclusão em cascata para exclusão de conta

**Status**: Accepted

**Data**: 2026-08-01

**Specs relacionadas**: 012

## Contexto

A spec 012 introduziu a primeira operação genuinamente destrutiva e irreversível do projeto: exclusão de conta pelo próprio usuário, via `DELETE /api/profile`. O Firestore não tem suporte nativo a exclusão em cascata — apagar o documento `users/{uid}` não apaga a subcoleção `users/{uid}/digests`, que ficaria órfã (dados sem dono acessível). Some-se a isso a conta no Firebase Authentication: uma vez apagada, o `uid` não pode mais ser verificado por token, então qualquer dado do Firestore que ainda exista nesse `uid` se torna inacessível por qualquer fluxo normal do app (nenhum ID token futuro decodifica para esse `uid` de novo — um novo login com a mesma conta Google gera um `uid` novo).

Isso cria uma janela de falha real: se qualquer etapa da exclusão falhar no meio do caminho, a ordem em que as etapas acontecem determina se o resultado é recuperável (o usuário pode tentar de novo) ou definitivamente órfão (dados presos, sem dono, sem forma de limpar via Admin SDK usando o fluxo normal do app).

## Decisão

Ordem fixa, sem exceção, dentro do handler `DELETE /api/profile`:

1. Ler todos os documentos de `users/{uid}/digests` e apagá-los, junto com o documento `users/{uid}`, num único `WriteBatch` do Admin SDK (atômico — ou tudo é apagado, ou nada é).
2. Só depois do `batch.commit()` ter sucesso, chamar `getAdminAuth().deleteUser(uid)`.
3. Se o `batch.commit()` lançar exceção, a função retorna erro imediatamente — `deleteUser` nunca é chamado, a conta no Firebase Authentication permanece intacta, e o usuário pode tentar excluir de novo (ou contactar suporte, no caso de um projeto real).

A conta no Firebase Authentication é sempre a **última** coisa a ser apagada, nunca a primeira nem no meio.

## Alternativas Consideradas

- **Apagar a conta no Firebase Authentication primeiro**: rejeitada — se a exclusão dos dados do Firestore falhar depois, os dados ficam órfãos permanentemente, já que nenhum ID token futuro pode provar posse desse `uid` de novo. Essa é exatamente a falha que a ordem escolhida evita.
- **Cloud Function `onDelete` do Firebase Authentication** (apagar dados do Firestore automaticamente quando uma conta é apagada no Authentication): rejeitada por ora — exigiria um segundo deployable (Cloud Functions), contrariando a mesma razão já registrada na ADR 0002 para manter tudo num único app Next.js/Vercel. Um candidato razoável se o projeto crescer a ponto de ter múltiplos pontos de exclusão de conta (hoje só existe um, o botão em `/profile`).
- **Soft delete (marcar como excluído em vez de apagar de verdade)**: rejeitada — a spec 012 exige exclusão permanente e verdadeira, sem período de carência nem recuperação (decisão de produto confirmada com Paulo antes da spec), então um soft delete não atenderia o requisito.

## Consequências

- Uma falha durante a exclusão nunca deixa dados do Firestore órfãos sem dono recuperável — o pior caso é a conta no Firebase Authentication continuar existindo com os dados já parcialmente ou totalmente apagados, o que é recuperável (usuário loga nesse `uid` de novo, os endpoints de criação de perfil já existentes recriam um documento mínimo).
- O `WriteBatch` usado para digests + documento do usuário está limitado a 500 operações (limite do Firestore) — aceito como suficiente para o volume esperado deste projeto (mais de um ano de digests diários pra um único usuário ultrapassar isso); não há paginação do batch nesta versão. Revisitar se o projeto crescer a ponto de usuários acumularem centenas de digests.
- Este é o padrão a seguir para qualquer futura operação de exclusão em cascata no projeto: identificar qual recurso, uma vez apagado, torna os demais inacessíveis/órfãos, e apagar esse recurso sempre por último.
