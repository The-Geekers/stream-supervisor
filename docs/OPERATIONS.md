# Operations

Ce document deviendra le runbook destiné aux techniciens.

## Ordre de diagnostic

1. VPS / système.
2. Docker.
3. Core/API du moteur.
4. Interface Web.
5. Input / channel.
6. Sortie individuelle.
7. Processus média.

Une panne d'un niveau n'implique pas automatiquement que les niveaux inférieurs sont eux aussi en panne.

## Récupération

Toujours privilégier l'action minimale. Le redémarrage complet d'un moteur ou conteneur reste un dernier recours.
