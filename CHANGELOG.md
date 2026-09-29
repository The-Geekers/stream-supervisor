# Changelog

## [Unreleased]

### Added
- Rôles Supervisor `Admin` et `Technician`.
- Endpoint `/api/session` pour exposer uniquement le rôle/capacité courant.
- Première action opérateur : start/stop d'une destination Restreamer existante.
- Validation serveur stricte des IDs egress.
- Confirmation côté UI avant chaque action.
- Verrou anti-double commande sur une même destination.
- En-tête `X-Supervisor-Action` obligatoire pour les actions d'écriture.
- Script interactif `deployment/configure-auth.sh`.
- Probe Web UI Restreamer corrigé sur `/ui/`.
- Test unitaire réel de la commande Restreamer avec login JWT et endpoint process command.

### Fixed
- Le CPU des conteneurs Docker n'est plus affiché en pourcentage multi-cœur (`175%`). Il est affiché en équivalent de cœurs (`1.75`).

### Changed
- Passage à `0.1.0-alpha.9.2`.
- Mode ouvert : monitoring uniquement.
- Mode authentifié : `OUTPUT CONTROL` pour Admin/Technician.
- Le statut de la Web UI est désormais basé sur la vraie route statique `/ui/`.

### Operations
- Supervisor rejoint le réseau Docker externe `web-proxy` géré hors du projet.
- `deployment/update.sh` crée `web-proxy` s'il manque.
- Le port hôte 8090 est publié uniquement sur `127.0.0.1`.
- Ajout de `docs/ADMIN_VPS.md` avec les commandes d'administration validées.

### Security
- Aucun contrôle n'est possible sans authentification Supervisor.
- Les actions acceptent uniquement `start` et `stop`.
- Aucune ID de process arbitraire ne peut être commandée : l'output doit exister dans le snapshot sanitizé courant.
- Aucun restart/reload Core n'est exposé.
- Aucune clé, URL ou configuration de destination n'est modifiable.
