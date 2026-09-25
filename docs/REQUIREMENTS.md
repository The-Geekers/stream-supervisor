# Cahier des charges — v0.1

## Objectif

Créer une console indépendante de supervision et d'exploitation d'un VPS de streaming, initialement centrée sur Restreamer. Supervisor doit rester utile même si l'interface Web native du moteur rencontre un problème.

## Fonctions principales

1. Authentifier les utilisateurs.
2. Gérer au minimum les rôles Admin et Technicien.
3. Afficher CPU, RAM, disque, réseau et uptime.
4. Afficher l'état des conteneurs Docker utiles.
5. Distinguer Restreamer Core/API, Web UI et processus média.
6. Découvrir les channels, entrées et sorties réellement exposés.
7. Afficher l'état des sorties et les métriques disponibles.
8. Permettre le start/stop d'une sortie configurée sans redémarrage global.
9. Générer un diagnostic avec redaction automatique des secrets.
10. Historiser les actions importantes.

## Watchdog

Le watchdog doit appliquer une récupération graduée. Un simple 404, timeout ou crash de l'interface Web ne suffit jamais à justifier un redémarrage global. L'état API/Core, les processus et les sorties actives doivent être analysés séparément.

## Contraintes

- Interface responsive PC / tablette / mobile.
- Aucun trafic média ne passe par Supervisor.
- Une panne de Supervisor ne coupe pas la diffusion.
- Architecture par adaptateurs.
- Dépôt public sans secret.
- Déploiement reproductible et documenté.

## Décisions encore ouvertes

- Stack applicative.
- Reverse proxy final.
- Méthode précise d'accès Docker.
- Endpoints Restreamer réellement utilisables.
