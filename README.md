# Stream Supervisor

Stream Supervisor est une console indépendante de supervision et d'exploitation pour moteurs de streaming auto-hébergés.

Le premier moteur ciblé est **Restreamer**. L'architecture reste volontairement générique afin de pouvoir ajouter ensuite MediaMTX, Muxshed ou d'autres moteurs.

## Principes fondamentaux

- Le trafic média ne passe jamais par Supervisor.
- Une panne de Supervisor ne doit jamais interrompre un stream actif.
- Une panne de l'interface Web d'un moteur ne doit jamais déclencher seule un redémarrage global.
- Observer d'abord, diagnostiquer ensuite, agir en dernier.
- Aucun secret, clé de stream, token ou mot de passe ne doit être versionné.
- Les diagnostics exportables devront masquer automatiquement les données sensibles.

## Périmètre initial — v0.1

- Authentification locale.
- Rôles Admin et Technicien.
- État du VPS : CPU, RAM, disque, réseau, uptime.
- État Docker.
- État Restreamer séparé entre Core/API, interface Web et processus média.
- Découverte des channels, entrées et sorties.
- Start/stop d'une sortie existante sans redémarrage global.
- Capture de diagnostic nettoyée des secrets.
- Base d'un watchdog prudent.

Voir `STATUS.md`, `ROADMAP.md`, `docs/REQUIREMENTS.md` et `docs/ARCHITECTURE.md`.

## État du projet

Phase de documentation et d'audit technique. Aucun code applicatif de production n'est encore commencé.

## Organisation

Projet public maintenu sous **The-Geekers**.
