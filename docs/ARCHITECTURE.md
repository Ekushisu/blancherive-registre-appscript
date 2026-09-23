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
  - `ecrirePresenceCellule_` : écriture validée d'une case F:L ou O, partagée avec
    `Paye.js` pour que les deux chemins appliquent les mêmes contrôles

- `PresenceDashboard.gs.js`
  - synthèse financière et inactivité, OFFICIER

- `Paye.js`
  - regroupement des semaines closes impayées par financeur : argentier de la cour
    pour Cité de Blancherive / Éclaireurs / État-Major, un Thane par garnison
  - lecture OFFICIER et INTENDANT ; règlement d'une semaine par les seuls OFFICIER,
    délégué à `ecrirePresenceCellule_` de `Presences.js`
  - n'écrit rien de lui-même et ne touche à aucune colonne autre que `Présences!O`

- `SoldesGrades.js`
  - barème journalier dans la feuille `SoldesGrades`, initialisé depuis `Données!A2:A` et l'ancienne base `Vue globale!L2`
  - application à la semaine courante, gel des anciennes références à la base commune et conservation des tarifs historiques
  - formules de solde communes aux deux chemins de génération (`Code.js` et `Presences.js`) et aux lectures Web

- `Codex.js`
  - lecture du cache `SyncCodex` pour la Web App
  - `getCodexDocumentMetadata_()` dérive familles, autorités et liens du registre
    `SYNC_CODEX_DOCUMENTS` ; les documents ne sont déclarés qu'une fois

- `SyncCodex.js`
  - `SYNC_CODEX_DOCUMENTS` : registre unique des documents, codes et décrets
  - lecture par `getText()`, qui couvre les listes à puces et les tableaux,
    et parcours des onglets par `getTabs()` quand l'exécution les expose
  - extraction des documents juridiques
  - alimentation du cache juridique `SyncCodex!A:J` et des listes d'infractions `SyncCodex!L:O`
  - choix de sanctions contextualisés en JSON dans M/O, exposés aux formulaires et revalidés à l’ajout par les helpers privés d’`Amendes.js` partagés avec `Prison.js`

- `Amendes.js`
  - registre des amendes
  - helpers partagés utilisés aussi par `Prison.js`

- `Prison.js`
  - registre des incarcérations
  - ajouts sous verrou et saisies structurées dans la colonne J

- `Objets.js`
  - recherche GARDE / OFFICIER dans `Objets!A:C`, trois caractères minimum, quinze suggestions maximum
  - initialisation de la feuille absente à partir de la ressource serveur `CatalogueObjets.html`
  - validation des saisies et affichage compatible avec les textes historiques
  - `getCatalogueObjets` : catalogue complet en tableau compact `[id, nom, type]` avec une empreinte MD5 du contenu ; renvoie `objets: null` si le navigateur connaît déjà cette version. Alimente le cache local de `ui/src/catalogue.js`

- `Inventaire.js`
  - feuilles `Coffres` et `Inventaire`, créées avec leurs en-têtes à la première consultation
  - lecture OFFICIER et INTENDANT ; coffres, quantités et déplacements réservés aux OFFICIER
  - un objet par coffre : `ajusterInventaire` (une variation) et `rangerInventaire` (une liste entière) passent par `appliquerAjustementsInventaire_`, qui cumule ou retire, fait disparaître la ligne à zéro et ne lit le catalogue qu'une fois par requête
  - le bloc `Inventaire!A:D` est relu et réécrit en entier sous verrou de script
  - les objets viennent du catalogue `Objets` par `lireCatalogueObjets_`, nom figé à l'entrée en stock comme dans `Prison!J`

## Frontend

Le source frontend est dans `ui/` :
- `ui/src/main.jsx` : point d'entrée React ;
- `ui/src/app.jsx` : composants de l'interface ;
- `ui/src/saisies.jsx` : autocomplétion et liste des objets saisis ;
- `ui/src/sanctions.jsx` : choix de sanction et motif personnalisé communs aux formulaires Amendes/Prison ;
- `ui/src/styles.css` : styles ;
- `ui/src/theme.css` : thème parchemin/sépia et adaptations mobiles, chargé après les styles structurels ;
- `ui/src/navigation.jsx` : connexion illustrée, navigation latérale sur ordinateur et inférieure sur mobile ;
- `ui/assets/` : copies web des illustrations/papier du manuel, incorporées au build ;
- `ui/src/grades.jsx` : descriptions doctrinales des grades affichées dans l'Organigramme, table statique sans fonction serveur associée ;
- `ui/src/catalogue.js` : cache local du catalogue des objets — préchargement à l'ouverture des pages Prison et Inventaire (officier), `localStorage` versionné, recherche en mémoire identique à `rechercherObjets` (parité vérifiée par `scripts/test-catalogue-local.mjs`), hook `useCatalogue` ;
- `ui/src/inventaire.jsx` : page Inventaire — cartes de coffres, formulaire de coffre, rangement d'un objet par la recherche au catalogue de `saisies.jsx`, tableau des stocks ;
- `ui/src/changes.jsx` : badges, panneau des nouveautés et suivi de lecture commun aux deux pages ;
- `ui/src/change-state.js` : expiration et persistance locale des ID événements vus ;
- `ui/index.template.html` : squelette HTML Apps Script.

Les aperçus de `docs/apercus/` se régénèrent par `npm run apercus`. `scripts/capture-apercus.mjs` sert le `src/Index.html` compilé sur un serveur HTTP local, remplace `google.script.run` par un stub alimenté par `scripts/apercus-donnees.mjs`, puis capture les pages avec Microsoft Edge via `playwright-core`. Le navigateur du système est utilisé tel quel : aucun téléchargement de navigateur, et `playwright-core` reste une `devDependency` absente du bundle Apps Script.

`src/Index.html` est l'artefact frontend généré par `npm run build` et ne doit pas être modifié à la main. Le build prépare aussi `src/CatalogueObjets.html`, une ressource JSON serveur initialisant Objets, et `docs/catalogue-objets/Objets.csv` depuis l'extraction locale. Le catalogue n'est jamais incorporé au frontend.

Fonction utilitaire centrale :

```js
serverCall(name, ...args)
```

Elle encapsule `google.script.run` dans une Promise.

Pages :
- Organigramme
- Effectifs (OFFICIER seulement)
- Présences
- Paye (OFFICIER et INTENDANT ; règlement réservé aux OFFICIER)
- Codex
- Amendes
- Prison
- Inventaire (OFFICIER et INTENDANT ; écriture réservée aux OFFICIER ; invisible pour GARDE)

Le rôle INTENDANT ne se voit proposer que l'Organigramme, la Paye et l'Inventaire. La
navigation, le routage de `App` et les contrôles serveur portent chacun cette
restriction : aucun des trois ne suffit seul.

Le routage de la page Paye désigne ses rôles au lieu d'en exclure. Depuis
l'introduction de `VISITEUR`, une condition du genre `role!=="GARDE"` laisserait
entrer le visiteur public ; la liste blanche `OFFICIER` / `INTENDANT` reste juste
quel que soit le prochain rôle ajouté.

## Couplages importants

`Paye.js` utilise des helpers déclarés dans `Presences.js` :
- `ecrirePresenceCellule_`
- `getLastPresenceRowWebApp`
- `getCurrentIsoWeekWebApp`
- `estCorpsExcluDesPresences_`
- `mettreAJourSoldesPresences_`

`Inventaire.js` utilise :
- `nettoyerSaisieUtilisateur`, déclaré dans `Amendes.js` ;
- `lireCatalogueObjets_`, déclaré dans `Objets.js`, pour résoudre un objet nouveau en stock. Un objet déjà en stock réutilise l'instantané de sa ligne sans relire le catalogue.

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

`Codex.js` dérive ses métadonnées du registre `SYNC_CODEX_DOCUMENTS` de `SyncCodex.js`, et les construit à l'exécution afin de ne pas dépendre de l'ordre de chargement Apps Script. Ajouter un texte juridique ne demande donc qu'une entrée dans ce registre.

Le champ `source` d'un document sert de clé d'affichage dans le Codex. Les libellés d'infraction enregistrés dans Amendes et Prison sont de la forme `Art. N — Titre` et ne contiennent pas le nom de la source ; renommer une source impériale n'orpheline donc pas les lignes historiques. En revanche, ces libellés proviennent exclusivement du Codex Judiciaire de Blancherive, dont les titres d'articles ne doivent pas changer à la légère.

Ne pas considérer les fichiers `.js` Apps Script comme des modules ES isolés : ils partagent le namespace global.
