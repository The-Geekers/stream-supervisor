# Changelog

## 0.2.0-alpha.7 — Sécurité intégrée aux utilisateurs

- Super-admin : configuration 2FA dans Modifier l’utilisateur, pour soi et les autres comptes.
- Autres rôles : Mon compte avec changement de mot de passe et 2FA.
- Configuration sans saisie préalable du mot de passe : QR code et clé visible, activation confirmée par TOTP.
- Désactivation/récupération protégées ; révocation des sessions concernées, événements journalisés.


## 0.2.0-alpha.6 — Accès explicite au 2FA

- Bouton MON COMPTE / 2FA près de la déconnexion, sur desktop et mobile.
- Navigation et aide Utilisateurs explicitent le paramétrage personnel du 2FA.
- Parcours navigateur vérifie cet accès puis activation, récupération et désactivation.


## 0.2.0-alpha.5 — Alignement des actions utilisateurs

- Boutons Modifier/Supprimer regroupés à droite, colonnes fixes, même taille et alignement vertical indépendant du nom ou du rôle.
- Sur mobile, informations sur une ligne dédiée et actions alignées à droite dessous ; bouton du propre compte clairement désactivé.
- Aucun changement des comptes, permissions ou du 2FA.


## 0.2.0-alpha.4 — Suppression et double authentification

- Suppression explicite depuis Utilisateurs, réservée au super-admin, confirmée et journalisée. Protection de son propre compte et du dernier super-admin ; révocation immédiate des sessions.
- Vue Mon compte pour tous les comptes authentifiés : activation TOTP par QR code ou clé manuelle, confirmation, désactivation et renouvellement des codes de récupération. Mot de passe courant requis, facteur valide requis pour désactiver ou renouveler.
- Connexion avec mot de passe puis code TOTP ou code de récupération, sans session avant validation du second facteur. Codes TOTP non rejouables, fenêtre de tolérance ±30 s, limitation des échecs.
- Dix codes de récupération aléatoires à usage unique, affichés une seule fois et téléchargeables. Secrets TOTP chiffrés AES-256-GCM avec clé locale `/data/users.json.key` ; codes de récupération hachés. La clé et le fichier comptes sont dans le volume sauvegardé.
- Lecture du schéma comptes version 1 existant et écriture version 2 ; les versions précédentes refusent ce schéma plutôt que contourner le 2FA lors d’un rollback.
- Le reset de mot de passe préserve le 2FA. Purge des QR codes, clés et codes de récupération à la déconnexion.


## 0.2.0-alpha.3 — Gestion utilisateurs

- Vue Utilisateurs réservée au super-admin : création, rôle, activation/désactivation et réinitialisation du mot de passe avec confirmation.
- Migration unique des comptes `.env` vers `/data/users.json` ; Admin initial devient super-admin. Identifiants conservés, secrets hachés scrypt, fichier écrit atomiquement en mode 0600.
- Rôles super-admin, admin, technicien et lecture seule ; protection du dernier super-admin et de son propre accès. Toute modification révoque les sessions concernées.
- Gestion inspirée du Portal, comptes Supervisor indépendants. Aucun changement du chemin média ni redémarrage moteur.


## [Unreleased]

### Fixed
- Vue INCIDENTS : tolérance de corrélation de 10 s autour d'une perte ingest afin de regrouper les erreurs egress du même channel malgré les temporisations de détection différentes.
- Une erreur egress qui reste en défaut au-delà de cette marge continue d'apparaître comme incident autonome.

## [0.2.0-alpha.2] - 2026-09-30

### Changed
- Historique INCIDENTS limité visuellement à 20 incidents racine et **1H par défaut**, avec sélecteurs 1H / TODAY / 24H.
- Remplacement du « Cumulated time » par **Affected time** : union des intervalles où au moins un incident est actif, sans double comptage des incidents simultanés.
- Les erreurs egress entièrement couvertes par une perte ingest du même channel sont regroupées sous l'incident ingest dans la vue opérateur.
- Une erreur egress qui dépasse la durée de la perte ingest reste visible comme incident autonome.
- Les incidents actifs utilisent le même principe de regroupement visuel, sans modifier le tracker interne ni les règles watchdog.
- Le journal brut reste persistant mais devient replié par défaut et limité aux 20 événements récents dans l'UI.

### Added
- Bouton discret `↑ TOP` qui apparaît après scroll ; positionné dans la zone latérale sur desktop et en bas à droite sur mobile.
- Tests unitaires du temps affecté, des incidents simultanés, du regroupement ingest→egress et de la limite d'affichage.
- Tests navigateur des filtres 1H/TODAY, du nombre de lignes borné et du retour en haut.

### Scope
- Aucun effacement automatique ou bouton « clear » destructif : la lisibilité est obtenue par regroupement, période et limites d'affichage.
- Aucun changement de la détection brute des incidents, du watchdog, des commandes opérateur ou du stockage persistant.


## [0.2.0-alpha.1] - 2026-09-30

### Added
- Première brique de la phase 0.2 : section `TODAY · INCIDENT HISTORY` dans la page INCIDENTS.
- Synthèse journalière : nombre d'incidents, nombre résolu, temps cumulé et incident le plus long.
- Historique détaillé : début, fin/ACTIVE, sévérité, source, incident et durée.
- Calcul backend allow-listé à partir des événements `incident_open` / `incident_resolved` et des incidents actifs.
- Les incidents chevauchant le début de période sont tronqués pour le calcul journalier ; les incidents actifs comptent jusqu'à l'heure de la requête.
- Bornes TODAY calculées dans le navigateur afin de respecter son jour local sans dépendre du fuseau horaire du VPS.
- Tests unitaires dédiés au pairing, au clipping temporel, aux incidents actifs et à l'exclusion des événements opérateur/watchdog.

### Changed
- Fenêtre mémoire du journal portée de 500 à 5000 événements, tout en restant bornée ; le fichier JSONL persistant existant reste la source.
- Version de développement portée à `0.2.0-alpha.1`.

### Scope
- Pas de graphique, pas de nouvelle base de données, pas de métriques haute fréquence, pas d'alerte externe et pas de nouvelle automatisation dans ce lot.
- Le « temps cumulé » est la somme des durées d'incidents et ne doit pas être interprété comme une disponibilité globale si plusieurs incidents se chevauchent.


## [0.1.0-alpha.18] - 2026-09-30

### Added
- Section **ADMIN ONLY · MANUAL RECOVERY** sur SYSTEM avec bouton `RESTART RESTREAMER`, visible uniquement pour le rôle Admin.
- Confirmation destructive explicite : tous les streams actifs seront momentanément interrompus et devront être vérifiés après redémarrage.
- Endpoint `POST /api/admin/restart-restreamer` protégé par authentification Admin, en-tête d'action same-origin et verrou anti-double restart.
- Helper Docker séparé `stream-supervisor-docker-control`, sans port hôte, sur réseau interne uniquement, avec cible de restart fixée à `restreamer`.
- Vérification bornée après restart du retour de Restreamer Core et de la Web UI ; résultat allow-listé renvoyé au frontend.
- Journalisation de la demande, du résultat vérifié / à vérifier, ou de l'échec avec l'acteur Admin.

### Security
- Le frontend et le backend Web Supervisor ne montent toujours jamais le socket Docker.
- Le socket Docker en écriture est limité au helper interne dédié ; son API n'expose qu'un inspect de la cible fixe puis un restart de cette même cible.
- Technician ne peut ni voir le contrôle dans l'UI ni appeler l'endpoint serveur.
- Aucun restart Restreamer n'est ajouté au watchdog ; aucune relance automatique globale n'est introduite.

### Validation
- Tests unitaires du helper : cible fixe running, refus cible arrêtée et refus sans en-tête interne.
- CI vérifie le rôle Admin, l'en-tête d'action et le refus Technician.
- Playwright couvre cancel/confirm, message destructif, endpoint POST et retour de vérification.


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
