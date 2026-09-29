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

`0.1.0-alpha.3`

- application Docker fonctionnelle ;
- adapter Restreamer Core 16 en lecture seule ;
- channels et destinations regroupés à partir des processus Restreamer ;
- noms récupérés depuis les metadata `restreamer-ui` ;
- métriques essentielles : état, runtime, FPS, bitrate, codecs et format ;
- CI et tests anti-fuite de secrets ;
- interface orientée régie plutôt que dashboard SaaS.

Aucune commande start/stop n'est encore exposée.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
./deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md` et `docs/`.
