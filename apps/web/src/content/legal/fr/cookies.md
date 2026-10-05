---
title: Politique relative aux cookies
updated: 2026-10-05
---
Cette politique respecte l’article 22.2 de la loi espagnole 34/2002 sur les services de la société de l’information (LSSI-CE) et le guide sur les cookies de l’Agence espagnole de protection des données. La version espagnole fait foi en cas de divergence.

## En bref

genpm.net utilise **des cookies techniques et de préférences que vous choisissez vous-même**, exemptés de consentement (art. 22.2 LSSI-CE), et **une mesure d’audience facultative qui ne s’active que si vous l’acceptez** dans l’avis affiché lors de votre première visite. « Accepter » et « Refuser » ont le même poids : si vous refusez ou ne choisissez pas, aucun script de mesure d’audience n’est chargé et rien n’est stocké sur votre appareil. Nous n’utilisons aucun cookie publicitaire. Par ailleurs, nous comptons sur nos serveurs les pages que vous demandez (pages vues, recherches, paquets, provenance et pays, sans IP ni identifiant) : cela ne stocke rien dans votre navigateur.

## Ce que nous stockons dans votre navigateur

| Nom | Type | Responsable | Finalité | Durée |
|---|---|---|---|---|
| `__Host-genpm_session` | Cookie technique | GenPM | Vous garder connecté, seulement si vous vous connectez | 30 jours |
| `__Host-genpm_oauth` | Cookie technique | GenPM | Protéger la connexion GitHub contre la falsification (CSRF) | 10 minutes |
| `genpm-theme` | Stockage local | GenPM | Mémoriser le mode clair ou sombre que vous choisissez | Jusqu’à ce que vous l’effaciez |
| `genpm-lang-dismissed` | Stockage local | GenPM | Ne plus suggérer une autre langue après avoir fermé l’avis | Jusqu’à ce que vous l’effaciez |
| `genpm_consent` | Cookie de préférence | GenPM | Mémoriser si vous avez accepté ou refusé la mesure d’audience facultative | 6 mois |

## Mesure d’audience facultative (uniquement si vous l’acceptez)

Si vous cliquez sur « Accepter », nous utilisons **PostHog** (PostHog, Inc., données hébergées dans l’UE) pour obtenir des cartes de chaleur des clics et du défilement et des enregistrements de session anonymes, champs de formulaire masqués. Les pages de compte (connexion, jetons, tableau de bord et publication) ne sont jamais enregistrées, et les requêtes passent par notre propre domaine sans transmettre votre IP.

| Nom | Type | Titulaire | Finalité | Durée |
|---|---|---|---|---|
| `ph_<clé>_posthog` | Cookie et stockage local de mesure d’audience | PostHog (tiers, sous-traitant de GenPM) | Identifiant aléatoire pour regrouper vos visites et la session enregistrée | 12 mois |
| `ph_*` dans `sessionStorage` | Stockage de session de mesure d’audience | PostHog | Conserver l’enregistrement de la session en cours | Jusqu’à la fermeture de l’onglet |

**Changer d’avis :** cliquez sur « Préférences de cookies » en pied de page. Si vous retirez votre consentement, nous cessons de charger PostHog et supprimons ses cookies et son stockage de votre navigateur. Le retirer est aussi simple que le donner et ne limite rien de ce que vous pouvez faire sur le site.

## Sécurité Cloudflare

Le site est servi via Cloudflare. Pour le protéger contre les attaques automatisées, Cloudflare peut déposer des cookies techniques de sécurité (par exemple `__cf_bm`, 30 minutes, ou `cf_clearance`) et, sur les formulaires sponsors et entreprises, le test anti-bots **Turnstile** peut lire des informations techniques du navigateur pour distinguer les personnes des bots. Leur seule finalité est la sécurité du service que vous demandez : ils ne servent ni à la publicité ni à vous suivre d’un site à l’autre. Plus d’informations dans la [politique de cookies de Cloudflare](https://www.cloudflare.com/cookie-policy/).

## Comment les supprimer ou les bloquer

Vous pouvez supprimer ou bloquer les cookies et le stockage local dans les paramètres de votre navigateur ([Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/guide/safari/sfri11471), [Edge](https://support.microsoft.com/microsoft-edge)). Si vous bloquez `__Host-genpm_session`, vous ne pourrez pas vous connecter, mais vous pourrez toujours chercher et installer des paquets.

## Le CLI et le serveur MCP

Le CLI `genpm` et le serveur `@genpm-net/mcp` n’utilisent pas de cookies. Pour la télémétrie d’installation et la façon de la désactiver, voir la [Politique de confidentialité](/privacy).

Si nous modifions les cookies utilisés, nous mettrons à jour cette politique et, si la finalité change, nous vous redemanderons votre consentement.
