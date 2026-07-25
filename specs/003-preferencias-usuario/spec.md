# Preferências de Conteúdo e Agendamento do Usuário

**Short name:** preferencias-usuario

**Feature Branch**: `003-preferencias-usuario`

**Created**: 2026-07-25

**Status**: Draft

## Resumo
Implementar a página `/settings`, onde o usuário autenticado define e atualiza suas preferências de digest: tópicos de interesse, fontes de informação e horário de recebimento. O formulário usa `react-hook-form` com validação via `zod`, carrega os dados atuais do Firestore ao abrir a página e persiste as alterações de volta em `users/{uid}`, incluindo o cálculo de `schedule.targetHourUTC` a partir do horário local e do fuso horário do navegador.

## Contexto e Motivação
O documento de perfil criado no Spec #2 (`users/{uid}`) já inicializa `config` e `schedule` com valores padrão, mas o usuário não tem hoje nenhuma forma de editá-los. Sem essa tela, os tópicos e fontes ficam sempre vazios e o horário de entrega nunca reflete a preferência real do usuário — o que inviabiliza a curadoria de conteúdo e o agendamento do futuro Cron Job de geração de digests.

## Objetivos
- Fornecer um formulário validado para editar `config.topics`, `config.sources` e `config.promptCustomization`.
- Permitir adicionar/remover múltiplas fontes de informação (RSS, Twitter, Website) dinamicamente.
- Capturar o horário local desejado (`schedule.localTime`) e o fuso horário do navegador (`schedule.timezone`), calculando `schedule.targetHourUTC` no momento do salvamento.
- Pré-carregar o formulário com os dados já existentes no Firestore ao abrir a página.
- Persistir apenas os campos alterados via `updateDoc`, sem sobrescrever `uid`, `email` ou `createdAt`.

## Escopo (In Scope)
- `src/lib/schemas/settingsSchema.ts` (schema Zod de validação do formulário)
- `src/lib/utils/time.ts` (utilitário `calculateTargetHourUTC(localTime, timezone)`)
- `src/app/settings/page.tsx` (página protegida com o formulário de preferências)
- Testes manuais de aceitação local (carregar preferências existentes, editar, salvar, recarregar e confirmar persistência)

## Fora de Escopo
- Conversão de fuso horário com precisão de horário de verão (DST) — a spec 002 já registrou que o cálculo definitivo de `targetHourUTC` pode ser refinado posteriormente em uma rotina server-side (Firebase Admin/Cron). Este spec mantém a aproximação client-side descrita na implementação técnica.
- Múltiplos perfis de agendamento ou horários por tópico/fonte.
- Feedback de erro refinado (toast, inline por campo além do Zod) — o retorno inicial usa `alert()` para sucesso/erro.
- Validação de disponibilidade real da URL/handle informado em cada fonte (apenas formato é validado).

## Dados (Data Dictionary)
Reaproveita os campos já definidos em `users/{uid}` pela spec 002 (nenhum campo novo é criado):

- `config.topics` (Array<String>, max 10) — editado a partir de um campo de texto único, separado por vírgulas.
- `config.sources` (Array<Map>, max 20) — cada item com `type` (`'rss' | 'twitter' | 'website'`) e `url`.
- `config.promptCustomization` (String, Nullable, max 500 caracteres).
- `schedule.localTime` (String, `HH:MM` 24h).
- `schedule.timezone` (String, IANA) — passa a ser preenchido com o fuso real do navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`), em vez do valor padrão `"UTC"` definido na criação do perfil.
- `schedule.targetHourUTC` (Number, 0-23) — recalculado a cada salvamento a partir de `localTime` e `timezone`.

## Requisitos Funcionais (Testáveis)
RF-1: A página `/settings` MUST estar protegida por `ProtectedRoute`, redirecionando usuários não autenticados para `/login`.
- Aceitação: Acessar `/settings` sem sessão ativa resulta em redirecionamento para `/login`.

RF-2: Ao abrir `/settings`, o formulário MUST ser pré-preenchido com os valores atuais de `config.topics`, `config.sources`, `config.promptCustomization` e `schedule.localTime` lidos de `users/{uid}`.
- Aceitação: Um usuário com perfil já configurado vê os mesmos valores salvos ao reabrir a página.

RF-3: O formulário MUST validar via `zod` antes de permitir o envio: tópicos não vazios, ao menos uma fonte com `url` válida, `localTime` no formato `HH:MM`, e `promptCustomization` com no máximo 500 caracteres.
- Aceitação: Tentar salvar com campos inválidos exibe mensagens de erro específicas e não chama `updateDoc`.

RF-4: O usuário MUST poder adicionar e remover fontes de informação dinamicamente, mantendo ao menos uma fonte obrigatória para salvar.
- Aceitação: Clicar em "Adicionar Fonte" insere uma nova linha; remover a última fonte impede o envio até que outra seja adicionada.

RF-5: Ao salvar, o sistema MUST calcular `schedule.targetHourUTC` a partir de `schedule.localTime` e do fuso horário resolvido do navegador, e persistir `config.topics` (convertido de string para array), `config.sources`, `config.promptCustomization`, `schedule.localTime`, `schedule.timezone` e `schedule.targetHourUTC` em `users/{uid}` via `updateDoc`.
- Aceitação: Após salvar, `getDoc` no mesmo documento retorna os novos valores, e `uid`, `email` e `createdAt` permanecem inalterados.

RF-6: O sistema MUST informar o usuário sobre o resultado da operação de salvamento (sucesso ou falha), desabilitando o botão de salvar enquanto a operação estiver em andamento.
- Aceitação: Durante o salvamento o botão fica desabilitado com o rótulo "Salvando..."; ao final, uma mensagem de sucesso ou erro é exibida.

## Critérios de Sucesso
- CS-1: 100% das alterações salvas em `/settings` refletem corretamente em `users/{uid}` no Firestore, sem sobrescrever campos imutáveis.
- CS-2: Reabrir `/settings` após salvar sempre mostra os dados recém-salvos (sem valores obsoletos ou vazios).
- CS-3: Nenhum envio com dados inválidos chega a gerar uma chamada de escrita no Firestore (validação client-side bloqueia antes).

## Cenários de Aceitação
1. Cenário: Primeira configuração de preferências
   - Dado um usuário recém-criado com `config`/`schedule` nos valores padrão
   - Quando preencher tópicos, ao menos uma fonte e um horário válido e salvar
   - Então `users/{uid}` é atualizado com os novos valores e `schedule.targetHourUTC` é recalculado

2. Cenário: Edição de preferências existentes
   - Dado um usuário que já salvou preferências anteriormente
   - Quando reabrir `/settings`
   - Então o formulário aparece pré-preenchido com os valores salvos, prontos para edição

3. Cenário: Envio com dados inválidos
   - Dado o formulário aberto
   - Quando o usuário tentar salvar com uma URL de fonte inválida ou horário fora do formato `HH:MM`
   - Então o envio é bloqueado e a mensagem de erro correspondente é exibida, sem alterar o Firestore

4. Cenário: Acesso sem autenticação
   - Dado um visitante não autenticado
   - Quando acessar `/settings`
   - Então é redirecionado para `/login`

## Entidades Chave
- `UserProfile.config` — subconjunto do documento `users/{uid}` editado por esta feature (`topics`, `sources`, `promptCustomization`).
- `UserProfile.schedule` — subconjunto do documento `users/{uid}` editado por esta feature (`localTime`, `timezone`, `targetHourUTC`).

## Assunções
- O usuário já passou pelo fluxo de login da spec 002, então `users/{uid}` sempre existe antes de `/settings` ser aberta.
- `src/lib/firebase/config.ts`, `src/contexts/AuthContext.tsx` e `src/components/ProtectedRoute.tsx` (spec 002) já estão disponíveis e não são modificados por este spec.
- O navegador do usuário resolve corretamente seu fuso horário IANA via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- O cálculo de `targetHourUTC` no cliente é uma aproximação aceitável para esta fase; precisão total (DST, mudanças de fuso) fica para uma rotina backend futura, conforme já assumido na spec 002.

## Dependências
- Conclusão da spec 002 (autenticação, `AuthContext`, `ProtectedRoute`, `users/{uid}` já existente).
- `react-hook-form`, `zod`, `@hookform/resolvers` e `lucide-react` já instalados desde a spec 001.
- Regras de segurança do Firestore que já permitem ao usuário autenticado ler/escrever apenas o próprio documento em `users/{uid}` (configuradas manualmente durante a validação da spec 002).

## Riscos e Mitigações
- Risco: `updateDoc` falhar silenciosamente ou sobrescrever campos imutáveis.
  - Mitigação: usar caminhos de campo com notação de ponto (`'config.topics'`, `'schedule.localTime'`, etc.) em vez de substituir os mapas inteiros, preservando `uid`, `email` e `createdAt`.
- Risco: Cálculo de `targetHourUTC` impreciso em fusos com horário de verão.
  - Mitigação: documentar explicitamente a limitação (fora de escopo) e reservar o refinamento para uma rotina server-side futura.
- Risco: Usuário remover todas as fontes e ficar sem nenhuma configurada.
  - Mitigação: validação Zod exige ao menos uma fonte antes de permitir o envio.

## Artefatos Criados
- `specs/003-preferencias-usuario/spec.md`
- `.specify/feature.json` apontando para `specs/003-preferencias-usuario`

## Próximos Passos
- Rodar `/speckit.clarify` e `/speckit.plan` para detalhar a implementação técnica e gerar `plan.md`.
- Gerar `tasks.md` com `/speckit.tasks` a partir do plano.
- Implementar os arquivos listados no Escopo (`settingsSchema.ts`, `time.ts`, `settings/page.tsx`).

*Gerado em: 2026-07-25*
