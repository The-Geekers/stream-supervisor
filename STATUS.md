# Project Status

**Version :** 0.1.0-alpha.18
**Phase :** socle 0.1 fonctionnel + recovery Admin manuelle de dernier recours

| Domaine | État |
|---|---|
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
| Journal événements | Intégré, persistant |
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

Alpha.14 a été validée en conditions réelles : ERROR avec consigne START conserve STOP et RETRY ; watchdog observe sans tentative et retour propre à LIVE. Cette logique reste inchangée.

Alpha.15 a été déployée sur le VPS réel le 30/09/2026. Les cinq vues desktop ont été vérifiées, puis la navigation et le rendu mobile ont été contrôlés sur l'instance réelle. Les points d'accessibilité clavier restent couverts par les tests navigateur automatisés.

Alpha.17 est fusionnée sur `main` après workflows `quality` et `visual` verts. Elle finalise le polish UI : Light par défaut, nom des channels à 13 px et vert LIVE dédié.

Alpha.18 est fusionnée sur `main` via la PR #22 après workflows `quality` et `visual` verts. Elle implémente le **restart manuel du conteneur Restreamer réservé à Admin**. L'action exige une confirmation destructive, passe par un helper Docker séparé et interne dont la cible est fixée à `restreamer`, journalise demande/résultat, puis vérifie le retour de Core et de la Web UI. Technician ne reçoit pas ce contrôle. Aucun restart automatique n'est ajouté au watchdog et le frontend n'accède jamais au socket Docker. Prochaine action : déployer alpha.18, valider le contrôle de rôle puis effectuer un test réel uniquement dans une fenêtre où une interruption de tous les streams est acceptable.

Point connu non bloquant : les channels 8 et 9 ont déjà montré des oscillations serveur `INCIDENT OPEN → RESOLVED → OPEN` lorsqu'ils sont sans source. La cause n'est pas démontrée ; ne pas modifier cette logique sans investigation dédiée.

Alpha.12 validée sur le VPS réel en modes observe et recover : un egress RTMP volontairement invalide avec ingest LIVE est devenu recovery candidate, a déclenché une unique commande START ciblée, puis une vérification après délai. La recovery non confirmée a été journalisée, la limite d'une tentative a conduit l'état à MANUAL, sans restart Core/conteneur ni action sur les autres flux. Les ingests absents restent exclus des recovery candidates. Correction alpha.12.1 : pendant la fenêtre de vérification watchdog, l'incident egress reste maintenu ouvert afin d'éviter le bruit RESOLVED → OPEN provoqué par un état transitoire après START.
