# Passation vers Codex VS Code

Le contenu de `src/` est volontairement inchangé par ce pack.

Commencer une session Codex avec :

> Lis AGENTS.md puis les fichiers docs qu'il référence. Considère le code du repo comme source de vérité. Résume l'architecture et les travaux connus avant de modifier quoi que ce soit.

## Attention clasp

Dans le snapshot reçu, `.clasp.json` se trouve dans `src/`, alors que `package.json`
et ses scripts npm sont à la racine. Vérifier le répertoire depuis lequel `clasp`
est exécuté avant d'automatiser `npm run pull/push`.

Je n'ai pas déplacé ce fichier dans cette passation afin de ne pas changer le
workflow du snapshot sans validation.
