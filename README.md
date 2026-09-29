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

`0.1.0-alpha.8`

- adapter Restreamer Core 16 en lecture seule ;
- channels, destinations et métriques de streaming en pseudo temps réel SSE ;
- monitoring VPS : CPU, RAM, disque, réseau, load et uptime ;
- tri des channels depuis les en-têtes du tableau ;
- page **SYSTEM** dédiée ;
- Docker Adapter read-only pour les services explicitement surveillés ;
- état, image, health, uptime, CPU et RAM des conteneurs surveillés ;
- collecte Docker isolée dans un helper sans réseau ;
- le conteneur Web Supervisor ne reçoit jamais le socket Docker ;
- tests anti-fuite de secrets, smoke tests Docker et captures visuelles CI ;
- authentification HTTP Basic optionnelle.

Aucune commande start/stop n'est encore exposée. L'alpha 8 reste strictement read-only.

## Docker Adapter

Le socket Docker est volontairement **absent du conteneur Supervisor**.

Un petit conteneur `stream-supervisor-docker-observer` :

- n'expose aucun port ;
- fonctionne avec `network_mode: none` ;
- lit le socket Docker ;
- extrait uniquement une allow-list de données : nom, image, état, health, uptime, CPU et RAM ;
- écrit un snapshot JSON sanitizé dans un volume Docker partagé ;
- n'expose ni environnement, labels, commande, logs, fichiers ni configuration complète des conteneurs.

Supervisor monte uniquement ce volume en lecture seule.

Par défaut, seuls `restreamer` et `stream-supervisor` sont observés. La liste peut être changée localement avec `DOCKER_MONITOR_CONTAINERS`.

## Monitoring système VPS

Supervisor ne monte pas tout le système de fichiers du VPS.

Le conteneur reçoit uniquement les fichiers nécessaires de `/proc`, les compteurs sysfs RX/TX de l'interface par défaut et un répertoire vide de probe disque.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
sh deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md` et `docs/`.
