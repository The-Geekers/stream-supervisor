# Project Status

**Version :** 0.1.0-alpha.13  
**Phase :** supervision complète + premières actions opérateur sécurisées

| Domaine | État |
|---|---|
| Dépôt GitHub / workflow GitHub → VPS | OK |
| Application Docker | OK |
| Interface monitoring | Alpha 13 |
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
| Monitoring ouvert sans auth | Autorisé, read-only |
| Start/stop destinations Restreamer | Intégré, auth obligatoire |
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

Alpha.12 validée sur le VPS réel en modes observe et recover : un egress RTMP volontairement invalide avec ingest LIVE est devenu recovery candidate, a déclenché une unique commande START ciblée, puis une vérification après délai. La recovery non confirmée a été journalisée, la limite d'une tentative a conduit l'état à MANUAL, sans restart Core/conteneur ni action sur les autres flux. Les ingests absents restent exclus des recovery candidates. Correction alpha.12.1 : pendant la fenêtre de vérification watchdog, l'incident egress reste maintenu ouvert afin d'éviter le bruit RESOLVED → OPEN provoqué par un état transitoire après START.
