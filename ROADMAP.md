# Roadmap

## 0.1 — Restreamer Supervisor

Socle applicatif, authentification, rôles Admin/Technicien, état système et Docker, adaptateur Restreamer, channels/entrées/sorties, start/stop sécurisé, diagnostics et premières règles de watchdog.

### Stabilisation 0.1 actuelle

Le périmètre fonctionnel 0.1 est atteint. Alpha.14 a validé en conditions réelles la séparation entre état observé et consigne egress. Alpha.15 a livré le responsive, la navigation mobile, l'accessibilité des modales et la purge frontend ; elle a été déployée et vérifiée sur le VPS réel le 30/09/2026.

Alpha.16 a introduit les thèmes Dark/Light. Alpha.17 finalise le polish : Light par défaut, nom des channels légèrement réduit et vert LIVE plus soutenu. Alpha.18, désormais fusionnée sur `main` via la PR #22, ajoute l'action exceptionnelle de restart Restreamer réservée à Admin : manuelle, confirmée, journalisée, via helper Docker à cible fixe, avec vérification Core/UI et aucun restart automatique. Après déploiement et validation réelle d'alpha.18, la stabilisation 0.1 peut être considérée terminée et la phase 0.2 commence.

## 0.2 — Monitoring & exploitation

Phase active.

### 0.2 alpha.1 — Historique incidents minimal

Premier lot volontairement limité :
- historique journalier des incidents à partir du journal persistant existant ;
- nombre d'incidents et nombre résolu ;
- somme des durées d'incidents ;
- incident le plus long ;
- début, fin, source, sévérité et durée de chaque occurrence.

La période TODAY suit le jour local du navigateur. Aucun graphique, stockage de métriques haute fréquence, alerte externe ou enrichissement watchdog n'est inclus dans ce premier lot.

Les étapes suivantes de 0.2 restent : métriques historiques utiles, alertes et historique de recovery, mais elles ne seront ouvertes qu'après validation de ce premier bloc.

## 0.3 — Multi-engine

Stabilisation du contrat d'adaptateurs, puis étude et ajout de MediaMTX et Muxshed.

## 0.4 — Exploitation avancée

Presets, sauvegarde/restauration, planification éventuelle des sorties et outils orientés événementiel.

## Hors périmètre

Supervisor n'est pas un relais média, un transcodeur ni un moteur de diffusion.
