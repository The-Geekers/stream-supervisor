# Project Status

**Version :** 0.1.0-alpha.3  
**Phase :** intégration Restreamer en lecture seule

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 3 |
| Audit Core Restreamer | Core 16.0.0 identifié |
| Auth API Restreamer | OK |
| Noms de channels via metadata | Intégré |
| Ingest / outputs / métriques | Lecture seule intégrée |
| Tests anti-fuite secrets | Intégrés |
| CI GitHub | Intégrée |
| Monitoring système VPS | Partiel |
| Docker Adapter | À faire |
| Authentification Supervisor | À faire |
| Start/stop sorties | À faire après validation read-only |
| Diagnostics | À faire |
| Watchdog | À faire |

## Principe de déploiement

GitHub `main` est la source de vérité. Le VPS ne sert plus au développement du code.

Après le premier alignement du VPS, les mises à jour se font avec :

```bash
sh deployment/update.sh
```

Le fichier `.env` contenant les secrets reste uniquement sur le VPS.

## Prochaine étape

Valider `alpha.3` sur l'instance réelle puis enrichir la vue channel et préparer le Docker/System adapter sans introduire d'action destructive.
