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

`0.1.0-alpha.15`

- navigation compacte mobile vers les cinq vues, dont **SYSTEM**, avec sidebar conservée sur tablette/desktop ;
- modales accessibles au clavier : focus initial, Tab/Shift+Tab confinés, Escape et retour au déclencheur ;
- purge des données opérationnelles après logout/expiration, fond inerte et masqué aux technologies d'assistance ; les réponses tardives ne repeuplent pas une session fermée ;

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
- le bouton START/STOP suit désormais la consigne Restreamer `state.order`, indépendamment de l'état observé ;
- une destination en `ERROR` mais toujours configurée `START` reste donc arrêtable depuis Supervisor et peut afficher son délai de reconnexion ;
- aucune modification de clé, URL, configuration de process ou channel n'est exposée ;
- confirmation avant action opérateur ;
- anti-CSRF par en-tête d'action same-origin ;
- validation serveur stricte : seules les IDs egress déjà découvertes et les commandes `start` / `stop` sont acceptées ;
- page **INCIDENTS** avec état actif et journal d'événements persistant ;
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

## Authentification

### Vérification UI locale

```bash
npm ci
npx playwright install chromium
npm run check
npm run visual
```

Les tests navigateur démarrent leur propre serveur de démonstration sur `127.0.0.1:18090`, sans lire ni modifier de `.env` et sans joindre un moteur de production. Ils couvrent les cinq vues à 320, 390, 759, 760, 761, 1024 et 1600 px, les rôles Admin/Technician, les modales, logout/expiration/reconnexion, les commandes simulées et l'export diagnostic. Les captures et traces sont publiées par le workflow `visual`.

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
- un éventuel restart complet du conteneur restera un dernier recours futur du watchdog.

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
