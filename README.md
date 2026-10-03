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

`0.2.0-alpha.2`

`v0.1.0-alpha.18` reste le point de référence figé de la stabilisation 0.1. `0.2.0-alpha.2` est fusionnée sur `main` via la PR #25 après validation `quality` et `visual` ; elle travaille la lisibilité d'exploitation des incidents sans ajouter de stack de métriques.

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
- 0.2 alpha.2 affiche une vue opérateur bornée : **1H par défaut**, avec sélecteurs 1H / TODAY / 24H et maximum 20 lignes d'historique visibles ;
- le temps affiché devient **Affected time** : durée murale pendant laquelle au moins un incident est présent, sans additionner plusieurs incidents simultanés ;
- les erreurs egress du même channel sont regroupées sous la perte ingest lorsqu'elles tombent dans sa fenêtre temporelle avec une tolérance de 10 s autour de l'incident ;
- une erreur egress qui persiste après le retour de l'ingest reste visible comme incident autonome ;
- le journal brut est conservé mais replié par défaut et limité aux 20 événements récents dans l'UI ;
- un bouton discret **↑ TOP** apparaît après scroll pour revenir rapidement en haut de page ;
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

Supervisor réutilise le journal persistant existant. Il n'ajoute toujours ni base de métriques haute fréquence, ni Grafana interne, ni alerte externe.

La page **INCIDENTS** propose désormais une vue opérateur :
- **1H** par défaut, plus **TODAY** et **24H** ;
- au maximum 20 incidents racine affichés ;
- nombre d'incidents racine et nombre résolu ;
- **Affected time** : union temporelle des incidents, donc une minute avec huit incidents simultanés compte une minute, pas huit ;
- incident racine le plus long ;
- nombre d'erreurs egress regroupées sous une perte ingest du même channel.

Le regroupement est volontairement conservateur : une erreur egress du même channel est rattachée à la perte ingest si elle tombe dans une fenêtre élargie de 10 s autour de l'incident ingest. Cette marge absorbe les temporisations de détection différentes observées en production. Si l'egress dépasse cette marge après le retour de l'ingest, il reste un incident autonome.

Le journal brut reste disponible dans un panneau repliable limité aux 20 événements les plus récents. Rien n'est supprimé par cette vue : il s'agit d'améliorer la lecture opérateur sans perdre la trace persistante.

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

Les tests navigateur démarrent leur propre serveur de démonstration sur `127.0.0.1:18090`, sans lire ni modifier de `.env` et sans joindre un moteur de production. Ils couvrent les cinq vues à 320, 390, 759, 760, 761, 1024 et 1600 px, les rôles Admin/Technician, les modales, logout/expiration/reconnexion, les commandes simulées et l'export diagnostic. Alpha.16 ajoute les contrôles Light ; alpha.17 vérifie le Light par défaut, le titre channel à 13 px et le vert LIVE dédié ; alpha.18 ajoute les tests de visibilité Admin/Technician et du workflow de confirmation du restart Restreamer ; 0.2 alpha.2 couvre les périodes d'historique bornées et le retour en haut de page. Les captures et traces sont publiées par le workflow `visual`.

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


### Gestion des utilisateurs (0.2.0-alpha.3)

Connectez-vous avec l’Admin existant puis ouvrez **Utilisateurs**. Le compte initial devient super-admin à la première migration, avec le même identifiant et mot de passe. Le compte Technician existant est également importé.

Le super-admin crée et modifie les comptes, choisit leur rôle et état, et réinitialise le mot de passe (12 à 256 caractères, confirmation requise). Les rôles Admin/Technicien conservent les actions opérateur ; le rôle lecture seule consulte seulement. Le restart exceptionnel reste réservé à Admin/Super-admin.

Les comptes sont enregistrés dans `/data/users.json` (`USERS_FILE`) sur le volume `supervisor_data`, déjà sauvegardé par l’export infrastructure. Après migration, ce fichier fait autorité : modifier les anciennes variables `.env` ne réinitialise plus les comptes. Une modification invalide les sessions du compte. Le dernier super-admin actif et votre propre rôle/activation sont protégés.

La première migration nécessite un compte Admin complet dans le `.env`. Un fichier utilisateurs invalide fait échouer le démarrage plutôt que réactiver des identifiants obsolètes. Pour un rollback, sauvegarder le volume avant mise à jour ; une version ancienne utilise à nouveau les identifiants du `.env`. Les comptes du Portal et ceux de Supervisor restent indépendants. Cette livraison reprend la gestion des comptes, sans SSO, 2FA ni mode « Voir comme ».


### Suppression et 2FA (0.2.0-alpha.4)

**Utilisateurs → Supprimer** retire définitivement un compte après confirmation et invalide ses sessions. Le super-admin ne peut pas supprimer son propre compte ni le dernier super-admin actif. Les événements historiques restent dans le journal.

**Mon compte → Activer le 2FA** demande le mot de passe courant, affiche un QR code généré localement et une clé manuelle. Enregistrer ce compte dans une application TOTP, puis confirmer avec son code à six chiffres. L’activation n’est effective qu’après confirmation. Les autres sessions de ce compte sont révoquées. Dix codes de récupération sont affichés une seule fois : les télécharger et les conserver hors du VPS.

À la connexion, entrer le mot de passe puis le code TOTP, ou un code de récupération à usage unique. Aucun cookie de session n’est délivré avant validation du second facteur. Un code TOTP accepté ne peut plus être rejoué, même après redémarrage. Attendre le prochain code (30 secondes) si le code actuel vient de servir ; une tolérance de ±30 secondes est appliquée. Le VPS et le téléphone doivent avoir une heure correcte.

La désactivation du 2FA et le renouvellement des codes exigent le mot de passe et un code TOTP/recovery valide. La désactivation révoque toutes les sessions. Le renouvellement révoque les autres sessions et invalide les anciens codes. Le changement/reset du mot de passe ne supprime pas le second facteur. Aucun reset 2FA administrateur contournant le facteur n’est ajouté.

Les secrets TOTP sont chiffrés AES-256-GCM dans `users.json` avec une clé générée automatiquement en mode 0600 dans `users.json.key`, dans le même volume `supervisor_data`. **Sauvegarder/restaurer ces deux fichiers ensemble** ; l’export du volume existant les inclut. Le chiffrement protège une fuite du seul fichier comptes, pas une compromission complète du VPS ayant aussi accès à la clé. Au démarrage, un compte avec 2FA dont la clé est absente ou invalide fait échouer le service plutôt que contourner le facteur.

Si le téléphone est perdu, se connecter avec le mot de passe et un code de récupération, puis reconfigurer le 2FA. Si tous les codes sont perdus, prévoir une intervention de récupération sur une sauvegarde contrôlée ; conserver les codes hors du serveur évite ce blocage. Les QR codes, clés et codes affichés sont purgés de l’interface à la déconnexion ; aucun stockage navigateur persistant.

Rollback : éviter de revenir à une version avant alpha.4 après activation du 2FA ; cette ancienne version ne vérifie pas le second facteur. Les comptes du Portal restent indépendants.
