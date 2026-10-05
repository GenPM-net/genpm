---
title: Utiliser des paquets
section: Utiliser des paquets
order: 10
---
## add

```bash
genpm add @core/billing            # dernière version
genpm add @core/auth@^1.2          # plage semver
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # affiche le plan sans rien écrire
```

GenPM pose trois questions séparées : injecter le code, ajouter des serveurs MCP (en affichant la commande complète) et lancer la commande du gestionnaire de paquets pour les dépendances npm. `--yes` ne répond qu’à la première ; utilisez `--mcp` et `--install-deps` pour les autres.

Si la destination existe et n’est pas vide, `add` échoue avec `E_DEST_CONFLICT`. `--force` déplace d’abord l’ancien contenu dans `.genpm/backup/<timestamp>/`.

## search et info

```bash
genpm search stripe
genpm info @core/billing          # manifeste, dépendances, MCP, variables d’environnement et règles IA complètes
genpm info @core/billing --rules  # seulement les règles
```

## list et remove

```bash
genpm list
genpm remove @core/auth
```

`list` compare chaque fichier injecté avec son SHA-256 enregistré (modifications locales). `remove` refuse de supprimer du code que vous avez modifié (`E_DRIFT`) : utilisez `--keep-code` pour le garder ou `--force` pour le supprimer quand même. Un paquet dont un autre dépend ne peut pas être retiré en premier (`E_REQUIRED_BY`). Retirer un paquet retire aussi ses serveurs MCP et les fichiers créés par GenPM qui se retrouvent vides.

## outdated et audit

```bash
genpm outdated
genpm audit   # à ajouter à votre CI : npx @genpm-net/cli audit
```

`audit` vérifie l’intégrité des fichiers, la signature du registry de chaque entrée du lock, les avis de sécurité, les versions retirées et les quarantaines. Il sort avec le code 6 en cas de problème élevé ou critique.

## update et diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` affiche ce qui a changé en amont depuis votre version installée, avec des chemins qui pointent déjà vers votre dossier (appliquez-le avec `git apply --3way`). `update` fait une fusion à trois voies : les fichiers que vous n’avez pas touchés reçoivent la nouvelle version, vos lignes modifiées sont conservées et, si les deux côtés ont changé les mêmes lignes, le fichier garde les marqueurs standard `<<<<<<<` et la commande sort avec le code 4. Un fichier supprimé en amont que vous avez modifié est conservé.

`genpm diff --local` liste aussi vos changements locaux ; `genpm update --dry-run` affiche le plan sans rien écrire.

## Sortie JSON

Toutes les commandes acceptent `--json` (une ligne, en anglais, sans questions). Sans terminal interactif, toute question sans réponse échoue avec `E_CONFIRM_REQUIRED` (code de sortie 2) et rien n’est écrit.
