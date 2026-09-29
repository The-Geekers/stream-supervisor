# Changelog

## [Unreleased]

### Added
- Supervision séparée de Restreamer Core/API et de la Web UI.
- Latence Core/API et statut HTTP de la Web UI.
- Vue channel enrichie : vidéo, audio, bitrate, FPS, runtime, drop/dup, CPU et mémoire process.
- Détails opérationnels des destinations.
- Filtres All / Live / Issues / Stopped.
- Authentification HTTP Basic optionnelle pour Supervisor.
- Avertissement visible lorsque l'accès Supervisor reste non authentifié.
- Mode de données fictives réservé aux tests/CI.
- Workflow GitHub Actions générant une capture visuelle de l'interface.
- Smoke test CI de l'authentification Supervisor.

### Changed
- Passage à `0.1.0-alpha.4`.
- Interface encore plus dense et orientée régie/control-room.
- Modèle Restreamer enrichi tout en conservant l'allow-list anti-secrets.

### Security
- `/health` reste public et ne contient aucune donnée sensible.
- Les routes UI/API peuvent être protégées par Basic Auth sans stocker de session.
- Aucune donnée brute Restreamer n'est exposée au navigateur.
