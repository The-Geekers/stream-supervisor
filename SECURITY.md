# Security Policy

## Dépôt public

Ce dépôt est public. Tout fichier commité doit être considéré comme publiquement accessible.

Ne jamais commiter de `.env` réel, mots de passe, stream keys, tokens OAuth/API, cookies, sessions, bases de données, sauvegardes de production ou diagnostics contenant des secrets.

## Restreamer

Les processus de streaming peuvent exposer des clés de stream ou URL privées dans les lignes de commande, adresses et logs.

Supervisor applique une allow-list backend avant toute exposition au frontend. Les champs bruts tels que `command`, `address`, `last_logline`, URL de stream, credentials et JWT ne doivent jamais quitter l'adapter moteur.

### Actions opérateur

Les écritures normales Restreamer restent limitées à :
- `start` d'une destination egress existante ;
- `stop` d'une destination egress existante.

Le backend exige une authentification Supervisor, un en-tête d'action same-origin, valide les IDs egress depuis le snapshot sanitizé et refuse toute commande arbitraire.

Alpha.18 ajoute une seule action globale exceptionnelle : **restart manuel du conteneur Restreamer**, uniquement pour le rôle Admin. Elle ne passe pas par une commande Core générique et n'autorise ni config reload, ni modification de process, ni restart d'un autre conteneur. Technician reste limité aux start/stop egress.

## Docker

Le backend Web Supervisor et le frontend ne reçoivent jamais le socket Docker.

Le composant `docker-observer` reste strictement read-only : socket monté en lecture seule, aucun port, aucun réseau, filesystem read-only hors volume de sortie, `no-new-privileges`, capabilities supprimées.

Alpha.18 ajoute `docker-control`, séparé de l'observer. Ce helper :
- est le seul composant Supervisor avec le socket Docker monté en écriture ;
- n'a aucun port publié sur l'hôte et n'appartient pas au réseau public `web-proxy` ;
- est joignable uniquement par Supervisor sur un réseau Docker `internal` dédié ;
- n'expose qu'une route de restart avec une cible fixée à `restreamer` ;
- inspecte d'abord la cible et refuse de transformer le restart en start si le conteneur est arrêté ;
- ne propose aucun proxy Docker générique, exec, stop, remove, create ou accès arbitraire à un autre conteneur.

Le montage du socket Docker reste une capacité sensible : le helper est donc volontairement minimal, dédié et non exposé. Toute extension de ses possibilités doit être traitée comme une évolution de sécurité.

## Accès Supervisor

Les credentials sont uniquement dans le `.env` local :

```text
SUPERVISOR_USERNAME=
SUPERVISOR_PASSWORD=
SUPERVISOR_TECH_USERNAME=
SUPERVISOR_TECH_PASSWORD=
```

`SUPERVISOR_USERNAME` correspond au rôle Admin. Le compte Technician est optionnel.

Quand l'authentification est configurée, le navigateur utilise l'écran de connexion intégré. Les credentials servent uniquement à ouvrir une session côté serveur. Le navigateur reçoit un cookie de session HttpOnly / SameSite=Strict ; il n'a pas accès au token via JavaScript. Le bouton LOG OUT invalide la session côté serveur et efface le cookie.

Les sessions expirent après une durée configurable (`SUPERVISOR_SESSION_TTL_MS`, 8 h par défaut). Le cookie reçoit `Secure` lorsque la requête arrive via HTTPS derrière le reverse proxy, ou lorsque `SUPERVISOR_COOKIE_SECURE=true` est forcé.

Les échecs de connexion sont limités par fenêtre temporelle afin de réduire les tentatives répétées.

Sans compte configuré, le monitoring reste accessible mais toutes les écritures sont verrouillées.

## Web UI Restreamer

La UI statique est servie par le même Core que l'API. Aucun bouton « restart UI » serveur n'est exposé car il n'existe pas de service UI séparé.

Le reload de configuration Core n'est pas utilisé comme mécanisme de récupération UI car il redémarre Core. En dernier recours, un Admin peut déclencher le restart manuel du conteneur avec avertissement explicite et journalisation.

## Incidents et journal d'événements

Le journal persistant n'enregistre jamais de payload moteur brut.

Les événements sont reconstruits uniquement à partir des modèles déjà sanitizés et passent par une seconde allow-list avant écriture. Les champs persistés sont limités aux identifiants d'événement/incident, horodatage, type, sévérité, source, titre, détail court, noms de channel/destination, acteur et résultat d'action.

Les clés de stream, URL de diffusion, JWT, credentials, commandes FFmpeg, variables d'environnement et logs Restreamer bruts ne doivent jamais être persistés dans le journal.

## Diagnostics

La page DIAGNOSTICS et l'export JSON sont construits uniquement depuis des modèles déjà sanitizés et repassent par une allow-list dédiée.

L'export exclut explicitement :
- payloads moteur bruts ;
- adresses et clés de stream ;
- credentials et JWT ;
- commandes FFmpeg ;
- variables d'environnement ;
- logs bruts.

Les diagnostics sont read-only et n'exécutent aucune action corrective.

## Watchdog gradué

Le watchdog est désarmé par défaut pour les écritures automatiques :

```text
WATCHDOG_MODE=observe
WATCHDOG_OUTPUT_RECOVERY=false
```

En alpha.12, la seule recovery automatisable est une commande `start` ciblée sur un egress déjà classé `ERROR`, avec ingest `LIVE` et incident actif. Le watchdog applique un seuil de persistance, un cooldown, une limite de tentatives et une vérification post-action.

Le verrou d'action egress est partagé avec les commandes opérateur afin d'éviter deux écritures concurrentes sur la même destination.

Sont explicitement interdits en automatique :
- restart de Restreamer Core ;
- restart du conteneur Restreamer ;
- config reload Core ;
- modification de clé, URL ou configuration de process ;
- action sur un ingest ;
- action sur une destination simplement `STOPPED`.

Les événements watchdog passent par le même journal allow-listé que les incidents et actions opérateur.

## Signalement

Ne jamais publier de secrets ou détails exploitables dans une issue publique.
