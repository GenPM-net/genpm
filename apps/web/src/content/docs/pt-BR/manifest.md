---
title: Referência do genpm.json
section: Publicação
order: 21
---
Um manifesto de origem completo (`genpm.json` na raiz do seu repo):

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "pt-BR": "Assinaturas Stripe com webhooks" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

As chaves têm um caractere para que os manifestos gastem poucos tokens. Tudo o que mostra manifestos a um LLM inclui esta legenda:

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| Chave | Nome | Obrigatória | Regras |
|---|---|---|---|
| `n` | nome | sim | `@escopo/nome`, em minúsculas. |
| `v` | versão | sim | SemVer estrito, sem prefixo `v` nem metadados de build. |
| `d` | destino | sim | Caminho POSIX relativo no projeto de quem instala. Sem `..` nem caminhos absolutos, nunca `.git/`, `node_modules/` ou `.genpm/`, no máximo 8 segmentos. |
| `s` | resumo | recomendada | ≤ 160 caracteres, uma linha. Texto ou `{ "en": "…", "pt-BR": "…" }` (deve incluir `en`). |
| `r` | repo | não | URL HTTPS do Git; por padrão, o remoto `origin`. |
| `t` | ref | não | Uma tag ou um SHA de 40 caracteres hexadecimais; por padrão `v{v}`. Nunca uma branch. |
| `i` | include | não | Subdiretório do repo a injetar (padrão `.`). |
| `x` | contexto | não | Arquivo de regras de IA relativo a `i` (padrão `AGENTS.md`, ≤ 16 KB). |
| `l` | licença | não | Expressão SPDX; vale a licença detectada pelo GitHub. |
| `k` | palavras-chave | não | Até 10, `^[a-z0-9-]{2,32}$`. |
| `g` | dependências genpm | não | `{ "@core/db": "^1.0.0" }`, até 10. Resolvidas pelo GenPM. |
| `p` | dependências npm | não | Propostas ao usuário; nunca instaladas sem consentimento. |
| `e` | ambiente | não | **Nomes** de variáveis (`^[A-Z][A-Z0-9_]{1,63}$`), nunca valores. |
| `m` | mcp | não | Até 5 servidores: `"@stripe/mcp"` ou `{ "n", "c", "a", "u", "e" }`. |
| `_*` | extensões | não | Ignoradas pelas ferramentas oficiais. Qualquer outra chave é um erro. |

O manifesto de origem **não pode** conter `c` (o próprio commit); o registry adiciona `r`, `t`, `c`, `i`, `x` e `l` ao resolvê-lo.

Exclua arquivos com `.genpmignore` (sintaxe do gitignore, relativa a `i`). `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore` e `.env*` são sempre excluídos.

## Limites

| O quê | Limite |
|---|---|
| Arquivos por pacote | 2.000 |
| Tamanho do pacote | 20 MB (amplie com `--max-size` ao instalar) |
| Um único arquivo | 1 MB |
| Arquivo de regras de IA | 16 KB; recomenda-se ~1.500 tokens, aviso acima de 4.000 |
| Tamanho / profundidade do caminho | 200 caracteres / 8 segmentos |
| Palavras-chave · deps genpm · deps npm · variáveis · servidores MCP | 10 · 10 · 30 · 30 · 5 |

`genpm validate` verifica tudo isso localmente com o mesmo código que o registry roda.

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json).
