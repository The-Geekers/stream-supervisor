# Stream Supervisor

Stream Supervisor est une console indépendante de supervision et d'exploitation pour moteurs de streaming auto-hébergés.

Le premier moteur ciblé est **Restreamer**. L'architecture reste volontairement générique afin de pouvoir ajouter ensuite MediaMTX, Muxshed ou d'autres moteurs.

## Principes fondamentaux

- Le trafic média ne passe jamais par Supervisor.
- Une panne de Supervisor ne doit jamais interrompre un stream actif.
- Une panne de l'interface Web d'un moteur ne doit jamais déclencher seule un redémarrage global.
- Observer d'abord, diagnostiquer ensuite, agir en dernier.
- Aucun secret, clé de stream, token ou mot de passe ne doit être versionné.
- Les payloads moteurs sont transformés par allow-list avant exposition au frontend.

## État actuel

`0.1.0-alpha.7`

- application Docker fonctionnelle ;
- adapter Restreamer Core 16 en lecture seule ;
- Core/API et Web UI Restreamer supervisés séparément ;
- channels et destinations regroupés à partir des processus Restreamer ;
- métriques opérationnelles : état, runtime, FPS, bitrate, codecs, vidéo, audio, drop/dup, CPU/mémoire process ;
- filtres All / Ingest Live / Issues / Ingest Stopped ;
- tri directement depuis chaque en-tête du tableau : channel, ingest, vidéo, audio, ingress, uptime et destinations ;
- tri ascendant / descendant avec ordre déterministe ;
- total débit entrant et sortant Restreamer ;
- total CPU et RAM des processus ingest/egress supervisés ;
- monitoring VPS en lecture seule : CPU, RAM, disque racine, réseau de l'interface par défaut, load et uptime ;
- authentification HTTP Basic optionnelle pour Supervisor ;
- CI qualité et tests anti-fuite de secrets ;
- monitoring quasi temps réel par SSE avec un seul polling Core partagé côté backend ;
- scrollbar réservée en permanence pour éviter les décalages de mise en page ;
- CI visuelle avec capture automatique de l'interface sur données fictives sûres.

Aucune commande start/stop n'est encore exposée. L'alpha 7 reste strictement read-only.

## Monitoring système VPS

Supervisor ne monte pas tout le système de fichiers du VPS et n'utilise pas le socket Docker pour obtenir les métriques système.

Le conteneur reçoit uniquement en lecture seule des fichiers précis et non secrets de `/proc` :

- `/proc/stat`
- `/proc/meminfo`
- `/proc/loadavg`
- `/proc/uptime`
- `/proc/net/dev`
- `/proc/net/route`

Pour l'espace disque, un répertoire vide `runtime/disk-probe` situé sur le filesystem du projet est bind-mounté et mesuré avec `statfs`. Aucun accès général au filesystem hôte n'est nécessaire.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
sh deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md` et `docs/`.
