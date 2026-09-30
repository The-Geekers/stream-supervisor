# Stream Supervisor

Stream Supervisor est une console indépendante de supervision et d'exploitation pour moteurs de streaming auto-hébergés.

Le premier moteur ciblé est **Restreamer**. L'architecture reste volontairement générique afin de pouvoir ajouter ensuite MediaMTX, Muxshed ou d'autres moteurs.

## Principes fondamentaux

- Le trafic média ne passe jamais par Supervisor.
- Une panne de Supervisor ne doit jamais interrompre un stream actif.
- Une panne de l'interface Web d'un moteur ne doit jamais déclencher seule un redémarrage global.
- Observer d'abord, diagnostiquer ensuite, agir en dernier.
- Aucun secret, clé de stream, token ou mot de passe ne doit être versionné.
- Les payloads moteurs sont transformés par allow-list avant exposition au frontend.

## État actuel

`0.2.0-alpha.1`

`v0.1.0-alpha.18` reste le point de référence figé de la stabilisation 0.1. La branche 0.2 démarre avec un premier bloc volontairement limité à l'historique des incidents.

- navigation compacte mobile vers les cinq vues, dont **SYSTEM**, avec sidebar conservée sur tablette/desktop ;
- modales accessibles au clavier : focus initial, Tab/Shift+Tab confinés, Escape et retour au déclencheur ;
- purge des données opérationnelles après logout/expiration, fond inerte et masqué aux technologies d'assistance ; les réponses tardives ne repeuplent pas une session fermée ;
- thème **Dark** d'alpha.15 conservé comme référence visuelle, sans modification de géométrie ;
- thème **Light** aligné sur l'identité du portail Distillerie v1.0.3 : noir `#191919`, fond doux `#f5f3ef`, blanc, lignes `#dedbd5` et accent orange `#e9471d` ;
- **Light est le thème par défaut lors de la première visite** ; dès que l'utilisateur choisit Dark ou Light, cette préférence est stockée uniquement dans le `localStorage` du navigateur ;
- alpha.17 réduit légèrement le nom des channels de 14 à 13 px et introduit un vert `LIVE` dédié, plus soutenu, sans modifier les autres états positifs ;
- familles de polices et métriques conservées : le portail utilise déjà Arial/Helvetica et une police monospace compatible, ce qui évite de modifier les proportions validées ;
- le socle alpha.15 a été déployé sur le VPS réel le 30/09/2026 et son rendu desktop/mobile de base a été vérifié en production ;

- adapter Restreamer Core 16 avec monitoring et contrôle limité des destinations ;
- channels, destinations et métriques de streaming en pseudo temps réel SSE ;
- monitoring VPS : CPU, RAM, disque, réseau, load et uptime ;
- page **SYSTEM** avec Docker Adapter read-only ;
- Supervisor rejoint automatiquement le réseau Docker externe `web-proxy` ;
- le port hôte `8090` est limité à `127.0.0.1` et n'est plus publié sur toutes les interfaces ;
- CPU Docker affiché en équivalent de cœurs (`1.00` = un cœur pleinement utilisé), jamais en pourcentage multi-cœur ambigu ;
- rôles Supervisor **Admin** et **Technician** ;
- écran de connexion intégré à l'UI, sans popup Basic Auth du navigateur ;
- sessions serveur avec cookie HttpOnly + SameSite=Strict et bouton **LOG OUT** ;
- interface ouverte = monitoring uniquement si aucune authentification n'est configurée ;
- une fois authentifié, Admin et Technician peuvent démarrer/arrêter une destination Restreamer existante ;
- **Admin uniquement** dispose sur SYSTEM d'un `RESTART RESTREAMER` manuel de dernier recours ; la confirmation avertit explicitement que tous les streams actifs seront interrompus ;
- ce restart passe par un helper Docker séparé, non exposé au navigateur ni à l'hôte, connecté uniquement à un réseau Docker interne et codé pour la cible fixe `restreamer` ;
- après restart, Supervisor vérifie pendant une fenêtre bornée le retour de Restreamer Core et de la Web UI, journalise le résultat et demande une vérification manuelle des ingests/destinations ;
- le bouton START/STOP suit désormais la consigne Restreamer `state.order`, indépendamment de l'état observé ;
- une destination en `ERROR` mais toujours configurée `START` reste donc arrêtable depuis Supervisor et peut afficher son délai de reconnexion ;
- aucune modification de clé, URL, configuration de process ou channel n'est exposée ;
- confirmation avant action opérateur ;
- anti-CSRF par en-tête d'action same-origin ;
- validation serveur stricte : seules les IDs egress déjà découvertes et les commandes `start` / `stop` sont acceptées ;
- page **INCIDENTS** avec état actif et journal d'événements persistant ;
- 0.2 alpha.1 ajoute un historique **TODAY** dérivé de ce journal : nombre d'incidents, incidents résolus, temps cumulé, incident le plus long et durée de chaque occurrence ;
- la période TODAY suit le fuseau horaire du navigateur : le frontend envoie simplement les bornes ISO de minuit local à maintenant, le backend reste indépendant du fuseau du VPS ;
- le temps cumulé signifie la **somme des durées d'incidents**, pas une mesure de disponibilité globale lorsque plusieurs incidents se chevauchent ;
- détection d'incidents Core, Web UI, Docker, ingest et egress avec temporisation anti-bruit ;
- journal des ouvertures/résolutions d'incidents et des actions opérateur start/stop ;
- persistance dédiée dans un volume Docker Supervisor, sans payload Restreamer brut ;
- page **DIAGNOSTICS** avec checks opérateur dérivés de données déjà sanitizées ;
- recommandations de première action sans récupération automatique ;
- export JSON de diagnostic strictement allow-listé, sans payload moteur brut ;
- page **WATCHDOG** avec politique de récupération graduée et état des candidats ;
- mode watchdog par défaut `observe` : détection et journalisation uniquement, aucune commande automatique ;
- recovery egress optionnelle et explicitement armée : uniquement une commande `start` ciblée sur une destination déjà en erreur, avec ingest LIVE et incident actif ;
- temporisation, vérification post-action, cooldown et limite de tentatives ;
- aucun restart automatique Restreamer Core/conteneur et aucun config reload ;
- tests anti-fuite de secrets, smoke tests Docker/auth/incidents/diagnostics/watchdog et captures visuelles CI.

## Historique d'exploitation 0.2

Le premier bloc 0.2 reste volontairement limité. Supervisor réutilise le journal d'incidents déjà persistant au lieu d'ajouter immédiatement une nouvelle base ou une stack de métriques.

Dans **INCIDENTS**, la section `TODAY · INCIDENT HISTORY` affiche :
- le nombre d'incidents ayant affecté la journée ;
- le nombre résolu ;
- la somme des durées d'incidents sur la période ;
- la durée de l'incident le plus long ;
- l'historique détaillé avec début, fin, sévérité, source et durée.

Les durées actives continuent à évoluer jusqu'au moment de la requête. Les intervalles qui chevauchent minuit sont tronqués à la période affichée pour le calcul du total journalier.

## Thèmes UI

Le thème **Light** est utilisé par défaut lorsqu'aucune préférence n'existe encore dans le navigateur. Le thème **Dark** reste disponible et conserve la direction visuelle validée jusqu'à alpha.15.

Le thème **Light** reprend la palette du portail Distillerie sans reprendre sa mise en page : mêmes dimensions, mêmes grilles, mêmes tailles de texte et mêmes règles responsive que Supervisor. Les couleurs d'état opérationnel conservent leur sémantique ; des variantes de texte plus sombres sont utilisées lorsque nécessaire pour garder un contraste lisible sur fond clair.

La préférence est locale au navigateur sous la clé `stream-supervisor-theme`. Une première visite sans cette clé démarre en Light ; un choix explicite Dark ou Light est ensuite conservé. Cette donnée n'est pas envoyée au serveur et n'affecte ni les sessions, ni les rôles, ni les commandes Restreamer.

## Authentification

### Vérification UI locale

```bash
npm ci
npx playwright install chromium
npm run check
npm run visual
```

Les tests navigateur démarrent leur propre serveur de démonstration sur `127.0.0.1:18090`, sans lire ni modifier de `.env` et sans joindre un moteur de production. Ils couvrent les cinq vues à 320, 390, 759, 760, 761, 1024 et 1600 px, les rôles Admin/Technician, les modales, logout/expiration/reconnexion, les commandes simulées et l'export diagnostic. Alpha.16 ajoute les contrôles Light ; alpha.17 vérifie le Light par défaut, le titre channel à 13 px et le vert LIVE dédié ; alpha.18 ajoute les tests de visibilité Admin/Technician et du workflow de confirmation du restart Restreamer. Les captures et traces sont publiées par le workflow `visual`.

L'export conserve `GET /api/diagnostics?download=1`. Le test attend l'événement de téléchargement **avant** le clic, vérifie sa terminaison et teste séparément le statut HTTP, `Content-Disposition` et les indicateurs de sanitisation. Un timeout d'automation isolé ne démontre pas une lenteur backend ; aucune modification de l'architecture d'export n'est incluse.

`SUPERVISOR_USERNAME` / `SUPERVISOR_PASSWORD` définissent le compte Admin.

Quand un compte est configuré, Supervisor affiche son propre écran de connexion. Le navigateur n'utilise plus de challenge HTTP Basic. Après connexion, Supervisor crée une session serveur et ne place dans le navigateur qu'un cookie de session HttpOnly / SameSite=Strict. Le bouton **LOG OUT** invalide immédiatement cette session côté serveur.

Un compte Technician optionnel peut être configuré avec :

```text
SUPERVISOR_TECH_USERNAME=
SUPERVISOR_TECH_PASSWORD=
```

Un assistant interactif est fourni :

```bash
sh deployment/configure-auth.sh
```

Il demande les mots de passe sans les afficher et met à jour uniquement le `.env` local du VPS.

La durée de session est configurable avec `SUPERVISOR_SESSION_TTL_MS` (8 h par défaut). Sur le déploiement HTTPS derrière Nginx Proxy Manager, le cookie reçoit l'attribut `Secure` lorsque le proxy annonce `X-Forwarded-Proto: https`.

## Restreamer Web UI

La Web UI Restreamer n'est pas un service indépendant : datarhei Core sert les fichiers UI statiques sur `/ui/` dans le même serveur HTTP que l'API.

Conséquence : il n'existe pas de « restart UI » serveur isolé qui garantisse de ne pas toucher Core.

Supervisor adopte donc la stratégie suivante :
- probe séparé de `/ui/` ;
- si l'UI est dégradée mais l'API Core reste disponible, aucune relance Core n'est faite ;
- l'exploitation peut continuer via Supervisor et l'API ;
- le reload de configuration Core n'est pas utilisé comme récupération UI, car il redémarre Core ;
- un restart complet du conteneur est disponible uniquement comme action **manuelle Admin** de dernier recours ; il n'est jamais déclenché par le watchdog.

## Workflow

`main` est la source de vérité.

Le VPS est un runtime. Une fois initialisé, la mise à jour se fait avec :

```bash
sh deployment/update.sh
```

Les secrets restent dans `.env` sur le VPS et ne sont jamais versionnés.

Voir `STATUS.md`, `ROADMAP.md`, `SECURITY.md`, `docs/ADMIN_VPS.md` et `docs/`.

## Watchdog gradué

Le watchdog est volontairement conservateur.

Par défaut :

```text
WATCHDOG_MODE=observe
WATCHDOG_OUTPUT_RECOVERY=false
```

Dans ce mode, il identifie uniquement les destinations qui pourraient être récupérées et les journalise. Il ne commande rien.

Une destination ne peut devenir éligible à une recovery automatique que si :
- son ingest est `LIVE` ;
- la destination est réellement en `ERROR` alors qu'elle était configurée pour démarrer ;
- l'incident correspondant est déjà actif ;
- l'erreur persiste au-delà du seuil configuré ;
- aucune autre action sur cette destination n'est en cours ;
- le cooldown et la limite de tentatives l'autorisent.

Même en mode recovery, alpha.12 ne redémarre jamais automatiquement Restreamer Core ou son conteneur.
