# Project Status

**Version :** 0.1.0-alpha.8  
**Phase :** supervision Restreamer + VPS + Docker en lecture seule

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 8 |
| Restreamer Core 16 | Intégré |
| Channels / outputs / métriques | Intégrés |
| Tri / filtres opérateur | Intégrés |
| Monitoring SSE quasi temps réel | Intégré, 1 s par défaut |
| VPS CPU / RAM / load / uptime | Intégrés |
| VPS disque racine | Intégré |
| VPS réseau IN / OUT | Interface hôte via sysfs |
| Docker Adapter | Intégré read-only |
| Page SYSTEM | Intégrée |
| Docker états / health / CPU / RAM | Intégrés |
| Isolation socket Docker | Observer sans réseau + snapshot sanitizé |
| Tests anti-fuite secrets | Intégrés |
| CI GitHub qualité | Intégrée |
| CI visuelle Channels + System | Intégrée |
| Auth Supervisor | Basic Auth optionnelle |
| Start/stop sorties | À faire après activation auth |
| Diagnostics | À faire |
| Watchdog | À faire |

## Docker Adapter

Le backend Web n'a pas accès au socket Docker.

Le helper Docker Observer est volontairement séparé du backend :
- aucun port exposé ;
- aucun réseau ;
- aucune donnée brute Docker transmise au navigateur ;
- snapshot allow-listé uniquement ;
- statut considéré hors ligne si le snapshot devient trop ancien.

## Sécurité d'accès

L'interface reste utilisable sans authentification pendant la phase read-only, mais affiche explicitement `ACCESS OPEN`.

Avant toute commande d'écriture, `SUPERVISOR_USERNAME` et `SUPERVISOR_PASSWORD` devront être définis dans le `.env` local du VPS.

## Prochaine étape

Valider alpha.8 sur le VPS réel. Ensuite : activation de l'auth Supervisor et préparation des premières commandes opérateur limitées aux destinations Restreamer.
