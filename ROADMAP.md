# Roadmap

## 0.1 — Restreamer Supervisor

Socle applicatif, authentification, rôles Admin/Technicien, état système et Docker, adaptateur Restreamer, channels/entrées/sorties, start/stop sécurisé, diagnostics et premières règles de watchdog.

### Stabilisation 0.1 actuelle

Le périmètre fonctionnel 0.1 est atteint. Alpha.14 a validé en conditions réelles la séparation entre état observé et consigne egress. Alpha.15 a livré le responsive, la navigation mobile, l'accessibilité des modales et la purge frontend ; elle a été déployée et vérifiée sur le VPS réel le 30/09/2026.

Alpha.16 a introduit les thèmes Dark/Light. Alpha.17 finalise le polish : Light par défaut, nom des channels légèrement réduit et vert LIVE plus soutenu. Alpha.18, désormais fusionnée sur `main` via la PR #22, ajoute l'action exceptionnelle de restart Restreamer réservée à Admin : manuelle, confirmée, journalisée, via helper Docker à cible fixe, avec vérification Core/UI et aucun restart automatique. Après déploiement et validation réelle d'alpha.18, la stabilisation 0.1 peut être considérée terminée et la phase 0.2 commence.

## 0.2 — Monitoring & exploitation

Phase active.

### 0.2 alpha.1 — Historique incidents minimal

Premier lot : historique dérivé du journal persistant, testé en production. La validation réelle a révélé une surcharge de lecture : événements parallèles additionnés et page trop longue.

### 0.2 alpha.2 — Vue opérateur incidents

Correction ciblée :
- 1H par défaut, sélecteurs TODAY / 24H ;
- 20 lignes d'historique maximum ;
- `Affected time` calculé par union des intervalles pour ne pas multiplier le temps lors d'incidents parallèles ;
- regroupement des erreurs egress entièrement couvertes par une perte ingest du même channel ;
- journal brut replié et limité à 20 événements dans l'UI ;
- bouton de retour en haut après scroll.

Le journal persistant complet et les incidents techniques restent conservés. Aucun changement watchdog, aucune alerte externe, aucun graphique et aucune nouvelle base dans ce lot. La PR #25 est fusionnée sur `main` avec `quality` et `visual` verts.

Validation réelle alpha.2 : le compteur `GROUPED DOWNSTREAM` restait à 0 car les incidents egress pouvaient être ouverts quelques secondes avant l'incident ingest. Correctif fusionné via la PR #27 : marge de corrélation de 10 s sur le même channel ; un egress au-delà de cette marge reste autonome. Validation production ensuite confirmée : 33 downstream regroupés sur la vue 1H et 38 sur TODAY/24H, avec réduction visible du nombre de root incidents.

Les étapes suivantes de 0.2 restent les métriques historiques utiles, les alertes et l'historique de recovery, mais une nouvelle brique ne sera ouverte qu'après validation réelle de cette vue opérateur.

## 0.3 — Multi-engine

Stabilisation du contrat d'adaptateurs, puis étude et ajout de MediaMTX et Muxshed.

## 0.4 — Exploitation avancée

Presets, sauvegarde/restauration, planification éventuelle des sorties et outils orientés événementiel.

## Hors périmètre

Supervisor n'est pas un relais média, un transcodeur ni un moteur de diffusion.
