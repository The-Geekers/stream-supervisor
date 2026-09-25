# Watchdog

## Objectif

Détecter les pannes réelles et récupérer prudemment sans transformer un problème d'administration en coupure de diffusion.

## Règles

- Une erreur Web UI seule ne déclenche jamais de restart moteur.
- API/Core, processus et outputs sont évalués séparément.
- Les actions de récupération sont graduées et journalisées.
- Les flux actifs non concernés doivent rester protégés.
- Le restart complet reste le dernier niveau.

Les checks et seuils précis seront définis après l'audit Restreamer.
