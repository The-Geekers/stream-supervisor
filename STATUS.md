# Project Status

**Version :** 0.1.0-alpha.4  
**Phase :** supervision Restreamer read-only avancée

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 4 |
| Audit Core Restreamer | Core 16.0.0 identifié |
| Auth API Restreamer | OK |
| État Web UI Restreamer séparé | Intégré |
| Noms de channels via metadata | Intégré |
| Ingest / outputs / métriques | Lecture seule intégrée |
| Filtres opérateur | Intégrés |
| Tests anti-fuite secrets | Intégrés |
| Auth Supervisor | Basic Auth optionnelle |
| CI GitHub qualité | Intégrée |
| CI visuelle / capture UI | Intégrée |
| Monitoring système VPS | Partiel, métriques actuelles = conteneur Supervisor |
| Docker Adapter | À faire |
| Start/stop sorties | À faire après sécurisation accès |
| Diagnostics | À faire |
| Watchdog | À faire |

## Sécurité d'accès

L'interface reste utilisable sans authentification pendant la phase read-only, mais affiche explicitement `ACCESS OPEN`.

Avant l'introduction de commandes d'écriture, `SUPERVISOR_USERNAME` et `SUPERVISOR_PASSWORD` devront être définis dans le `.env` local du VPS.

## Déploiement

GitHub `main` est la source de vérité. Le VPS ne sert plus au développement du code.

```bash
sh deployment/update.sh
```

Le fichier `.env` contenant les secrets reste uniquement sur le VPS.

## Prochaine étape

Valider alpha.4 sur les flux réels, puis sécuriser l'accès Supervisor et préparer les commandes start/stop de destinations avec confirmation et journal d'action.
