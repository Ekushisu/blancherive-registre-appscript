# Passation vers Codex VS Code

Le contenu de `src/` est volontairement inchangé par ce pack.

Commencer une session Codex avec :

> Lis AGENTS.md puis les fichiers docs qu'il référence. Considère le code du repo comme source de vérité. Résume l'architecture et les travaux connus avant de modifier quoi que ce soit.

## Frontend

Le source React est dans `ui/`. `src/Index.html` est généré par `npm run build` et ne doit pas être modifié à la main.

`npm run push` exécute le build avant le push clasp.

## Attention clasp

`.clasp.json` se trouve dans `src/`, alors que `package.json` et les scripts npm
sont à la racine. Les scripts npm exécutent clasp depuis `src/`.

Je n'ai pas déplacé ce fichier dans cette passation afin de ne pas changer le
workflow du snapshot sans validation.
