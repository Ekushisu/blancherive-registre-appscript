# Architecture

## Backend

Tous les fichiers de `src/` sont chargés dans le même runtime Apps Script V8.

Principaux modules :

- `Code.js`
  - `SPREADSHEET_ID`
  - `doGet()`
  - fonctions historiques de génération / réparation / mise en forme des Présences
  - installation des triggers

- `Auth.js`
  - login par mot de passe de rôle
  - token HMAC
  - expiration 8 h
  - `requireRole()`

- `Organigramme.js`
  - lecture des effectifs et construction de l'organigramme

- `Effectifs.js`
  - API Web OFFICIER pour lire / ajouter / modifier les effectifs
  - aucune suppression

- `Presences.js`
  - lecture Web des présences
  - génération / synchronisation
  - modification des cases de présence et du statut Payé

- `PresenceDashboard.gs.js`
  - synthèse financière et inactivité, OFFICIER

- `Codex.js`
  - lecture du cache `SyncCodex` pour la Web App

- `SyncCodex.js`
  - extraction des documents juridiques
  - alimentation du cache `SyncCodex`

- `Amendes.js`
  - registre des amendes
  - helpers partagés utilisés aussi par `Prison.js`

- `Prison.js`
  - registre des incarcérations

## Frontend

`src/Index.html` contient :
- CSS ;
- React ;
- toute l'interface ;
- appels serveur via `google.script.run`.

Fonction utilitaire centrale :

```js
serverCall(name, ...args)
```

Elle encapsule `google.script.run` dans une Promise.

Pages :
- Organigramme
- Effectifs (OFFICIER seulement)
- Présences
- Codex
- Amendes
- Prison

## Couplages importants

`Prison.js` utilise des helpers déclarés dans `Amendes.js` :
- `getLastNonEmptyRowInColumn`
- `lireColonneTechnique`
- `lireListeTechnique`
- `nettoyerSaisieUtilisateur`
- `parseDateInput`

Ne pas considérer les fichiers `.js` Apps Script comme des modules ES isolés : ils partagent le namespace global.
