# Security Policy

## Dépôt public

Ce dépôt est public. Tout fichier commité doit être considéré comme publiquement accessible.

Ne jamais commiter de `.env` réel, mots de passe, stream keys, tokens OAuth/API, cookies, sessions, bases de données, sauvegardes de production ou diagnostics contenant des secrets.

## Restreamer

Les processus de streaming peuvent exposer des clés de stream ou URL privées dans les lignes de commande, adresses et logs.

Supervisor applique une allow-list backend avant toute exposition au frontend. Les champs bruts tels que `command`, `address`, `last_logline`, URL de stream, credentials et JWT ne doivent jamais quitter l'adapter moteur.

## Docker

Le backend Web Supervisor ne reçoit pas le socket Docker.

Le composant `docker-observer` est isolé :
- aucun port ;
- `network_mode: none` ;
- filesystem read-only hors volume de sortie ;
- `no-new-privileges` ;
- capabilities Linux supprimées.

Le helper lit Docker uniquement pour générer un snapshot limité aux informations d'exploitation nécessaires. Aucun environnement, label, commande, log, fichier ou configuration complète de conteneur n'est conservé ou exposé.

Le Docker Adapter relit ensuite ce snapshot avec une seconde allow-list avant de le transmettre au frontend.

## Accès Supervisor

Les credentials sont fournis uniquement par variables d'environnement locales :

```text
SUPERVISOR_USERNAME=
SUPERVISOR_PASSWORD=
```

Lorsque ces deux variables sont renseignées, toutes les routes sauf `/health` exigent une authentification.

Tant que l'authentification n'est pas activée, Supervisor reste strictement read-only. Aucune commande Restreamer ou Docker n'est ajoutée à une interface non protégée.

## Diagnostics

Tout export de diagnostic devra appliquer une redaction automatique avant partage.

## Privilèges runtime

Supervisor doit fonctionner avec le minimum de privilèges possible. Aucun outil de transfert de fichiers ne doit recevoir accès au socket Docker ou à la racine `/`.

## Signalement

Ne jamais publier de secrets ou détails exploitables dans une issue publique.
