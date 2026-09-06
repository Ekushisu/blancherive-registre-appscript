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

- `HistoriqueEffectifs.js`
  - identifiants stables dans `Effectifs!ID membre` et journal append-only `HistoriqueEffectifs`
  - comparaison des états à la consultation et avant/après les mutations applicatives, sous verrou de script
  - déclencheur installable `surModificationHistoriqueEffectifs_` pour les éditions manuelles Sheets, installé à la première consultation OFFICIER d'Effectifs ou de l'Organigramme
  - pas de modification des Présences ; les appels existants de génération restent dans `Effectifs.js`

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
  - alimentation du cache juridique `SyncCodex!A:J` et des listes d'infractions `SyncCodex!L:O`

- `Amendes.js`
  - registre des amendes
  - helpers partagés utilisés aussi par `Prison.js`

- `Prison.js`
  - registre des incarcérations

## Frontend

Le source frontend est dans `ui/` :
- `ui/src/main.jsx` : point d'entrée React ;
- `ui/src/app.jsx` : composants de l'interface ;
- `ui/src/styles.css` : styles ;
- `ui/src/changes.jsx` : badges, panneau des nouveautés et suivi de lecture commun aux deux pages ;
- `ui/src/change-state.js` : expiration et persistance locale des ID événements vus ;
- `ui/index.template.html` : squelette HTML Apps Script.

`src/Index.html` est l'artefact généré par `npm run build`. Il est le seul fichier frontend envoyé par clasp et ne doit pas être modifié à la main.

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
- `trouverValeurTechniqueBrute`
- `lireListeTechnique`
- `nettoyerSaisieUtilisateur`
- `parseDateInput`

`Amendes.js` et `Prison.js` utilisent :
- `SyncCodex!L:O` pour les infractions et leurs sanctions ;
- `Données!O2:O` pour la liste des gardes actifs.

`Codex.js` utilise les identifiants de documents déclarés dans `SyncCodex.js`, mais construit ses métadonnées à l'exécution afin de ne pas dépendre de l'ordre de chargement Apps Script.

Ne pas considérer les fichiers `.js` Apps Script comme des modules ES isolés : ils partagent le namespace global.
