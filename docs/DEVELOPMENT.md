# Development

## Phase actuelle

Ne pas choisir de framework uniquement pour commencer à coder. L'audit technique Restreamer doit d'abord déterminer les fonctions réellement disponibles.

## Workflow

- `main` : état validé.
- Modifications petites et reviewables.
- Documentation mise à jour avec chaque évolution significative.
- Aucun secret de production utilisé dans les tests.
- Utiliser des fixtures nettoyées.

## Conditions de validation

Une fonctionnalité n'est terminée que si son comportement et ses modes d'échec sont documentés, qu'elle ne peut pas interrompre un flux non concerné, qu'elle n'expose aucun secret et que son rollback est clair.

## Version

Version de départ : `0.1.0-dev`.
