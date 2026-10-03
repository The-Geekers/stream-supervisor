# Project Status

**Version :** 0.2.0-alpha.3
**Phase :** 0.2 Monitoring & exploitation — incidents lisibles / vue opérateur

| Domaine | État |
|---|---|
| Gestion utilisateurs | Candidate alpha.3 : interface super-admin, stockage persistant haché ; validation VPS restante |
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 17, cinq vues responsive + thèmes Dark/Light |
| Thème Dark | Référence alpha.15 conservée et sélectionnable |
| Thème Light | Palette Distillerie Portal v1.0.3, thème par défaut à la première visite |
| Préférence thème | Locale au navigateur uniquement (`localStorage`), choix explicite persistant |
| Hiérarchie channels | Nom channel réduit de 14 à 13 px |
| État LIVE | Vert dédié plus soutenu, indépendant du vert générique |
| Déploiement alpha.15 | Validé sur VPS réel le 30/09/2026 ; desktop et mobile vérifiés |
| Navigation mobile | Sélecteur compact, SYSTEM conservé, SETTINGS masqué |
| Accessibilité modales | Focus confiné, fond inerte, Escape et retour au déclencheur |
| Fin de session frontend | Données purgées, requêtes annulées, réponses tardives ignorées |
| Restreamer Core 16 | Intégré |
| Channels / outputs / métriques | Intégrés |
| Monitoring SSE quasi temps réel | Intégré, 1 s par défaut |
| VPS CPU / RAM / load / uptime | Intégrés |
| VPS disque / réseau | Intégrés |
| Docker Adapter | Intégré read-only |
| Réseau proxy Docker partagé | `web-proxy` externe |
| Port Supervisor 8090 | Bouclé sur `127.0.0.1` uniquement |
| CPU Docker | Affiché en équivalent de cœurs |
| Page SYSTEM | Intégrée |
| Rôles Admin / Technician | Intégrés |
| Login intégré Supervisor | Intégré |
| Sessions navigateur + logout | Intégrés |
| Confirmations actions | Modales UI intégrées |
| Monitoring ouvert sans auth | Autorisé, read-only |
| Start/stop destinations Restreamer | Intégré, auth obligatoire |
| État observé / consigne egress | Séparés (`status` / `state.order`) |
| Contrôle ingest | Non exposé |
| Modification clés / URL / config | Non exposée |
| Probe Web UI Restreamer /ui/ | Intégré |
| Restart UI isolé | Impossible dans l'architecture Restreamer actuelle |
| Config reload Core comme recovery UI | Interdit : redémarre Core |
| Tests anti-fuite secrets | Intégrés |
| CI GitHub qualité | Intégrée |
| Diagnostics | Intégrés, safe export JSON |
| Incidents actifs | Intégrés |
| Historique incidents | 0.2 alpha.2 : 1H par défaut, TODAY / 24H, 20 lignes max visibles |
| Temps incident | `Affected time` = union temporelle, pas somme des incidents parallèles |
| Groupement causal | Egress du même channel regroupé dans une fenêtre ingest ±10 s ; au-delà il reste autonome |
| Journal événements | Intégré, persistant ; fenêtre mémoire 5000, UI brute repliée et limitée aux 20 récents |
| Retour haut de page | Bouton `↑ TOP` discret après scroll |
| Actions opérateur dans le journal | Intégrées, y compris restart Restreamer Admin |
| Restart Restreamer manuel | Alpha 18 : Admin uniquement, confirmation forte, helper Docker cible fixe, vérification Core/UI |
| Docker control helper | Réseau interne uniquement, aucun port hôte, socket absent du frontend/Supervisor Web |
| Watchdog gradué | Intégré, mode observe par défaut |
| Recovery egress ciblée | Intégrée mais désarmée par défaut |
| Restart automatique Restreamer | Interdit en alpha.12 |

## Politique de récupération Web UI

La Web UI est servie directement par datarhei Core depuis `/ui/`. Elle n'a pas de processus séparé.

Si la Web UI est indisponible mais que `GET /api` et l'API process répondent :
- Supervisor considère Core opérationnel ;
- les flux ne sont pas touchés ;
- les commandes opérateur via API restent disponibles ;
- aucun restart Core n'est déclenché automatiquement.

Le endpoint Core de reload de configuration n'est pas une relance de la seule UI : il redémarre Core et ne doit pas servir de raccourci.

## Sécurité d'accès

Sans compte Supervisor configuré, l'interface reste accessible en monitoring mais les actions sont verrouillées.

Avec authentification :
- **Technician** : start/stop des destinations existantes ;
- **Admin** : start/stop des destinations et restart manuel du conteneur Restreamer en dernier recours.

## Prochaine étape

Le déploiement réel de 0.2 alpha.1 a montré la limite de la première approche : plusieurs incidents parallèles pouvaient produire des centaines de lignes et un « temps cumulé » très supérieur au temps réellement affecté.

0.2 alpha.2 corrige cette lecture sans supprimer l'information brute :
- période 1H par défaut, avec TODAY et 24H ;
- 20 incidents racine maximum visibles ;
- `Affected time` calculé comme temps mural avec au moins un incident ;
- erreurs egress downstream regroupées lorsqu'elles sont entièrement couvertes par une perte ingest du même channel ;
- journal brut conservé mais replié et limité visuellement à 20 événements ;
- bouton `↑ TOP` après scroll.

Aucun incident n'est effacé et le modèle interne/watchdog n'est pas modifié. La validation réelle d'alpha.2 a montré `GROUPED DOWNSTREAM = 0` malgré des épisodes egress manifestement liés à une perte ingest. Le correctif PR #27 est fusionné sur `main` après `quality` et `visual` verts : même channel + fenêtre ingest élargie de 10 s avant/après. Un egress qui dépasse cette marge reste autonome. Validation réelle confirmée après redéploiement : sur la fenêtre 1H, 40 root incidents avec 33 downstream regroupés ; sur TODAY/24H, 675 root incidents avec 38 downstream regroupés. Des lignes ingest affichent désormais explicitement `+12` et `+5 downstream egress errors grouped under ingest loss`. Le correctif de corrélation est donc considéré validé en production.

Point connu non bloquant : les channels 8 et 9 ont déjà montré des oscillations serveur `INCIDENT OPEN → RESOLVED → OPEN` lorsqu'ils sont sans source. La cause n'est pas démontrée ; ne pas modifier cette logique sans investigation dédiée.

Alpha.12 validée sur le VPS réel en modes observe et recover : un egress RTMP volontairement invalide avec ingest LIVE est devenu recovery candidate, a déclenché une unique commande START ciblée, puis une vérification après délai. La recovery non confirmée a été journalisée, la limite d'une tentative a conduit l'état à MANUAL, sans restart Core/conteneur ni action sur les autres flux. Les ingests absents restent exclus des recovery candidates. Correction alpha.12.1 : pendant la fenêtre de vérification watchdog, l'incident egress reste maintenu ouvert afin d'éviter le bruit RESOLVED → OPEN provoqué par un état transitoire après START.
