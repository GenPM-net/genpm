---
title: Como o GenPM funciona
section: Primeiros passos
order: 2
---
Um pacote do GenPM são três camadas que viajam juntas e ficam fixadas em um commit:

| Camada | O que é | Onde fica |
|---|---|---|
| **Código** | Código-fonte de um módulo | `d`, por exemplo `src/lib/auth/` |
| **Contexto** | Regras para o seu agente de IA (`x`) | `<d>/AGENTS.md`, mais arquivos de regras da IDE com escopo |
| **Conexões** | Servidores MCP de que o módulo precisa (`m`) | `.mcp.json`, `.cursor/mcp.json`… só com o seu consentimento |

## O registry guarda só metadados

O registry indexa manifestos e aponta para o Git. Na instalação, o CLI baixa o código **diretamente do host Git** no commit exato (`c`) e o verifica: `git rev-parse HEAD` precisa ser igual a `c`, e cada arquivo precisa bater com a árvore do commit.

## Planejar antes de agir

`plan()` nunca escreve no seu projeto. Ele resolve as dependências, baixa para um cache global e escaneia os arquivos. `apply()` escreve com um journal: se algo falhar, tudo é desfeito.

## Nenhum script, nunca

O GenPM não tem scripts de ciclo de vida. Nada de um pacote roda na sua máquina. Arquivos que outras ferramentas executam automaticamente (`postinstall`, `.npmrc`, `.envrc`, `.vscode/tasks.json`…) são rejeitados.
