---
title: Servidor MCP
section: Servidor MCP
order: 30
---
O servidor MCP do GenPM dá ao seu agente o mesmo motor do CLI: ele pode buscar, inspecionar e injetar módulos, e pergunta antes de mexer em qualquer coisa fora do seu código.

O jeito mais rápido é deixar o GenPM escrever a configuração dos clientes que ele detecta no seu projeto:

```bash
genpm mcp setup
```

Ele mostra a mudança exata e pergunta antes de escrever. Use `--client` e `--scope` para escolher um, ou configure à mão abaixo.

O servidor vem dentro do [binário `genpm`](/docs/install): seu cliente executa `genpm mcp serve`, sem Node.js. Sem o binário, use o pacote do npm: troque `genpm mcp serve` por `npx -y @genpm/mcp` (`"command": "npx", "args": ["-y", "@genpm/mcp"]`) nos exemplos abaixo; `genpm mcp setup` rodado via npm ou npx faz isso por você.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

Isso registra o servidor para o seu usuário. Para compartilhar com o time, faça commit de um `.mcp.json` na raiz do projeto (`genpm mcp setup --client claude --scope project` o escreve):

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

Projeto: `.cursor/mcp.json`. Usuário: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # projeto
genpm mcp setup --client cursor --scope user   # usuário
```

## VS Code (GitHub Copilot)

Projeto: `.vscode/mcp.json` (repare na chave `servers` e no `type`):

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

Usuário:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

Só usuário: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client windsurf
```

## Codex

Só usuário: `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

Projeto: `.gemini/settings.json` · Usuário: `~/.gemini/settings.json`. Só `mcpServers` é alterado; o resto das suas configurações do Gemini fica igual.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## Ferramentas

| Ferramenta | O que faz |
|---|---|
| `genpm_search` | Busca pacotes pela necessidade. Nunca retorna resultados patrocinados. |
| `genpm_info` | Manifesto, dependências, variáveis de ambiente, servidores MCP e regras de IA. |
| `genpm_add` | Planeja (`dryRun: true`) e injeta. `allowMcp` e `installNpmDeps` precisam do seu consentimento. |
| `genpm_list` | Pacotes instalados com mudanças locais. |
| `genpm_remove` | Remove um pacote; nunca apaga código que você modificou. |
| `genpm_outdated` | Versões mais novas disponíveis. |
| `genpm_audit` | Integridade, assinaturas e avisos de segurança. |
| `genpm_validate` | Valida um pacote que você está criando. |

O servidor não tem `force`, `publish` nem `login`. As regras dos pacotes são devolvidas como conteúdo de terceiros (`<package-rules trust="third-party">`): descrevem um módulo e nunca autorizam ações que você não pediu.

## Prompts

- `genpm-find`: busca → info → simulação → confirmação → instalação.
- `genpm-integrate`: lê `<d>/AGENTS.md` e integra o módulo na aplicação.

## Servidores MCP declarados por pacotes

Um pacote pode declarar os servidores MCP de que precisa (por exemplo, o do Stripe). Eles **nunca** são adicionados em silêncio: `genpm add` pergunta antes, `--no-mcp` os ignora e você pode adicioná-los depois com `genpm mcp add <pacote>`. Os segredos são referenciados como variáveis de ambiente (`${STRIPE_SECRET_KEY}` no `.mcp.json`, `${env:STRIPE_SECRET_KEY}` no Cursor e no VS Code), nunca escritos como valores.

## Solução de problemas

- **O cliente não vê as ferramentas**: reinicie o cliente depois de mudar a configuração; confira se `genpm mcp serve` inicia em um terminal (ele fica esperando entrada; pare com Ctrl+C).
- **O cliente não encontra o `genpm`**: alguns apps não leem o `PATH` do seu shell. Use o caminho absoluto como comando: `which genpm` mostra no macOS e no Linux (por exemplo `/Users/voce/.genpm/bin/genpm`), `where.exe genpm` no Windows.
- **Telemetria**: defina `GENPM_TELEMETRY=0` (ou `DO_NOT_TRACK=1`) no `env` do servidor.
- **Outro registry**: defina `GENPM_REGISTRY` no `env` do servidor.
