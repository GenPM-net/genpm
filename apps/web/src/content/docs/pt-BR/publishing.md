---
title: Seu primeiro pacote
section: Publicação
order: 20
---
Seu código continua no GitHub; o registry guarda o manifesto e o commit para o qual ele aponta.

**Pela web, sem terminal:** entre em [genpm.net/publish](/publish), escolha um dos seus repositórios e o GenPM diz o que falta. Ele gera o `genpm.json` para você, e cada correção abre o GitHub com o arquivo pronto para commit (o GenPM nunca pede permissão de escrita). Quando estiver tudo verde, você publica na mesma página.

**Pelo terminal:**

```bash
genpm init          # cria genpm.json, AGENTS.md e .genpmignore
genpm validate      # o mesmo scanner do registry
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` verifica que não há mudanças sem commit e que a tag no `origin` aponta para o mesmo commit que a sua (`E_REF_NOT_PUSHED`). Depois o registry lê o `genpm.json` **do GitHub** naquele commit (nunca da sua máquina), valida, escaneia a árvore, assina o manifesto resolvido e lista o pacote.

As versões são imutáveis: `(nome, versão)` nunca pode ser publicado duas vezes, nem depois de retirado. Branches são sempre rejeitadas (`E_REF_MUTABLE`).

Teste antes sem publicar nada:

```bash
genpm publish --dry-run
```

## O que o registry verifica

- Que a tag existe no GitHub e aponta para o commit que você enviou.
- Que o `genpm.json` é válido e o nome corresponde a um escopo em que você pode publicar.
- Que a árvore passa no escaneamento: nenhum arquivo que rode sozinho (scripts de instalação, `.npmrc`, `.vscode/tasks.json`, hooks do git…), nenhum segredo, nenhum link simbólico e caminhos seguros.
- Que as regras de IA não têm prompt injection. Se algo parecer suspeito, a versão fica **em revisão** e uma pessoa a revisa em até 24 horas úteis.

## Prereleases e dist-tags

Uma prerelease como `1.3.0-beta.1` vai automaticamente para a dist-tag `next`, assim `latest` continua apontando para a sua última versão estável. Os usuários optam com `genpm add @acme/billing@next`. Use `--dist-tag` para escolher outra tag.

## Monorepos

Publique um pacote que fica em um subdiretório com `--manifest packages/billing/genpm.json` e defina `i` como esse diretório para que só ele seja injetado. Use tags por pacote, como `billing@1.2.0`.

## Retirar uma versão

```bash
genpm yank @acme/billing@1.2.0 --reason "quebra os webhooks com a API do Stripe 2026-09"
```

Uma versão retirada continua imutável e verificável para os projetos que já a usam, mas novas instalações a ignoram e a web mostra o motivo.

## Escopos

Seu escopo é o seu usuário do GitHub ou uma das suas organizações. Escopos como `@core`, `@genpm` ou `@official` são reservados.

## CI

`genpm init --workflow` adiciona um workflow do GitHub Actions que publica quando você faz push de uma tag `v*`, com `GENPM_TOKEN` como segredo.

### Sem tokens: publicação confiável

Autorize o repositório uma vez em [Publicação confiável](/settings/publishing) (se quiser, só um arquivo de workflow ou um environment). Depois dê ao job `id-token: write` e remova `GENPM_TOKEN`: `genpm publish` pede um token OIDC ao Actions e o GenPM troca por um token de 15 minutos que só publica no seu scope a partir desse repositório.

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```
