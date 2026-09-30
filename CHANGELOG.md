# Changelog

## [Unreleased]

## [0.1.0-alpha.17] - 2026-09-30

### Changed
- Le thème **Light** devient le thème par défaut lorsqu'aucune préférence n'est encore enregistrée dans le navigateur.
- Un choix explicite Dark ou Light continue d'être persisté localement sous `stream-supervisor-theme`.
- Taille du nom des channels réduite de 14 à 13 px, sans changement de police, graisse, grille ou responsive.
- Ajout d'un token `--live` dédié : vert plus soutenu pour les signaux et libellés LIVE, sans modifier le vert générique utilisé par les autres états positifs.

### Validation
- Le jeu responsive Dark sur sept largeurs reste couvert en forçant explicitement la préférence Dark dans les tests.
- Le Light est testé comme comportement de première visite à 390 et 1600 px sur les cinq vues.
- Persistance Dark/Light, taille 13 px et token LIVE dédiés couverts par Playwright.
- Aucune modification des adaptateurs, de l'API, de l'authentification, du watchdog ou des commandes Restreamer.


## [0.1.0-alpha.16] - 2026-09-30

### Added
- Système de thèmes Dark/Light avec sélection disponible sur l'écran de connexion, la sidebar desktop et la navigation mobile.
- Thème Light dérivé de la palette Distillerie Portal v1.0.3 : noir `#191919`, blanc, fond doux `#f5f3ef`, ligne `#dedbd5`, orange `#e9471d`, vert `#44745b` et rouge `#aa2730`.
- Persistance locale de la préférence visuelle via `localStorage`, sans donnée opérationnelle ni impact sur les sessions.
- Tests navigateur Light à 390 et 1600 px sur les cinq vues, plus test de persistance et retour au Dark.

### Changed
- Le Dark d'alpha.15 reste le thème par défaut et sa palette existante est conservée.
- Aucune modification des dimensions, grilles, tailles de police ou règles responsive. Les familles Arial/Helvetica et monospace existantes sont conservées car elles correspondent déjà à celles du portail.
- Alpha.15 est documentée comme déployée et vérifiée sur l'instance réelle le 30/09/2026.

### Validation
- Les tests responsive alpha.15 sur sept largeurs restent en place.
- La logique ERROR / STOP / RETRY, les adaptateurs, l'API, l'authentification, le watchdog et les commandes opérateur ne sont pas modifiés par alpha.16.


## [0.1.0-alpha.15] - 2026-09-30

### Added
- Navigation mobile compacte vers CHANNELS, SYSTEM, INCIDENTS, DIAGNOSTICS et WATCHDOG ; état sélectionné explicite et commandes tactiles, sans SETTINGS désactivé.
- Tests navigateur sur sept largeurs (320 à 1600 px, dont 759/760/761), captures des cinq vues et contrôles de sessions et de modales pour Admin/Technician.

### Fixed
- Fond des modales rendu inerte et masqué aux technologies d'assistance, focus initial et boucle Tab/Shift+Tab, restauration du déclencheur malgré les mises à jour SSE.
- Données opérationnelles purgées après logout ou expiration ; arrêt des requêtes de monitoring et rejet des réponses de l'ancienne session, sans bloquer la reconnexion.
- Tableaux de monitoring lisibles en cartes étiquetées sur les petits écrans, boutons accessibles et absence de débordement horizontal ; sidebar tablette/desktop et SYSTEM conservés.

### Validation
- Sémantique desiredState, STOP en ERROR et RETRY d'alpha.14 inchangée et testée.
- Export diagnostic réussi localement avec attente de téléchargement avant clic et contrôle HTTP/sanitisation séparé. Le timeout d'automation antérieur n'est pas confirmé comme panne backend ; architecture d'export inchangée.
- Adaptateurs, politiques watchdog, Docker observer, System Adapter, réseau et déploiement inchangés.

## [0.1.0-alpha.14]

### Added
- Écran de connexion Supervisor intégré à l'interface, sans popup Basic Auth navigateur.
- Sessions serveur avec cookie HttpOnly / SameSite=Strict et bouton de déconnexion.
- Modales UI pour confirmer les actions START/STOP et afficher les erreurs.
- Limitation simple des tentatives de connexion échouées.
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
- Les commandes START/STOP d'une destination utilisent désormais la consigne Restreamer `state.order` au lieu de déduire l'action depuis le seul statut observé ; une destination `ERROR` encore configurée `START` reste donc arrêtable.
- Le délai de reconnexion d'un egress est conservé dans le modèle sanitizé et affiché pendant `ERROR` / `CONNECTING` lorsqu'il est fourni par Restreamer.
- Le détail INCIDENTS n'ajoute plus une seconde fois le couple channel/destination quand le journal le contient déjà.
- Le texte WATCHDOG ne référence plus une ancienne version alpha pour la politique de sécurité.
- Le mode WATCHDOG `observe` affiche désormais clairement qu'aucune action automatique n'est envoyée.
- Pendant une recovery watchdog, l'incident egress reste ouvert pendant la fenêtre de vérification afin d'éviter un faux `INCIDENT RESOLVED` suivi d'un nouvel `INCIDENT OPEN` sur un état transitoire.
- Le CPU des conteneurs Docker n'est plus affiché en pourcentage multi-cœur (`175%`). Il est affiché en équivalent de cœurs (`1.75`).

### Changed
- Passage à `0.1.0-alpha.14`.
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
