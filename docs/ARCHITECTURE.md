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

Le backend produit un snapshot sanitizé et le diffuse aux navigateurs par Server-Sent Events. Le nombre de navigateurs ouverts ne multiplie donc pas les appels Restreamer.

## System Adapter

Le System Adapter lit uniquement les métriques hôte nécessaires :

- CPU depuis `/proc/stat` ;
- mémoire depuis `/proc/meminfo` ;
- load depuis `/proc/loadavg` ;
- uptime depuis `/proc/uptime` ;
- interface réseau par défaut depuis `/proc/net/route` ;
- compteurs réseau depuis `/proc/net/dev` ;
- usage du filesystem via `statfs` sur un répertoire vide bind-mounté.

Aucun mount complet de `/` n'est nécessaire. Le System Adapter ne lit aucun environnement de processus, aucune ligne de commande et aucun fichier de configuration du VPS.

## Adaptateurs

Chaque moteur doit exposer autant que possible un modèle commun : health, channels/inputs, outputs, state, metrics et actions sûres.

## Déploiement initial

Pendant le développement, Supervisor peut être exposé directement sur le port 8090. Avant toute commande d'écriture, l'accès devra être authentifié et placé derrière HTTPS/reverse proxy.
