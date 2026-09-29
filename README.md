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

`0.1.0-alpha.9`

- adapter Restreamer Core 16 avec monitoring et contrôle limité des destinations ;
- channels, destinations et métriques de streaming en pseudo temps réel SSE ;
- monitoring VPS : CPU, RAM, disque, réseau, load et uptime ;
- page **SYSTEM** avec Docker Adapter read-only ;
- rôles Supervisor **Admin** et **Technician** ;
- interface ouverte = monitoring uniquement, aucune action d'écriture ;
- une fois authentifié, Admin et Technician peuvent démarrer/arrêter une destination Restreamer existante ;
- aucune modification de clé, URL, configuration de process ou channel n'est exposée ;
- confirmation avant action opérateur ;
- anti-CSRF par en-tête d'action same-origin ;
- validation serveur stricte : seules les IDs egress déjà découvertes et les commandes `start` / `stop` sont acceptées ;
- tests anti-fuite de secrets, smoke tests Docker/auth et captures visuelles CI.

## Authentification

`SUPERVISOR_USERNAME` / `SUPERVISOR_PASSWORD` définissent le compte Admin.

Un compte Technician optionnel peut être configuré avec :

```text
SUPERVISOR_TECH_USERNAME=
SUPERVISOR_TECH_PASSWORD=
```

Un assistant interactif est fourni :

```bash
sh deployment/configure-auth.sh
```

Il demande les mots de passe sans les afficher et met à jour uniquement le `.env` local du VPS.

## Restreamer Web UI

La Web UI Restreamer n'est pas un service indépendant : datarhei Core sert les fichiers UI statiques sur `/ui/` dans le même serveur HTTP que l'API.

Conséquence : il n'existe pas de « restart UI » serveur isolé qui garantisse de ne pas toucher Core.

Supervisor adopte donc la stratégie suivante :
- probe séparé de `/ui/` ;
- si l'UI est dégradée mais l'API Core reste disponible, aucune relance Core n'est faite ;
- l'exploitation peut continuer via Supervisor et l'API ;
- le reload de configuration Core n'est pas utilisé comme récupération UI, car il redémarre Core ;
- un éventuel restart complet du conteneur restera un dernier recours futur du watchdog.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
sh deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md` et `docs/`.
