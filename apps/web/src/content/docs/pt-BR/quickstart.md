---
title: Início rápido
section: Primeiros passos
order: 1
---
Adicione seu primeiro módulo em cerca de um minuto. Você só precisa de **git 2.25+** (sem ele, o GenPM usa os tarballs do GitHub).

## 1. Instale o genpm

macOS e Linux:

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://genpm.net/install.ps1 | iex
```

É um único binário, sem Node.js. Outras opções (npm, uma versão específica, mirrors) estão em [Instalação](/docs/install).

## 2. Adicione um pacote

Rode isto na raiz do seu projeto. O GenPM mostra o plano completo e pergunta antes de escrever qualquer coisa.

```bash
genpm add @core/auth
```

O GenPM resolve `@core/auth` e sua dependência `@core/db`, verifica a assinatura do registry em cada manifesto, baixa o commit exato e o escaneia localmente antes de mostrar o plano.

## 3. Veja o que mudou

```bash
git status
```

- O código está em `src/lib/auth` e `src/lib/db`: agora ele é seu.
- As regras que sua IA lê estão em `src/lib/auth/AGENTS.md`.
- `genpm.lock` fixa cada pacote em um SHA de commit de 40 caracteres.
- `.env.example` lista as variáveis a configurar (só os nomes, nunca os valores).

## 4. Deixe sua IA continuar

Abra seu agente e peça para ele integrar o módulo. Ele lê as regras do módulo e segue a seção **Integration**:

```text
Integra @core/auth seguindo src/lib/auth/AGENTS.md. Adiciona login com GitHub.
```

Conecte o [servidor MCP](/docs/mcp) e seu agente também pode fazer o passo 1.
