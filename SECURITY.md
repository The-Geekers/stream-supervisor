# Security Policy

## Dépôt public

Ce dépôt est public. Tout fichier commité doit être considéré comme publiquement accessible.

Ne jamais commiter de `.env` réel, mots de passe, stream keys, tokens OAuth/API, cookies, sessions, bases de données, sauvegardes de production ou diagnostics contenant des secrets.

## Diagnostics

Les processus de streaming peuvent exposer des clés de stream ou URL privées dans les lignes de commande et logs. Tout export de diagnostic devra appliquer une redaction automatique avant partage.

## Privilèges runtime

Supervisor doit fonctionner avec le minimum de privilèges possible. Le contrôle Docker est une opération sensible et doit rester côté backend. Aucun outil de transfert de fichiers ne doit recevoir accès au socket Docker ou à la racine `/`.

## Signalement

Ne jamais publier de secrets ou détails exploitables dans une issue publique.
