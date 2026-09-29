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

### Added
- Tri des channels par nom ou par état, avec tri par nom par défaut.
- Débit entrant total et débit sortant total Restreamer.
- CPU et RAM cumulés des processus ingest/egress supervisés.
- Indication IN/OUT explicite dans l'interface.

### Changed
- Passage à `0.1.0-alpha.6`.
- Interface encore plus dense et orientée régie/control-room.
- Modèle Restreamer enrichi tout en conservant l'allow-list anti-secrets.

### Fixed
- Correction de la lecture du nom de channel Restreamer : ingest = `metadata.meta.name`, destination = `metadata.name`.
- Tri déterministe par nom + ID afin d'empêcher les lignes de changer de place lorsque plusieurs noms sont identiques.
- Libellés de filtres clarifiés : `INGEST LIVE` et `INGEST STOPPED`.

### Added
- Flux temps réel SSE `/api/events`.
- Polling Core partagé côté backend, 1000 ms par défaut, au lieu d'un polling indépendant par navigateur.
- Cache 5 s pour les probes de service Core/About et Web UI.
- Affichage du transport, de l'intervalle source et de la durée du poll dans le footer.

### Security
- `/health` reste public et ne contient aucune donnée sensible.
- Les routes UI/API peuvent être protégées par Basic Auth sans stocker de session.
- Aucune donnée brute Restreamer n'est exposée au navigateur.
