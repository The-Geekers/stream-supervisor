# Project Status

**Version :** 0.1.0-alpha.16
**Phase :** socle 0.1 fonctionnel + harmonisation visuelle Distillerie

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 16, cinq vues responsive + thèmes Dark/Light |
| Thème Dark | Référence alpha.15 conservée par défaut |
| Thème Light | Palette Distillerie Portal v1.0.3, sans changement de géométrie |
| Préférence thème | Locale au navigateur uniquement (`localStorage`) |
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
| Actions opérateur dans le journal | Intégrées |
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
- **Admin** : mêmes actions dans alpha.9, rôle réservé aux futures opérations plus sensibles.

## Prochaine étape

Alpha.14 a été validée en conditions réelles : ERROR avec consigne START conserve STOP et RETRY ; watchdog observe sans tentative et retour propre à LIVE. Cette logique reste inchangée.

Alpha.15 a été déployée sur le VPS réel le 30/09/2026. Les cinq vues desktop ont été vérifiées, puis la navigation et le rendu mobile ont été contrôlés sur l'instance réelle. Les points d'accessibilité clavier restent couverts par les tests navigateur automatisés.

Alpha.16 est une évolution **strictement UI** : le Dark d'alpha.15 reste la référence par défaut et un Light reprend la palette du portail Distillerie v1.0.3. Les tailles, grilles, métriques typographiques, règles responsive, adaptateurs, API, sécurité, watchdog et actions opérateur restent inchangés. Après CI verte et fusion, déployer avec `deployment/update.sh`, vérifier Dark + Light sur desktop/mobile, puis ouvrir la phase 0.2 Monitoring & exploitation.

Point connu non bloquant : les channels 8 et 9 ont déjà montré des oscillations serveur `INCIDENT OPEN → RESOLVED → OPEN` lorsqu'ils sont sans source. La cause n'est pas démontrée ; ne pas modifier cette logique sans investigation dédiée.

Alpha.12 validée sur le VPS réel en modes observe et recover : un egress RTMP volontairement invalide avec ingest LIVE est devenu recovery candidate, a déclenché une unique commande START ciblée, puis une vérification après délai. La recovery non confirmée a été journalisée, la limite d'une tentative a conduit l'état à MANUAL, sans restart Core/conteneur ni action sur les autres flux. Les ingests absents restent exclus des recovery candidates. Correction alpha.12.1 : pendant la fenêtre de vérification watchdog, l'incident egress reste maintenu ouvert afin d'éviter le bruit RESOLVED → OPEN provoqué par un état transitoire après START.
