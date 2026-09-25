# Règles contributeurs / agents

## Priorité absolue

**La continuité de diffusion est prioritaire sur l'administration.**

- Ne jamais placer Supervisor dans le chemin média.
- Ne jamais redémarrer un moteur uniquement parce que son interface Web est indisponible.
- Ne jamais supposer qu'un endpoint API existe : vérifier la version cible.
- Commencer par des opérations en lecture seule.
- Toute action destructive ou susceptible d'interrompre un flux doit être explicite.
- Un redémarrage complet de conteneur est un dernier recours.
- Ne jamais exposer directement le socket Docker au frontend.

## Secrets

Ne jamais versionner mots de passe, clés de stream, tokens API, cookies, sessions, sauvegardes de production ou diagnostics non nettoyés.

## Documentation

Mettre à jour `STATUS.md`, `ROADMAP.md` et `CHANGELOG.md` lorsqu'une évolution change réellement l'état du projet. Les découvertes propres à chaque moteur vont dans `docs/engines/`.

## Développement

Les intégrations moteurs doivent passer par des adaptateurs. Le frontend ne doit contenir aucune logique privilégiée spécifique à un moteur. Préférer des modifications petites, testables et réversibles.
