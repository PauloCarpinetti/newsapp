<!--
Sync Impact Report
- Version change: unversioned template -> 1.0.0
- Modified principles: template placeholders -> cinco princípios iniciais do AI Digest Aggregator
- Added sections: Visão e Escopo; Responsabilidades do Ciclo de Vida; Workflow e Disciplina de Código
- Removed sections: nenhuma
- Templates requiring updates: ✅ .specify/templates/plan-template.md (Constitution Check genérico permanece compatível)
	✅ .specify/templates/spec-template.md (nenhuma seção obrigatória afetada)
	✅ .specify/templates/tasks-template.md (tarefas de segurança, resiliência e documentação já são suportadas)
- Follow-up TODO: confirmar a data original de ratificação

Sync Impact Report (1.0.0 -> 1.1.0)
- Version change: 1.0.0 -> 1.1.0
- Modified principles: nenhum princípio central alterado
- Modified sections: Workflow e Disciplina de Código (convenção de nomes de branch
	atualizada para refletir a prática real do GitHub Spec Kit — `NNN-nome-curto` para
	features geradas a partir de uma spec numerada, com `feature/`/`fix/`/`refactor/`
	mantidos e `docs/` adicionado para trabalho que não nasce de uma spec). Corrigido via
	`/speckit.analyze` (spec 006) identificando a divergência entre a regra escrita e a
	prática usada desde a spec 001.
- Added sections: nenhuma
- Removed sections: nenhuma
- Templates requiring updates: ✅ .specify/templates/plan-template.md (nenhuma mudança necessária)
	✅ .specify/templates/spec-template.md (nenhuma mudança necessária)
	✅ .specify/templates/tasks-template.md (nenhuma mudança necessária)
- Follow-up TODO: confirmar a data original de ratificação (herdado da v1.0.0, ainda pendente)
-->

# AI Digest Aggregator Constitution

## Core Principles

### I. Desempenho de Leitura e Modelagem NoSQL
O modelo de dados MUST ser orientado pelos padrões reais de consulta da aplicação.
Coleções e documentos MUST priorizar leituras eficientes, usando desnormalização
controlada e subcoleções isoladas para históricos de digests. Toda duplicação de dados
deve ter uma justificativa de leitura, consistência e custo documentada. O objetivo é
manter o acesso previsível e evitar consultas compostas desnecessárias.

### II. Segurança de Credenciais e Operações Server-Side
Chaves de API, credenciais e segredos MUST permanecer exclusivamente no ambiente de
servidor e em mecanismos seguros de configuração. Operações críticas de escrita e
integrações com serviços externos MUST ser executadas no servidor, nunca em client
components. Cada endpoint ou rotina que altera dados MUST validar autenticação,
autorização e entrada antes de executar a operação.

### III. Manutenibilidade e Clareza
O código MUST privilegiar nomes descritivos, responsabilidades coesas e interfaces
explícitas. Componentes TypeScript e estilos Tailwind CSS MUST seguir os padrões
existentes do projeto e evitar abstrações sem benefício comprovado. Otimizações que
reduzam legibilidade MUST ser rejeitadas até que uma medição demonstre necessidade
real; complexidade adicional exige justificativa registrada no plano ou em um ADR.

### IV. Resiliência, Observabilidade e Isolamento Assíncrono
Falhas de scraping, indisponibilidade de fontes, timeouts e latência da API de IA MUST
ser tratadas sem bloquear a experiência visual principal. Processos assíncronos MUST
expor estados verificáveis, registrar erros estruturados sem vazar segredos e permitir
reprocessamento ou recuperação quando aplicável. Rate limiting, consumo de tokens e
falhas de jobs MUST ser monitorados para manter o custo e a operação sob controle.

### V. Decisões Documentadas e Entrega Incremental
Toda decisão arquitetural significativa MUST ser registrada em `/docs/adrs`, incluindo
contexto, alternativas, trade-offs e decisão adotada. O desenvolvimento MUST ser
dividido em pequenas entregas demonstráveis, com requisitos e critérios de aceitação
testáveis. A curadoria de conteúdo será delegada à LLM dentro dos limites definidos;
algoritmos de recomendação complexos construídos do zero não fazem parte do produto.

## Visão e Escopo

O AI Digest Aggregator é uma aplicação full-stack que agrega fontes de notícias e redes
sociais, usa a API do GPT-4o-mini para gerar resumos diários personalizados e entrega
esses digests por rotinas automatizadas.

Está no escopo: modelagem de banco NoSQL orientada à leitura com Firestore,
autenticação segura, Server-Side Rendering (SSR), client components estruturados com
TypeScript e Tailwind CSS, e gerenciamento de background jobs.

Está fora do escopo: gateways de pagamento, suporte a múltiplos idiomas na interface e
algoritmos de recomendação complexos implementados do zero. O projeto delega a
curadoria de conteúdo à LLM dentro das regras de segurança, custo e qualidade
definidas nesta constituição.

## Responsabilidades do Ciclo de Vida

Mesmo sendo desenvolvido individualmente, o projeto MUST tratar as seguintes
disciplinas como responsabilidades explícitas:

- **Arquitetura e Engenharia:** definir entidades, partições de dados no Firebase e
	comunicação entre interface e serviços de background.
- **Desenvolvimento:** escrever código seguindo Clean Code, construir a interface React
	e desenvolver APIs internas com contratos claros.
- **Operações (DevOps):** manter o deploy contínuo, incluindo Vercel quando adotada,
	configurar Cron Jobs e monitorar limites de consumo de tokens e rate limiting.
- **Produto:** decompor o trabalho em épicos e tarefas pequenas, manter a documentação
	técnica e apresentar o produto como um estudo de caso profissional.

## Workflow e Disciplina de Código

- A branch `main` MUST refletir apenas código funcional e pronto para produção.
- Nenhum commit MUST ser feito diretamente na `main`.
- Todo desenvolvimento MUST ocorrer em branch isolada. Features que nascem de uma spec
	numerada do GitHub Spec Kit MUST usar a convenção `NNN-nome-curto` (ex.:
	`005-topicos-agendamento-backend`), espelhando o diretório `specs/NNN-nome-curto/`
	correspondente. Trabalho que não nasce de uma spec numerada usa `feature/nome-da-feature`,
	`fix/descricao-do-bug`, `refactor/o-que-mudou` ou `docs/o-que-mudou` (documentação,
	constitution, ADRs).
- Toda integração MUST ocorrer via Pull Request, ainda que o autor faça a
	auto-revisão. O self-review MUST verificar o diff, ausência de código comentado e
	conformidade com linting e formatação.
- Commits MUST usar mensagens curtas, imperativas e compatíveis com Conventional
	Commits, registrando o que foi alterado e, quando necessário, seu motivo.

## Governance

Esta constituição prevalece sobre práticas locais conflitantes. Uma alteração MUST
descrever o motivo, o impacto nos princípios e os artefatos afetados. A alteração deve
ser revisada antes de ser integrada e, quando modificar comportamento de engenharia,
deve incluir plano de migração ou atualização dos documentos dependentes.

A versão segue SemVer: MAJOR para remoção ou redefinição incompatível de princípios;
MINOR para novos princípios ou expansão material de regras; PATCH para esclarecimentos,
correções editoriais e ajustes sem mudança semântica. Toda revisão MUST atualizar a
data de alteração e incluir um Sync Impact Report no topo deste arquivo.

Em cada planejamento, Pull Request e revisão de release, a conformidade com os
princípios MUST ser verificada. Violações MUST ser corrigidas ou justificadas
explicitamente em `Complexity Tracking` e aprovadas antes da entrega. A data original
de ratificação ainda precisa ser confirmada pelo responsável pelo projeto.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirmar data original | **Last Amended**: 2026-07-27
