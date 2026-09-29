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
      +-- Docker Adapter <----- sanitized snapshot ----- Docker Observer ----- docker.sock
      +-- Streaming Engine Adapters
            +-- Restreamer
            +-- MediaMTX
            +-- Muxshed
```

Si Supervisor s'arrête, les flux existants continuent.

## Séparation frontend / backend

Le navigateur communique uniquement avec le backend Supervisor.

Le backend produit un snapshot sanitizé et le diffuse aux navigateurs par Server-Sent Events. Le nombre de navigateurs ouverts ne multiplie donc pas les appels Restreamer.

## System Adapter

Le System Adapter lit uniquement :
- CPU depuis `/proc/stat` ;
- mémoire depuis `/proc/meminfo` ;
- load depuis `/proc/loadavg` ;
- uptime depuis `/proc/uptime` ;
- compteurs réseau RX/TX via `/sys/class/net/<interface>/statistics/` ;
- usage du filesystem via `statfs` sur un répertoire vide bind-mounté.

Aucun mount complet de `/` n'est nécessaire.

## Docker Adapter

Le socket Docker n'est pas monté dans Supervisor.

Un helper séparé, sans réseau, lit Docker et produit un fichier JSON sanitizé. Le backend monte uniquement le volume de snapshot en lecture seule.

Cette séparation réduit fortement l'exposition du socket Docker à une surface Web. Le snapshot ne contient qu'une allow-list opérationnelle.

## Adaptateurs moteurs

Chaque moteur doit exposer autant que possible un modèle commun : health, channels/inputs, outputs, state, metrics et actions sûres.

## Déploiement initial

Pendant le développement, Supervisor peut être exposé directement sur le port 8090. Avant toute commande d'écriture, l'accès devra être authentifié et placé derrière HTTPS/reverse proxy.
