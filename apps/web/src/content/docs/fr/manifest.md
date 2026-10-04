---
title: Référence genpm.json
section: Publication
order: 21
---
Un manifeste source complet (`genpm.json` à la racine de votre dépôt) :

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "fr": "Abonnements Stripe avec webhooks" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

Les clés font un caractère pour que les manifestes coûtent peu de tokens. Tout ce qui montre des manifestes à un LLM inclut cette légende :

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| Clé | Nom | Obligatoire | Règles |
|---|---|---|---|
| `n` | nom | oui | `@scope/nom`, en minuscules. |
| `v` | version | oui | SemVer strict, sans préfixe `v` ni métadonnées de build. |
| `d` | destination | oui | Chemin POSIX relatif dans le projet de l’utilisateur. Pas de `..` ni de chemin absolu, jamais `.git/`, `node_modules/` ou `.genpm/`, 8 segments au plus. |
| `s` | résumé | recommandé | ≤ 160 caractères, une ligne. Texte ou `{ "en": "…", "fr": "…" }` (doit inclure `en`). |
| `r` | dépôt | non | URL Git en HTTPS ; par défaut, le remote `origin`. |
| `t` | ref | non | Un tag ou un SHA de 40 caractères hexadécimaux ; par défaut `v{v}`. Jamais une branche. |
| `i` | include | non | Sous-dossier du dépôt à injecter (par défaut `.`). |
| `x` | contexte | non | Fichier de règles IA relatif à `i` (par défaut `AGENTS.md`, ≤ 16 Ko). |
| `l` | licence | non | Expression SPDX ; la licence détectée par GitHub prévaut. |
| `k` | mots-clés | non | Jusqu’à 10, `^[a-z0-9-]{2,32}$`. |
| `g` | dépendances genpm | non | `{ "@core/db": "^1.0.0" }`, jusqu’à 10. Résolues par GenPM. |
| `p` | dépendances npm | non | Proposées à l’utilisateur ; jamais installées sans son accord. |
| `e` | environnement | non | **Noms** de variables (`^[A-Z][A-Z0-9_]{1,63}$`), jamais de valeurs. |
| `m` | mcp | non | Jusqu’à 5 serveurs : `"@stripe/mcp"` ou `{ "n", "c", "a", "u", "e" }`. |
| `_*` | extensions | non | Ignorées par les outils officiels. Toute autre clé est une erreur. |

Le manifeste source **ne doit pas** contenir `c` (son propre commit) ; le registry ajoute `r`, `t`, `c`, `i`, `x` et `l` en le résolvant.

Excluez des fichiers avec `.genpmignore` (syntaxe gitignore, relative à `i`). `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore` et `.env*` sont toujours exclus.

## Limites

| Quoi | Limite |
|---|---|
| Fichiers par paquet | 2 000 |
| Taille du paquet | 20 Mo (modifiable avec `--max-size` à l’installation) |
| Un fichier | 1 Mo |
| Fichier de règles IA | 16 Ko ; ~1 500 tokens recommandés, avertissement au-delà de 4 000 |
| Longueur / profondeur de chemin | 200 caractères / 8 segments |
| Mots-clés · deps genpm · deps npm · variables · serveurs MCP | 10 · 10 · 30 · 30 · 5 |

`genpm validate` vérifie tout cela en local avec le même code que le registry.

JSON Schema : [`/schema/v1/genpm.json`](/schema/v1/genpm.json).
