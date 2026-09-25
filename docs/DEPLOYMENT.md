# Deployment

Le mode de déploiement final n'est pas encore figé.

## Direction actuelle

- Application conteneurisée.
- Données persistantes hors image.
- Écoute locale pendant le développement.
- HTTPS via reverse proxy après validation.
- Supervisor indépendant des conteneurs Restreamer, MediaMTX ou Muxshed.

## Règle

Ne jamais accorder des privilèges système ou Docker supplémentaires uniquement pour simplifier le développement.
