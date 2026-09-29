# Security Policy

## Dépôt public

Ce dépôt est public. Tout fichier commité doit être considéré comme publiquement accessible.

Ne jamais commiter de `.env` réel, mots de passe, stream keys, tokens OAuth/API, cookies, sessions, bases de données, sauvegardes de production ou diagnostics contenant des secrets.

## Restreamer

Les processus de streaming peuvent exposer des clés de stream ou URL privées dans les lignes de commande, adresses et logs.

Supervisor applique une allow-list backend avant toute exposition au frontend. Les champs bruts tels que `command`, `address`, `last_logline`, URL de stream, credentials et JWT ne doivent jamais quitter l'adapter moteur.

### Actions opérateur

Les seules écritures Restreamer disponibles sont :
- `start` d'une destination egress existante ;
- `stop` d'une destination egress existante.

Le backend :
- exige une authentification Supervisor ;
- exige le rôle Admin ou Technician ;
- exige un en-tête d'action same-origin ;
- refuse les commandes autres que `start` / `stop` ;
- refuse les process IDs autres que les IDs egress au format attendu ;
- refuse les IDs qui ne sont pas présents dans le snapshot sanitizé courant ;
- ne permet ni restart Core, ni config reload, ni modification de process.

## Docker

Le backend Web Supervisor ne reçoit pas le socket Docker.

Le composant `docker-observer` est isolé : aucun port, aucun réseau, filesystem read-only hors volume de sortie, `no-new-privileges`, capabilities supprimées.

## Accès Supervisor

Les credentials sont uniquement dans le `.env` local :

```text
SUPERVISOR_USERNAME=
SUPERVISOR_PASSWORD=
SUPERVISOR_TECH_USERNAME=
SUPERVISOR_TECH_PASSWORD=
```

`SUPERVISOR_USERNAME` correspond au rôle Admin. Le compte Technician est optionnel.

Sans compte configuré, le monitoring reste accessible mais toutes les écritures sont verrouillées.

## Web UI Restreamer

La UI statique est servie par le même Core que l'API. Aucun bouton « restart UI » serveur n'est exposé car il n'existe pas de service UI séparé.

Le reload de configuration Core n'est pas utilisé comme mécanisme de récupération UI car il redémarre Core.

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

## Signalement

Ne jamais publier de secrets ou détails exploitables dans une issue publique.
