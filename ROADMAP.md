# Roadmap

## 0.1 — Restreamer Supervisor

Socle applicatif, authentification, rôles Admin/Technicien, état système et Docker, adaptateur Restreamer, channels/entrées/sorties, start/stop sécurisé, diagnostics et premières règles de watchdog.

### Stabilisation 0.1 actuelle

Alpha.14 sépare l'état observé d'un egress de sa consigne Restreamer et a été validée en conditions réelles. Alpha.15 conserve cette logique et livre la navigation mobile des cinq vues, le responsive, l'accessibilité des modales et la purge frontend en fin de session. Prochaine étape : validation de déploiement alpha.15, puis phase 0.2.

## 0.2 — Monitoring & exploitation

Historique incidents, métriques avancées, alertes, historique des récupérations et watchdog enrichi.

## 0.3 — Multi-engine

Stabilisation du contrat d'adaptateurs, puis étude et ajout de MediaMTX et Muxshed.

## 0.4 — Exploitation avancée

Presets, sauvegarde/restauration, planification éventuelle des sorties et outils orientés événementiel.

## Hors périmètre

Supervisor n'est pas un relais média, un transcodeur ni un moteur de diffusion.
