# Project Status

**Version :** 0.1.0-alpha.7  
**Phase :** supervision Restreamer + VPS en lecture seule

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 7 |
| Audit Core Restreamer | Core 16.0.0 identifié |
| Auth API Restreamer | OK |
| État Web UI Restreamer séparé | Intégré |
| Noms de channels | Intégrés |
| Ingest / outputs / métriques | Lecture seule intégrée |
| Filtres opérateur | Intégrés |
| Tri par en-tête de colonne | Intégré |
| Tri ascendant / descendant | Intégré |
| Débit total entrant / sortant Restreamer | Intégré |
| CPU / RAM cumulés processus Restreamer | Intégrés |
| VPS CPU / RAM / load / uptime | Intégrés |
| VPS disque racine | Intégré |
| VPS réseau IN / OUT | Intégré |
| Stabilité scrollbar / layout | Intégrée |
| Tests anti-fuite secrets | Intégrés |
| Auth Supervisor | Basic Auth optionnelle |
| CI GitHub qualité | Intégrée |
| Monitoring SSE quasi temps réel | Intégré, 1 s par défaut |
| CI visuelle / capture UI | Intégrée |
| Docker Adapter | À faire |
| Start/stop sorties | À faire après sécurisation accès |
| Diagnostics | À faire |
| Watchdog | À faire |

## Sécurité du System Adapter

Le System Adapter ne reçoit ni socket Docker, ni mount complet de `/`, ni mode privileged.

Seuls quelques fichiers `/proc` nécessaires aux métriques sont montés en lecture seule. Le disque est mesuré via un répertoire vide de probe sur le filesystem du VPS.

Le conteneur conserve `no-new-privileges` et toutes les capabilities Linux sont supprimées.

## Sécurité d'accès

L'interface reste utilisable sans authentification pendant la phase read-only, mais affiche explicitement `ACCESS OPEN`.

Avant l'introduction de commandes d'écriture, `SUPERVISOR_USERNAME` et `SUPERVISOR_PASSWORD` devront être définis dans le `.env` local du VPS.

## Déploiement

GitHub `main` est la source de vérité. Le VPS ne sert plus au développement du code.

```bash
sh deployment/update.sh
```

Le script prépare automatiquement le répertoire de probe disque avant le rebuild.

## Prochaine étape

Valider alpha.7 sur le VPS réel, comparer les métriques hôte avec les outils système, puis préparer le Docker Adapter read-only.
