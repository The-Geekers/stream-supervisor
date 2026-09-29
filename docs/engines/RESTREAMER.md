# Restreamer Adapter

**État : lecture seule active dans `0.1.0-alpha.3`.**

## Instance actuellement auditée

- datarhei Core `16.0.0`
- authentification `localjwt`
- identité Core via `GET /api`
- login via `POST /api/login`
- processus via `GET /api/v3/process`

Supervisor demande uniquement les aspects `state,metadata`.

## Sécurité des données

Le `state` Restreamer contient des champs sensibles, notamment la commande FFmpeg et les adresses des flux. Le backend applique donc une **allow-list stricte** immédiatement après réception du payload.

Aucun de ces champs ne peut quitter l'adapter : `command`, `address`, `last_logline`, URLs/query strings, credentials, stream keys, JWT ou metadata arbitraire.

Les seules métadonnées Restreamer UI actuellement retenues sont le champ `name`.

Un test automatisé injecte de faux credentials et une fausse clé de stream dans un payload brut et vérifie qu'ils sont absents du modèle exposé par Supervisor.

## Modèle channels

Restreamer associe les processus par `reference`.

- `restreamer-ui:ingest:<uuid>` = entrée principale d'un channel
- `restreamer-ui:egress:<service>:<uuid>` = destination
- `metadata["restreamer-ui"].name` = nom affiché dans l'UI Restreamer
- `reference` d'un egress = channel auquel il appartient

Les processus snapshot ne font pas partie du modèle de supervision principal.

## États Supervisor

### Ingest
- `LIVE` : process `running` avec signal/fps
- `CONNECTING` : process démarré mais signal pas encore établi
- `NO SOURCE` : ordre `start`, process en échec/terminé sans source disponible
- `STOPPED` : ordre `stop`

### Egress
- `LIVE` : process `running`
- `CONNECTING` : démarrage/arrêt transitoire
- `ERROR` : ordre `start` avec process en échec
- `STOPPED` : ordre `stop`

## Écriture

Aucune commande Restreamer n'est envoyée dans cette version. Le Supervisor reste strictement read-only.
