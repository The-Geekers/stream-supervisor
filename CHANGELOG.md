# Changelog

## [Unreleased]

### Added
- Monitoring VPS read-only : CPU global, RAM, load 1/5/15, uptime, disque racine et trafic réseau IN/OUT.
- System Adapter basé sur des mounts `/proc` précis en lecture seule.
- Probe disque via un répertoire vide sur le filesystem du VPS, sans mount complet de `/`.
- Tri directement sur tous les en-têtes opérationnels du tableau.
- Tri ascendant / descendant.
- Ordre déterministe avec nom/ID comme second critère.
- Tests unitaires des parsers système.
- Validation de la configuration Docker Compose dans la CI.

### Changed
- Passage à `0.1.0-alpha.7`.
- Suppression du bloc séparé `SORT NAME / STATUS`.
- Les contrôles de tri font désormais partie du tableau lui-même.
- La scrollbar verticale est réservée en permanence pour empêcher le décalage horizontal de l'interface.
- Le conteneur Supervisor fonctionne avec `no-new-privileges` et sans capabilities Linux.

### Security
- Aucun mount complet du filesystem VPS.
- Aucun socket Docker pour le monitoring système.
- Seuls des fichiers `/proc` non secrets et explicitement nécessaires sont exposés au conteneur en lecture seule.
- Les règles anti-fuite Restreamer restent inchangées.
