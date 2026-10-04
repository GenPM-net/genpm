---
title: Installation
section: Premiers pas
order: 0
---
Installez `genpm` une fois et lancez-le depuis n’importe quel terminal avec `genpm …`. C’est un binaire natif unique pour macOS, Linux et Windows : **Node.js n’est pas nécessaire**.

## macOS et Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows (PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

L’installateur choisit la bonne build pour votre système (Apple silicon ou Intel, x64 ou arm64, glibc ou musl), la télécharge depuis les [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) du projet, **vérifie son SHA-256** avec les sommes de contrôle de la release et la place dans `~/.genpm/bin` (`%USERPROFILE%\.genpm\bin` sous Windows). Il ajoute ensuite ce dossier à votre `PATH`. Il ne demande jamais `sudo` ni de droits administrateur.

Ouvrez un nouveau terminal et vérifiez :

```bash
genpm --version
genpm doctor
```

| Plateforme | Builds |
|---|---|
| macOS | Apple silicon (arm64), Intel (x64) |
| Linux | x64 et arm64, glibc et musl (Alpine : `apk add libstdc++ libgcc`) |
| Windows | x64 et arm64 |

`git` 2.25+ reste recommandé : GenPM l’utilise pour récupérer les paquets par commit (sans lui, il utilise les tarballs GitHub).

## Mettre à jour

```bash
genpm upgrade            # dernière version
genpm upgrade --check    # indique seulement s’il y en a une plus récente
genpm upgrade 0.2.0      # une version précise (aussi pour revenir en arrière)
```

`genpm upgrade` télécharge le nouveau binaire, vérifie son SHA-256 et se remplace de façon atomique. Si la somme de contrôle ne correspond pas, rien ne change.

## Options

Les installateurs lisent ces variables d’environnement :

| Variable | Par défaut | Rôle |
|---|---|---|
| `GENPM_VERSION` | dernière | Version à installer. Aussi `sh -s -- 0.2.0` ou `-Version 0.2.0`. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | Où placer le binaire. |
| `GENPM_NO_MODIFY_PATH=1` | — | Ne touche ni à votre profil de shell ni au `PATH` utilisateur. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | URL de base (ou dossier) contenant les fichiers de la release, pour des miroirs internes. |

Une version précise sur chaque plateforme :

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## Vérifier un téléchargement à la main

Chaque release publie `SHA256SUMS`. L’installateur et `genpm upgrade` le vérifient pour vous ; pour le faire vous-même :

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## Avec npm

Si vous utilisez déjà Node.js 20.11+, vous pouvez aussi lancer le paquet npm. Les commandes sont les mêmes.

```bash
npm i -g @genpm/cli             # installation globale ; mise à jour avec npm i -g @genpm/cli@latest
npx @genpm/cli add @core/auth   # ponctuel, sans rien installer (pratique en CI)
```

## Désinstaller

Supprimez le binaire et la ligne `# genpm` que l’installateur a ajoutée à votre profil de shell (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` ou `~/.config/fish/conf.d/genpm.fish`) :

```bash
rm -rf ~/.genpm   # supprime aussi le cache de téléchargement et votre connexion
```

Sous Windows, supprimez `%USERPROFILE%\.genpm` et retirez `%USERPROFILE%\.genpm\bin` du `PATH` utilisateur (Paramètres → Système → Informations système → Paramètres avancés du système → Variables d’environnement).
