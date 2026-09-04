# Frontend du Registre

Le code source de l'interface React est dans `ui/src/` :

- `main.jsx` est le point d'entrée ;
- `app.jsx` contient l'application et ses composants actuels ;
- `styles.css` contient les styles ;
- `../index.template.html` est le squelette HTML Apps Script.

## Commandes

Depuis la racine du dépôt :

```sh
npm run build
npm run push
```

`npm run build` génère `src/Index.html`. Ce dernier est un artefact déployé par clasp : ne pas le modifier à la main.

Les mêmes actions sont disponibles dans VS Code via **Terminal > Run Task**, avec les tâches préfixées par un emoji.

Clasp ne permet pas de garantir l'accès public d'une Web App lors d'un redéploiement. Après le push, utiliser la tâche `🌐 Ouvrir Apps Script — déploiement public`, puis dans l'éditeur Apps Script : **Déployer > Gérer les déploiements > Modifier** le déploiement existant, conserver **Exécuter en tant que : Moi** et choisir **Qui a accès : Tout le monde**, puis déployer.
