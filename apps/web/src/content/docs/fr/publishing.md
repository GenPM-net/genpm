---
title: Votre premier paquet
section: Publication
order: 20
---
Votre code reste sur GitHub ; le registry stocke le manifeste et le commit vers lequel il pointe.

**Depuis le web, sans terminal :** connectez-vous sur [genpm.net/publish](/publish), choisissez un de vos dépôts et GenPM vous dit ce qui manque. Il génère le `genpm.json` pour vous, et chaque correction ouvre GitHub avec le fichier prêt à committer (GenPM ne demande jamais d’accès en écriture). Quand tout est vert, vous publiez depuis la même page.

**Depuis le terminal :**

```bash
genpm init          # crée genpm.json, AGENTS.md et .genpmignore
genpm validate      # le même scanner que le registry
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` vérifie qu’il n’y a pas de modifications non committées et que le tag sur `origin` pointe vers le même commit que le vôtre (`E_REF_NOT_PUSHED`). Le registry lit ensuite `genpm.json` **depuis GitHub** à ce commit (jamais depuis votre machine), le valide, analyse l’arbre, signe le manifeste résolu et liste le paquet.

Les versions sont immuables : `(nom, version)` ne peut jamais être publié deux fois, même après un retrait. Les branches sont toujours refusées (`E_REF_MUTABLE`).

Essayez d’abord sans rien publier :

```bash
genpm publish --dry-run
```

## Ce que vérifie le registry

- Que le tag existe sur GitHub et pointe vers le commit que vous avez poussé.
- Que `genpm.json` est valide et que son nom correspond à un scope où vous pouvez publier.
- Que l’arbre passe l’analyse : aucun fichier qui s’exécute tout seul (scripts d’installation, `.npmrc`, `.vscode/tasks.json`, hooks git…), aucun secret, aucun lien symbolique, des chemins sûrs.
- Que les règles IA ne contiennent pas de prompt injection. Si quelque chose semble suspect, la version est **mise en quarantaine** et une personne l’examine sous 24 heures ouvrées.

## Préversions et dist-tags

Une préversion comme `1.3.0-beta.1` va automatiquement dans le dist-tag `next`, pour que `latest` continue de pointer vers votre dernière version stable. Les utilisateurs l’activent avec `genpm add @acme/billing@next`. Utilisez `--dist-tag` pour choisir un autre tag.

## Monorepos

Publiez un paquet situé dans un sous-dossier avec `--manifest packages/billing/genpm.json`, et réglez `i` sur ce dossier pour que lui seul soit injecté. Utilisez des tags par paquet, comme `billing@1.2.0`.

## Retirer une version

```bash
genpm yank @acme/billing@1.2.0 --reason "casse les webhooks avec l’API Stripe 2026-09"
```

Une version retirée reste immuable et vérifiable pour les projets qui l’utilisent déjà, mais les nouvelles installations l’ignorent et le site affiche la raison.

## Scopes

Votre scope est votre identifiant GitHub ou une de vos organisations. Des scopes comme `@core`, `@genpm` ou `@official` sont réservés.

## CI

`genpm init --workflow` ajoute un workflow GitHub Actions qui publie quand vous poussez un tag `v*`, avec `GENPM_TOKEN` comme secret.

### Sans jeton : publication de confiance

Autorisez le dépôt une fois dans [Publication de confiance](/settings/publishing) (éventuellement un seul fichier de workflow ou un environment). Donnez ensuite `id-token: write` au job et supprimez `GENPM_TOKEN` : `genpm publish` demande un jeton OIDC à Actions et GenPM l’échange contre un jeton de 15 minutes qui ne peut publier que dans votre scope depuis ce dépôt.

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```
