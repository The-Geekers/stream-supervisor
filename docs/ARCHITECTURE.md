# Architecture

## Principe

Supervisor est un plan de contrôle et d'observabilité. Il ne transporte jamais le média.

```text
OBS / encodeur
      |
      v
Moteur de streaming ------------------> destinations
      ^
      |
 Supervisor backend
      |
      +-- System Adapter
      +-- Docker Adapter
      +-- Streaming Engine Adapters
            +-- Restreamer
            +-- MediaMTX
            +-- Muxshed
```

Si Supervisor s'arrête, les flux existants continuent.

## Séparation frontend / backend

Le navigateur communique uniquement avec le backend Supervisor. Toutes les opérations privilégiées système, Docker ou moteurs restent côté backend.

## Adaptateurs

Chaque moteur doit exposer autant que possible un modèle commun : health, channels/inputs, outputs, state, metrics et actions sûres.

## Déploiement initial

Pendant le développement, Supervisor pourra écouter uniquement sur localhost, par exemple `127.0.0.1:8090`. L'exposition HTTPS sera décidée après validation de l'application.
