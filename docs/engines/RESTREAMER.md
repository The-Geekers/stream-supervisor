# Restreamer Adapter

**État : audit à faire.**

Restreamer est la cible principale de Stream Supervisor v0.1.

## Points à auditer

- version exacte ;
- méthode d'authentification ;
- API réellement exposée ;
- découverte des channels ;
- état des inputs ;
- sorties configurées ;
- état des sorties ;
- start / stop d'une sortie ;
- métriques disponibles ;
- relation Core/API / Web UI ;
- comportement lorsque l'UI Web est indisponible ;
- processus FFmpeg ;
- présence éventuelle de secrets dans logs ou lignes de commande.

Aucune fonction ne sera considérée supportée avant validation sur la version réellement utilisée.
