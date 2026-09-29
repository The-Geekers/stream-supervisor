# Restreamer Adapter

**État : lecture seule avancée dans `0.1.0-alpha.6`.**

## Instance actuellement auditée

- datarhei Core `16.0.0`
- authentification `localjwt`
- identité Core via `GET /api`
- login via `POST /api/login`
- processus via `GET /api/v3/process`

Supervisor demande uniquement les aspects `state,metadata`.

## Noms des channels et destinations

Le code de Restreamer UI ne stocke pas les deux noms au même endroit :

- **ingest / channel** : `metadata["restreamer-ui"].meta.name`
- **egress / destination** : `metadata["restreamer-ui"].name`

Cette différence explique le défaut `Canal sans nom` observé en alpha.5. L'alpha.6 suit désormais le même modèle que Restreamer UI.

## Monitoring temps réel

Supervisor interroge l'état des processus Restreamer une seule fois côté backend, par défaut toutes les `1000 ms`.

Les navigateurs ne déclenchent pas chacun leurs propres appels Core : ils reçoivent le snapshot sanitizé via **Server-Sent Events (SSE)** sur `/api/events`.

- intervalle par défaut : `MONITOR_INTERVAL_MS=1000`
- intervalle minimum accepté : `500 ms`
- probes Core/About et Web UI plus lentes : cache de `5 s`
- reconnexion SSE automatique côté navigateur

Cela donne une sensation quasi temps réel tout en gardant un seul polling Core partagé, quel que soit le nombre d'opérateurs connectés.

## Séparation Core / UI

Supervisor surveille deux composants indépendants :

- **Core/API** : disponibilité, authentification, version et latence ;
- **Web UI Restreamer** : disponibilité HTTP, code de réponse et latence.

Le défaut de la Web UI ne transforme pas automatiquement l'état du Core en erreur et ne déclenche aucune action de récupération.

## Sécurité des données

Le `state` Restreamer contient des champs sensibles, notamment la commande FFmpeg et les adresses des flux. Le backend applique une **allow-list stricte** immédiatement après réception du payload.

Aucun de ces champs ne peut quitter l'adapter : `command`, `address`, `last_logline`, URLs/query strings, credentials, stream keys, JWT ou metadata arbitraire.

Les seules métadonnées utilisées pour l'affichage sont les noms de channel/destination.

## Modèle channels

Restreamer associe les processus par `reference`.

- `restreamer-ui:ingest:<uuid>` = entrée principale d'un channel
- `restreamer-ui:egress:<service>:<uuid>` = destination
- `reference` d'un egress = channel auquel il appartient

Les processus snapshot ne font pas partie du modèle de supervision principal.

Le tri par défaut est alphabétique par nom, avec l'ID stable comme second critère afin d'éviter que les lignes changent de place lors des rafraîchissements.

## Filtres

Les filtres `INGEST LIVE` et `INGEST STOPPED` concernent l'état du **channel ingest**. Les destinations restent affichées dans la ligne du channel, même si certaines sont `STOPPED`.

## Écriture

Aucune commande Restreamer n'est envoyée dans cette version. Supervisor reste strictement read-only.
