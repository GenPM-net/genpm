---
title: Modèle de sécurité
section: Sécurité
order: 50
---
GenPM est sûr par conception et vérifiable par tous. Il ne promet jamais « 100 % sûr » ; il garantit dix invariants, chacun avec un test qui bloque toute release :

1. **Intégrité** : les octets installés sont exactement l’arbre du commit `c`, jamais une branche.
2. **Zéro exécution** : pas de scripts de cycle de vie, de hooks Git, de sous-modules ni de filtres.
3. **Confinement** : les écritures restent dans le projet, sur les chemins du plan.
4. **Pas d’exécutables** : les fichiers injectés sont écrits en mode `0644`.
5. **Consentement** : ni config MCP, ni installation npm, ni écrasement sans votre accord.
6. **Secrets** : GenPM ne lit jamais les valeurs de `.env`.
7. **Autorité du registry** : la publication lit GitHub, jamais ce qu’envoie le client.
8. **Manifestes signés** : le CLI n’installe que des manifestes signés en Ed25519.
9. **Immuabilité** : une version publiée ne change jamais.
10. **Isolation entre tenants** : aucune requête ne traverse les registries.

Le même scanner déterministe tourne dans le registry (à la publication) et dans le CLI (à chaque installation) : compromettre le registry ne suffit pas à le contourner.

## Signaler une vulnérabilité

Écrivez à **hello@genpm.net** avec l’objet `[SECURITY]` ou utilisez GitHub Private Vulnerability Reporting. Première réponse sous 48 heures. Voir [/security](/security).
