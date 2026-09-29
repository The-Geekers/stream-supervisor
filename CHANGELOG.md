# Changelog

## [Unreleased]

### Added
- Workflow GitHub → VPS avec `deployment/update.sh`.
- CI GitHub : tests unitaires, contrôle anti-secret, build Docker et smoke test.
- Adapter Restreamer read-only.
- Découverte des noms de channels via metadata Restreamer UI.
- Association ingest/egress par `reference`.
- Modèle de statut LIVE / CONNECTING / NO SOURCE / ERROR / STOPPED.
- Tests automatiques empêchant la remontée de commandes, URLs, credentials et stream keys.
- Nouvelle interface dense orientée régie / supervision.

### Changed
- Passage à `0.1.0-alpha.3`.
- GitHub devient la source de vérité ; le VPS devient runtime-only.
