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
