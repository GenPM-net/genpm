---
title: Politique de confidentialité
updated: 2026-10-05
---
Cette politique explique quelles données personnelles GenPM (genpm.net, l’API `api.genpm.net`, le CLI `genpm` et le serveur `@genpm-net/mcp`) traite, pourquoi, sur quelle base juridique et quels sont vos droits. Elle respecte le règlement (UE) 2016/679 (RGPD) et la loi organique espagnole 3/2018 (LOPDGDD). La version espagnole fait foi en cas de divergence.

## 1. Responsable du traitement

- **Responsable :** {{name}}
- **Numéro fiscal (NIF) :** {{nif}}
- **Adresse :** {{address}}
- **Contact :** {{email}} (indiquez « [PRIVACY] » dans l’objet)

La désignation d’un délégué à la protection des données n’est pas obligatoire (art. 37 RGPD, art. 34 LOPDGDD) ; pour toute question, écrivez au contact ci-dessus.

## 2. Ce que nous traitons, pourquoi et sur quelle base

| Données | Finalité | Base juridique | Conservation |
|---|---|---|---|
| Identifiant GitHub, login, nom, avatar et organisations (quand vous vous connectez) | Créer et maintenir votre compte, montrer qui publie chaque paquet et autoriser la publication dans vos scopes | Exécution du contrat (art. 6.1.b RGPD) : les Conditions d’utilisation | Tant que votre compte existe |
| E-mail de votre compte GitHub (jamais affiché) | Avis de sécurité et de service concernant vos paquets | Contrat et intérêt légitime à la sécurité de l’écosystème (art. 6.1.f) | Tant que votre compte existe |
| Jetons d’API (seul leur hash est stocké) | Authentifier le CLI et la CI | Contrat | Jusqu’à leur expiration ou leur révocation |
| Paquets publiés : manifeste, dépôt, commit et votre login GitHub | Faire fonctionner le registry : chercher, vérifier et installer des paquets | Contrat | Indéfiniment : les versions publiées sont immuables pour que les projets qui les utilisent restent vérifiables (voir §6) |
| Événements d’installation : paquet, version, client (`cli`/`mcp`), version du CLI et pays (déduit de l’IP, qui n’est pas stockée) | Compteurs d’installation publics et statistiques agrégées | Intérêt légitime à mesurer l’utilisation du registry | Agrégés par jour ; événements individuels, 90 jours |
| Adresse IP, transformée en hash avec un sel renouvelé chaque jour | Limitation du débit et prévention des abus | Intérêt légitime à la sécurité du service (art. 6.1.f, considérant 49) | 30 jours au maximum |
| Journaux techniques du serveur (Cloudflare Workers) | Diagnostiquer les erreurs et les attaques | Intérêt légitime à la sécurité et à la continuité du service | 7 jours au maximum |
| Mesure d’audience : recherches effectuées, paquet consulté, langue et chemin (sans IP ni identifiant) | Savoir ce qui est cherché et utilisé pour améliorer le service | Intérêt légitime à mesurer l’usage de façon agrégée (art. 6.1.f) | 3 mois (Analytics Engine de Cloudflare) |
| Formulaire sponsors ou entreprises : e-mail, entreprise, taille de l’équipe, IDE et message | Répondre à votre demande | Mesures précontractuelles à votre demande (art. 6.1.b) | 12 mois sauf accord conclu |
| Signalements de paquets : votre compte, le paquet, le motif et votre description | Examiner le contenu signalé et communiquer la décision | Obligation légale au titre de l’art. 16 du règlement européen sur les services numériques (art. 6.1.c RGPD) | 2 ans après la décision |
| E-mails que vous nous envoyez | Traiter votre demande ou l’exercice de vos droits | Intérêt légitime à vous répondre ou, le cas échéant, obligation légale | Le temps nécessaire et jusqu’à 2 ans ensuite |

Ces durées sont appliquées automatiquement : un traitement quotidien supprime ou anonymise ce qui a expiré.

**Ce que nous ne traitons jamais :** le contenu de votre projet, vos fichiers `.env` ou les valeurs de vos variables d’environnement. Nous n’utilisons aucun cookie publicitaire ou de suivi entre sites, et votre navigateur n’envoie rien pour la mesure d’audience : nous comptons sur nos serveurs les pages que vous demandez (voir la [Politique relative aux cookies](/cookies)).

**Télémétrie du CLI et du MCP :** avec `GENPM_TELEMETRY=0` ou `DO_NOT_TRACK=1`, le client envoie `client=none` et le registry ne stocke pas l’événement. Vous pouvez vous y opposer ainsi à tout moment.

Nous ne prenons pas de décisions fondées exclusivement sur un traitement automatisé produisant des effets juridiques à votre égard (art. 22 RGPD). L’analyse automatique peut mettre un paquet en examen, mais c’est une personne qui décide du retrait définitif (voir la [Politique des paquets](/policy)).

La fourniture de vos données GitHub est nécessaire pour créer un compte ; sans elles, vous ne pouvez pas publier, mais vous pouvez toujours chercher et installer des paquets, ce qui ne nécessite aucun compte.

## 3. Destinataires et sous-traitants

Nous ne vendons ni ne partageons vos données avec des tiers. Ces prestataires les traitent pour notre compte dans le cadre d’accords de sous-traitance (art. 28 RGPD) :

| Prestataire | Service | Localisation |
|---|---|---|
| Cloudflare, Inc. | Hébergement (Workers), base de données (D1), réseau de diffusion, protection anti-bots (Turnstile) et statistiques agrégées | UE et États-Unis |
| Piensa Solutions (Arsys Internet, S.L.U.) | Domaine et e-mail | Espagne |

**GitHub, Inc.** agit en tant que responsable de traitement indépendant lorsque vous vous connectez avec GitHub et lorsque le registry lit des dépôts publics ; sa propre [déclaration de confidentialité](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) s’applique.

Les données publiques des paquets (nom, versions, dépôt et login GitHub de l’éditeur) sont visibles par tous les visiteurs et par les agents IA qui utilisent le registry, car c’est l’objet du service.

Nous ne communiquons des données aux autorités que lorsqu’une loi l’exige.

## 4. Transferts internationaux

Cloudflare, Inc. et GitHub, Inc. participent au cadre de protection des données UE-États-Unis, reconnu par la décision d’adéquation de la Commission européenne du 10 juillet 2023 (art. 45 RGPD). Leurs contrats incluent aussi les clauses contractuelles types de la Commission (art. 46 RGPD).

## 5. Vos droits

Vous pouvez exercer vos droits d’**accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité**, et retirer tout consentement donné, à tout moment en écrivant à {{email}} avec l’objet « [PRIVACY] ». Nous répondrons dans un délai d’un mois (art. 12.3 RGPD). Si nous ne pouvons pas vous identifier avec ce que vous envoyez, nous vous demanderons le minimum nécessaire.

Si vous estimez que nous n’avons pas correctement traité votre demande, vous pouvez introduire une réclamation auprès de l’**Agence espagnole de protection des données** ([www.aepd.es](https://www.aepd.es), C/ Jorge Juan 6, 28001 Madrid) ou de l’autorité de votre pays de résidence.

## 6. Fermeture de votre compte

Si vous nous demandez de fermer votre compte, nous anonymisons vos données personnelles sous 30 jours ; les sauvegardes sont écrasées dans les 30 jours suivants. Les paquets que vous avez publiés restent disponibles, attribués à un compte système, car d’autres projets en dépendent et leurs versions sont immuables. L’URL du dépôt GitHub de chaque paquet, qui peut contenir votre login, fait partie du paquet publié ; si vous voulez qu’ils ne soient plus installés, retirez-les avant de fermer votre compte.

## 7. Mineurs

GenPM est un service destiné aux développeurs. Vous devez avoir au moins 16 ans pour créer un compte : c'est l'âge général de l'art. 8 du RGPD et celui que fixe le projet de loi organique espagnole sur la protection des mineurs dans les environnements numériques, qui relèvera les 14 ans de l'art. 7 LOPDGDD. Nous n'acceptons pas de comptes de personnes plus jeunes ; si nous en détectons un, nous le fermons et supprimons ses données.

## 8. Sécurité

Nous appliquons des mesures techniques et organisationnelles adaptées au risque : chiffrement en transit (HTTPS avec HSTS), jetons stockés uniquement sous forme de hash, cookies `HttpOnly` et `Secure`, adresses IP pseudonymisées, accès restreint avec authentification à deux facteurs et manifestes signés. Si une violation met vos droits en danger, nous la notifierons à l’AEPD sous 72 heures et, le cas échéant, à vous (art. 33 et 34 RGPD).

## 9. Modifications

Si nous modifions cette politique de façon importante, nous l’annoncerons sur genpm.net et, si vous avez un compte, par e-mail à l’avance.
