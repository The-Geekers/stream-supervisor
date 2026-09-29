# Restreamer Adapter

**État : monitoring + contrôle egress limité dans `0.1.0-alpha.9`.**

## Instance auditée

- datarhei Core `16.0.0`
- authentification `localjwt`
- identité Core via `GET /api`
- login via `POST /api/login`
- processus via `GET /api/v3/process`
- commande process via `PUT /api/v3/process/:id/command`
- Web UI statique servie sous `/ui/`

## Noms des channels et destinations

- ingest/channel : `metadata["restreamer-ui"].meta.name`
- egress/destination : `metadata["restreamer-ui"].name`

## Monitoring temps réel

Supervisor interroge l'état des processus une seule fois côté backend, par défaut toutes les `1000 ms`, puis diffuse le snapshot sanitizé aux navigateurs via SSE.

## Séparation Core / Web UI

Supervisor distingue :
- Core/API ;
- Web UI servie sous `/ui/`.

La Web UI n'est toutefois **pas un processus séparé**. Dans datarhei Core, `CORE_ROUTER_UI_PATH` désigne un répertoire de fichiers statiques monté sur la route `/ui` par le même serveur HTTP que l'API.

Il n'existe donc pas de restart serveur « UI only ».

Le endpoint `/api/v3/config/reload` recharge la configuration mais déclenche un restart de Core. Supervisor ne l'utilise pas comme mécanisme de récupération UI.

Si l'UI tombe alors que l'API reste disponible, Supervisor continue à monitorer et à piloter les destinations via l'API sans toucher aux flux.

## Écriture alpha.9

Les seules commandes exposées sont `start` et `stop` sur un egress existant.

La chaîne de validation est :
1. authentification Supervisor obligatoire ;
2. rôle Admin ou Technician ;
3. ID présent dans le snapshot sanitizé courant ;
4. ID conforme à `restreamer-ui:egress:<provider>:<uuid>` ;
5. commande limitée à `start` ou `stop` ;
6. appel Core `PUT /api/v3/process/:id/command`.

Aucune action ingest, restart, reload, modification d'URL ou de clé n'est exposée.

## Sécurité des données

Le payload Core brut reste en mémoire backend uniquement. Les champs `command`, `address`, `last_logline`, URLs, credentials, stream keys, JWT et metadata arbitraire sont supprimés par allow-list avant exposition.
