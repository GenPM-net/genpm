---
title: Démarrage rapide
section: Premiers pas
order: 1
---
Ajoutez votre premier module en une minute environ. Il vous faut seulement **git 2.25+** (sans lui, GenPM utilise les tarballs GitHub).

## 1. Installez genpm

macOS et Linux :

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows (PowerShell) :

```powershell
irm https://genpm.net/install.ps1 | iex
```

C’est un binaire unique, sans Node.js. Les autres options (npm, une version précise, des miroirs) sont dans [Installation](/docs/install).

## 2. Ajoutez un paquet

Lancez ceci à la racine de votre projet. GenPM affiche le plan complet et demande avant d’écrire quoi que ce soit.

```bash
genpm add @core/auth
```

GenPM résout `@core/auth` et sa dépendance `@core/db`, vérifie la signature du registry sur chaque manifeste, télécharge le commit exact et l’analyse localement avant de vous montrer le plan.

## 3. Voyez ce qui a changé

```bash
git status
```

- Le code est dans `src/lib/auth` et `src/lib/db` : c’est désormais votre code.
- Les règles que lit votre IA sont dans `src/lib/auth/AGENTS.md`.
- `genpm.lock` épingle chaque paquet sur un SHA de commit de 40 caractères.
- `.env.example` liste les variables à configurer (les noms seulement, jamais les valeurs).

## 4. Laissez votre IA prendre le relais

Ouvrez votre agent et demandez-lui d’intégrer le module. Il lit les règles du module et suit leur section **Integration** :

```text
Intègre @core/auth en suivant src/lib/auth/AGENTS.md. Ajoute la connexion avec GitHub.
```

Connectez le [serveur MCP](/docs/mcp) et votre agent pourra aussi faire l’étape 1.
