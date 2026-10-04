---
title: Usando pacotes
section: Usando pacotes
order: 10
---
## add

```bash
genpm add @core/billing            # última versão
genpm add @core/auth@^1.2          # intervalo semver
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # mostra o plano sem escrever nada
```

O GenPM faz três perguntas separadas: injetar o código, adicionar servidores MCP (mostrando o comando completo) e rodar o comando do gerenciador de pacotes para as dependências npm. `--yes` só responde à primeira; use `--mcp` e `--install-deps` para as outras.

Se o destino existe e não está vazio, `add` falha com `E_DEST_CONFLICT`. `--force` move antes o conteúdo antigo para `.genpm/backup/<timestamp>/`.

## search e info

```bash
genpm search stripe
genpm info @core/billing          # manifesto, dependências, MCP, variáveis de ambiente e as regras de IA completas
genpm info @core/billing --rules  # só as regras
```

## list e remove

```bash
genpm list
genpm remove @core/auth
```

`list` compara cada arquivo injetado com o SHA-256 registrado (mudanças locais). `remove` se recusa a apagar código que você modificou (`E_DRIFT`): use `--keep-code` para mantê-lo ou `--force` para apagar mesmo assim. Um pacote do qual outro depende não pode ser removido primeiro (`E_REQUIRED_BY`). Remover um pacote também remove seus servidores MCP e os arquivos que o GenPM criou e ficaram vazios.

## outdated e audit

```bash
genpm outdated
genpm audit   # adicione ao seu CI como: npx @genpm/cli audit
```

`audit` verifica a integridade dos arquivos, a assinatura do registry em cada entrada do lock, avisos de segurança, versões retiradas e quarentenas. Sai com código 6 se houver achados altos ou críticos.

## Saída JSON

Todos os comandos aceitam `--json` (uma linha, em inglês, sem perguntas). Sem terminal interativo, qualquer pergunta sem resposta falha com `E_CONFIRM_REQUIRED` (código de saída 2) e nada é escrito.
