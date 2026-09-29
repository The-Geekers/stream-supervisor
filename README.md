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

`0.1.0-alpha.5`

- application Docker fonctionnelle ;
- adapter Restreamer Core 16 en lecture seule ;
- Core/API et Web UI Restreamer supervisés séparément ;
- channels et destinations regroupés à partir des processus Restreamer ;
- noms récupérés depuis les metadata `restreamer-ui` ;
- métriques opérationnelles : état, runtime, FPS, bitrate, codecs, vidéo, audio, drop/dup, CPU/mémoire process ;
- filtres All / Live / Issues / Stopped ;
- tri des channels par nom ou par état ;
- total débit entrant et sortant Restreamer ;
- total CPU et RAM des processus ingest/egress supervisés ;
- authentification HTTP Basic optionnelle pour Supervisor ;
- CI qualité et tests anti-fuite de secrets ;
- CI visuelle avec capture automatique de l'interface sur données fictives sûres.

Aucune commande start/stop n'est encore exposée. L'alpha 5 reste strictement read-only.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
sh deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md` et `docs/`.
