# Changelog

## [Unreleased]

### Added
- Page `SYSTEM` dans la navigation.
- Docker Adapter read-only.
- Docker Observer isolé sans réseau.
- Monitoring de conteneurs explicitement listés.
- États Docker, health, image, uptime, CPU et RAM.
- Snapshot Docker sanitizé partagé via volume.
- Détection de snapshot Docker stale.
- Test automatique garantissant que les champs Docker non autorisés et faux secrets ne quittent pas l'adapter.
- Capture CI distincte des vues Channels et System.

### Changed
- Passage à `0.1.0-alpha.8`.
- Le Web UI Restreamer affiche `REACHABLE` lorsqu'un listener répond mais que la route testée n'est pas une page valide.
- Les données système et Docker sont maintenant regroupées dans une vue système dédiée, tout en conservant le résumé VPS dans la vue principale.

### Security
- Le conteneur Supervisor ne monte jamais `/var/run/docker.sock`.
- Le helper Docker Observer n'expose aucun port et utilise `network_mode: none`.
- Les environnements, commandes, labels, logs, archives, fichiers et inspections brutes des conteneurs ne sont jamais écrits dans le snapshot partagé.
- Les données Docker passent par deux allow-lists : observer puis Docker Adapter.
