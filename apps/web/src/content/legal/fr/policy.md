---
title: Politique des paquets
updated: 2026-10-03
---
Cette politique garde GenPM sûr pour toutes les personnes qui installent des paquets et pour les agents IA qui lisent leurs règles. Elle fait partie des [Conditions d’utilisation](/terms) et définit nos règles de modération des contenus au titre du règlement (UE) 2022/2065 sur les services numériques (DSA). La version espagnole fait foi en cas de divergence.

## 1. Ce qui est interdit

- Les logiciels malveillants, voleurs d’identifiants, mineurs de cryptomonnaies ou le code qui exfiltre des données.
- Les règles IA qui tentent de passer outre les instructions de l’utilisateur, de lui cacher des actions ou de demander à l’agent d’envoyer des données ailleurs (*prompt injection*).
- Les fichiers qui s’exécutent automatiquement à l’ouverture ou à l’installation d’un projet : scripts d’installation, `.npmrc`, `.envrc`, `.vscode/tasks.json`, hooks git et similaires.
- Les secrets : clés d’API, jetons ou clés privées, même révoqués.
- Les contenus portant atteinte aux droits de propriété intellectuelle ou industrielle de tiers, ou tout autre contenu illicite.
- Le typosquatting ou l’usurpation d’un autre éditeur ou d’une marque.
- Le spam, les paquets vides ou la réservation abusive de noms.

## 2. Comment nous le détectons

- **Automatiquement :** chaque version est analysée à la publication, puis à nouveau par le CLI à l’installation (fichiers à exécution automatique, secrets, chemins dangereux, liens symboliques et signes de prompt injection dans les règles IA).
- **Par les signalements** de n’importe qui (voir §4).
- **Examen humain :** les versions signalées sont mises en examen et ne peuvent pas être installées tant qu’une personne ne les a pas examinées, sous 24 heures ouvrées. Aucun retrait définitif n’est décidé par des moyens automatisés seuls.

## 3. Mesures possibles

Selon la gravité : mettre la version en examen, la retirer (*yank*), mettre en examen tout le paquet ou le scope, publier un avis de sécurité sur [/security/advisories](/security/advisories) et, en cas d’infraction grave ou répétée, suspendre le compte. Les mesures sont proportionnées et tiennent compte des droits et intérêts de toutes les parties.

## 4. Comment signaler un contenu

Tout le monde peut signaler un paquet, même sans compte :

- avec le bouton **Signaler** de la page du paquet (connexion GitHub requise), ou
- par e-mail à {{email}} avec l’objet « [REPORT] ».

Pour que nous puissions agir, indiquez : le paquet et la version (ou son URL), pourquoi vous pensez qu’il est illicite ou enfreint cette politique, votre nom et votre e-mail, et une déclaration selon laquelle ces informations sont exactes et complètes à votre connaissance. Pour les vulnérabilités de GenPM lui-même, voir [/security](/security).

Nous accuserons réception et vous informerons de notre décision et des voies de recours. Si nous détectons des indices d’une infraction pénale menaçant la vie ou la sécurité des personnes, nous en informerons les autorités compétentes (art. 18 DSA).

## 5. Si nous agissons sur votre contenu

Si nous retirons ou restreignons l’un de vos paquets ou suspendons votre compte, nous vous enverrons un exposé des motifs (art. 17 DSA) : la mesure, pourquoi, les faits sur lesquels elle repose, si des moyens automatisés ont été utilisés et la règle ou clause appliquée.

**Recours :** vous pouvez nous demander de réexaminer la décision par e-mail à {{email}} avec l’objet « [APPEAL] » dans un délai de 6 mois. Une personne, et non l’analyse automatique, l’examinera et nous vous répondrons de manière motivée. Vous pouvez aussi saisir la justice.

## 6. Transparence

Nous publions les avis de sécurité sur [/security/advisories](/security/advisories) et dans un flux JSON.
