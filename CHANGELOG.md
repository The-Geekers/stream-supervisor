# Changelog

## [Unreleased]

### Added
- Page **WATCHDOG** avec état runtime, politique et candidats de recovery.
- Moteur de watchdog gradué avec mode `off` / `observe` / `recover`.
- Recovery automatique optionnelle limitée à un `start` ciblé d'un egress en erreur, avec ingest LIVE et incident actif.
- Vérification post-action, cooldown, fenêtre de tentative et limite de tentatives.
- Journalisation des candidats, tentatives et résultats de recovery.
- Endpoint `GET /api/watchdog`.
- Page **DIAGNOSTICS** avec checks opérateur Core, Web UI, Docker, host, journal et incidents.
- Endpoint `GET /api/diagnostics` et export JSON allow-listé via `?download=1`.
- Recommandations opérateur intégrées, sans action corrective automatique.
- Page **INCIDENTS** avec incidents actifs et journal d'événements.
- Détection des incidents Restreamer Core/Web UI, Docker, ingest et egress.
- Temporisation des états transitoires pour limiter le bruit d'incidents.
- Journal persistant des ouvertures/résolutions et des actions opérateur.
- Endpoint `GET /api/incidents` avec allow-list stricte.
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
- Pendant une recovery watchdog, l'incident egress reste ouvert pendant la fenêtre de vérification afin d'éviter un faux `INCIDENT RESOLVED` suivi d'un nouvel `INCIDENT OPEN` sur un état transitoire.
- Le CPU des conteneurs Docker n'est plus affiché en pourcentage multi-cœur (`175%`). Il est affiché en équivalent de cœurs (`1.75`).

### Changed
- Passage à `0.1.0-alpha.12.1`.
- Mode ouvert : monitoring uniquement.
- Mode authentifié : `OUTPUT CONTROL` pour Admin/Technician.
- Le statut de la Web UI est désormais basé sur la vraie route statique `/ui/`.

### Operations
- Supervisor rejoint le réseau Docker externe `web-proxy` géré hors du projet.
- `deployment/update.sh` crée `web-proxy` s'il manque.
- Le port hôte 8090 est publié uniquement sur `127.0.0.1`.
- Ajout de `docs/ADMIN_VPS.md` avec les commandes d'administration validées.

### Security
- Watchdog en `observe` par défaut ; aucune écriture automatique sans activation explicite.
- Aucun restart automatique Restreamer Core/conteneur et aucun config reload dans alpha.12.
- Le watchdog partage le verrou d'action egress avec les commandes opérateur pour éviter les actions concurrentes.
- Les diagnostics sont reconstruits depuis les modèles déjà sanitizés et passent par une allow-list dédiée.
- L'export diagnostics exclut explicitement payloads moteur bruts, adresses de stream, clés, credentials, JWT, commandes FFmpeg, environnement et logs bruts.
- Le journal incidents/actions n'accepte qu'un schéma allow-listé ; aucun payload Restreamer brut n'est persisté.
- Les clés de stream, URLs, JWT et commandes FFmpeg restent exclus du stockage incidents.
- Aucun contrôle n'est possible sans authentification Supervisor.
- Les actions acceptent uniquement `start` et `stop`.
- Aucune ID de process arbitraire ne peut être commandée : l'output doit exister dans le snapshot sanitizé courant.
- Aucun restart/reload Core n'est exposé.
- Aucune clé, URL ou configuration de destination n'est modifiable.
