# Roadmap

## 0.1 — Restreamer Supervisor

Socle applicatif, authentification, rôles Admin/Technicien, état système et Docker, adaptateur Restreamer, channels/entrées/sorties, start/stop sécurisé, diagnostics et premières règles de watchdog.

### Stabilisation 0.1 actuelle

Le périmètre fonctionnel 0.1 est atteint. Alpha.14 a validé en conditions réelles la séparation entre état observé et consigne egress. Alpha.15 a livré le responsive, la navigation mobile, l'accessibilité des modales et la purge frontend ; elle a été déployée et vérifiée sur le VPS réel le 30/09/2026.

Alpha.16 constitue le dernier polish visuel avant 0.2 : le Dark alpha.15 reste inchangé et un thème Light reprend l'identité colorimétrique du portail Distillerie v1.0.3, sans modifier les proportions ni la logique opérationnelle. Étape suivante après CI/fusion : déploiement alpha.16 et contrôle réel Dark/Light, puis passage à 0.2.

## 0.2 — Monitoring & exploitation

Historique incidents, métriques avancées, alertes, historique des récupérations et watchdog enrichi.

## 0.3 — Multi-engine

Stabilisation du contrat d'adaptateurs, puis étude et ajout de MediaMTX et Muxshed.

## 0.4 — Exploitation avancée

Presets, sauvegarde/restauration, planification éventuelle des sorties et outils orientés événementiel.

## Hors périmètre

Supervisor n'est pas un relais média, un transcodeur ni un moteur de diffusion.
