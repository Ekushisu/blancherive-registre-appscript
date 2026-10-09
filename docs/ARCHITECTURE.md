# Architecture

## Backend

Tous les fichiers de `src/` sont chargés dans le même runtime Apps Script V8.

Principaux modules :

- `Code.js`
  - `SPREADSHEET_ID`
  - `doGet()`
  - constante partagée `PRESENCES_SHEET_NAME`
  - les anciennes fonctions de génération hebdomadaire des Présences, leurs
    déclencheurs et la copie de mise en forme vers les feuilles de corps ont été
    retirés le 28 septembre 2026 ; le seul chemin de génération est
    `genererPresencesSemaineCourante()` dans `Presences.js`, et les sept
    feuilles de corps (vues `QUERY` d'Effectifs) ont été supprimées du classeur,
    l'Organigramme de l'application les remplaçant

- `Auth.js`
  - login par mot de passe de rôle
  - token HMAC
  - expiration 8 h
  - `requireRole()`

- `Organigramme.js`
  - lecture des effectifs et construction de l'organigramme
  - `ORGANIGRAMME_GARNISONS` : corps affichés, leur nom et les libellés de la feuille qui y mènent ; un corps absent n'apparaît pas

- `AliasGrades.js`
  - `lireAliasGrades_` : alias de grade par corps, lus dans les colonnes « Alias <corps> » de `Données` (« Alias Inquisition ») ; table renvoyée sous `aliasGrades` par `getEffectifs`, `getOrganigramme`, `getPresences`, `getPresenceOfficerDashboard` et `getPaye`
  - `gradeAffiche_` : grade à afficher pour un membre d'un corps, utilisé par `Amendes.js` pour nommer les collecteurs ; même règle que `libelleGrade` (`ui/src/corps.js`), parité vérifiée par `scripts/test-alias-grades.mjs`
  - affichage seulement, aucune écriture

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
  - section LUNDI DE SEMAINE : `Présences!A` porte le lundi ISO en texte ;
    `lundiCourantPresence_`, `normaliserLundiPresence_` (anciennes valeurs
    ramenées au lundi), `estLundiPresence_`, `comparerLundisPresence_`,
    `ecartSemainesPresence_`, `numeroSemaineIsoPresence_` ; utilisées par toutes
    les lectures de la colonne, y compris `Paye.js`, `PresenceDashboard.gs.js` et
    `SoldesGrades.js`. Le serveur ne manipule jamais de numéro de semaine ;
    `getCurrentIsoWeekWebApp` subsiste, dérivée du lundi courant
  - `inventorierReferencesSemainePresences` et `migrerPresencesVersLundis` :
    fonctions manuelles de l'éditeur, inventaire des formules du classeur lisant
    `Présences!A` puis conversion de la colonne A seule
  - `ecrirePresenceCellule_` exige l'identité de la ligne (`lundi`, `prenom`,
    `nom`) et écrit sous le verrou de document

- `PresenceDashboard.gs.js`
  - synthèse financière et inactivité, OFFICIER

- `Paye.js`
  - regroupement des semaines closes impayées par financeur : argentier de la cour
    pour Cité de Blancherive / Éclaireurs / État-Major / Faubourgs / Garde
    inquisitoriale, un Thane pour Rivebois, Bois-de-Chêne et Cap Granite
  - lecture OFFICIER et INTENDANT ; règlement d'une semaine par les seuls OFFICIER,
    délégué à `ecrirePresenceCellule_` de `Presences.js`
  - n'écrit rien de lui-même et ne touche à aucune colonne autre que `Présences!O`

- `SoldesGrades.js`
  - barème journalier dans la feuille `SoldesGrades`, initialisé depuis `Données!A2:A` et l'ancienne base `Vue globale!L2`
  - application à la semaine courante, gel des anciennes références à la base commune et conservation des tarifs historiques
  - formules de solde communes aux deux chemins de génération (`Code.js` et `Presences.js`) et aux lectures Web

- `Codex.js`
  - lecture du cache `SyncCodex` pour la Web App, versionnée par empreinte (`getCodex(token, versionConnue)`)
  - `getCodexDocumentMetadata_()` dérive familles, autorités, liens, sigles et citabilité du registre
    `SYNC_CODEX_DOCUMENTS` et du cache `R:Y` ; les documents ne sont déclarés qu'une fois
  - `indexerArticlesCodex_()` et `cleArticleCodex_()` : index `source|article` servant à valider les chefs d'accusation d'`Amendes.js` et `Prison.js`

- `SyncCodex.js`
  - `SYNC_CODEX_DOCUMENTS` : registre unique des documents, codes et décrets
  - lecture par `getText()`, qui couvre les listes à puces et les tableaux,
    et parcours des onglets par `getTabs()` quand l'exécution les expose
  - extraction des documents juridiques
  - alimentation du cache juridique `SyncCodex!A:J`, des métadonnées `R:Y` (source, famille, autorité, applicabilité, local, lien, sigle, citable) et des anciennes listes d'infractions `SyncCodex!L:O`, que l'application ne lit plus
  - choix de sanctions contextualisés en JSON dans M/O : n'alimentent plus que les suggestions de montant/durée du Codex et des formulaires, sans contrainte
  - `abregerSourceCodex_` : sigle d'une source (déclaré ou dérivé du nom)
  - qualification du titre, entre parenthèses (« (délit) », codes de Blancherive) ou entre crochets (« [Contravention] », Corpus Juriscivilis) : `separerClassificationTitreCodex_` l'ôte du titre et en fait la classification

- `Amendes.js`
  - registre des amendes : lecture A:H, ajout et modification (OFFICIER) sous verrou de script, montant libre ou vide (« À déterminer »)
  - chefs d'accusation : `validerChefsAccusation_` (références revalidées contre l'index du Codex, titres figés, JSON en colonne technique), `lireChefsAccusation_`, `garantirColonnesRegistre_`, identité de ligne `lireIdentiteAttendue_` / `verifierIdentiteRegistre_`
  - helpers partagés utilisés aussi par `Prison.js`

- `Prison.js`
  - registre des incarcérations : lecture A:L, ajout et modification (OFFICIER) sous verrou, durée libre ou vide, sortie prévue recalculée
  - saisies structurées dans la colonne J ; une modification qui n'envoie pas de saisies la laisse intacte (saisies historiques en texte)

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

- `PeinesAmendes.js`
  - feuille `PeinesAmendes` : barème des sanctions article par article (niveaux, qualification, échelon, amende, cachot, rachat nobiliaire, crime de sang), créée et initialisée depuis `PEINES_INITIALES` à la première consultation si elle manque ou est entièrement vide, jamais réécrite ensuite
  - `getPeinesAmendes(token, versionConnue)` : GARDE, OFFICIER et INTENDANT, versionné par empreinte MD5 comme le Codex ; lignes illisibles écartées et signalées dans `anomalies` avec leur ligne physique, lignes hors fourchette gardées avec leurs `avertissements`
  - le barème propose, il n'impose pas : `Amendes.js` et `Prison.js` ne lisent pas cette feuille

## Frontend

Le source frontend est dans `ui/` :
- `ui/src/main.jsx` : point d'entrée React ;
- `ui/src/app.jsx` : composants de l'interface ;
- `ui/src/saisies.jsx` : autocomplétion et liste des objets saisis ;
- `ui/src/codex.js` : cache local du Codex (`localStorage` versionné, hook `useCodex`), recherche en mémoire des articles citables (`rechercherArticlesLocal`), helpers de chefs d'accusation (`ajouterChef`, `chefsPourServeur`, `chefsDeLigne`, `chefsFrequents`, `qualificationMax`) et résolution des libellés antérieurs ;
- `ui/src/chefs.jsx` : champ à jetons des chefs d'accusation (`ChefsField`), champ de sentence libre ou à déterminer (`SentenceField`), résumé de qualification et jetons du registre (`ChefsChips`), communs aux formulaires Amendes/Prison ;
- `ui/src/peines.js` : cache local du barème des peines (`localStorage` versionné, hook `usePeines`), niveaux d'un article (`niveauxArticle`, repli sur la ligne « * » de sa source), valeur d'un niveau pour un noble ou un récidiviste (`valeurNiveau`), proposition d'un formulaire (`propositionBareme` : cumul des faits distincts ou qualification la plus rigoureuse), grille des échelons, entrées d'une personne sur sept jours ;
- `ui/src/bareme.jsx` : niveaux d'un article (`NiveauxBareme`, `BaremeArticle` dans la lecture d'un article), puce de résumé des cartes du Codex, bloc de proposition des formulaires Amendes et Prison (`PropositionBareme`) ;
- `ui/src/peines.jsx` : page « Décrets de peines et amendes » ;
- `ui/src/article.jsx` : lecture d'un article en popup (`LawModal`), commune au Codex, aux registres, aux formulaires et à la page des décrets, avec le barème de l'article ;
- `ui/src/brouillon.js` : brouillon `sessionStorage` des formulaires de création Amendes/Prison, effacé à l'enregistrement ;
- `ui/src/styles.css` : styles ;
- `ui/src/theme.css` : thème parchemin/sépia et adaptations mobiles, chargé après les styles structurels ;
- `ui/src/navigation.jsx` : connexion illustrée, navigation latérale sur ordinateur et inférieure sur mobile ;
- `ui/assets/` : copies web des illustrations/papier du manuel, incorporées au build ;
- `ui/src/grades.jsx` : descriptions doctrinales des grades affichées dans l'Organigramme, table statique sans fonction serveur associée ;
- `ui/src/semaine.js` : libellés de semaine calculés depuis le lundi ISO renvoyé par le serveur (`libelleSemaine`, `dateLundi`, `titreSemaine`, `numeroSemaine`, `retardSemaines`, tri décroissant) ; seul endroit où un numéro de semaine est produit ;
- `ui/src/calendrier.js` et `calendrier.jsx` : calendrier tamrielien pour l'affichage (`dateTamriel`, `dateReelle`, `lireDate`, composant `DateRP`). Lit les formats que le serveur renvoie (`yyyy-MM-dd`, ISO avec heure, `dd/MM/yyyy`, `dd/MM/yyyy HH:mm`) et rend « Loredas 26 Âtrefeu 4E 226 » avec la date réelle en info-bulle ; une valeur non reconnue est rendue telle quelle. Les données, l'API et les champs de saisie restent en calendrier réel ;
- `ui/src/catalogue.js` : cache local du catalogue des objets — préchargement à l'ouverture des pages Prison et Inventaire (officier), `localStorage` versionné, recherche en mémoire identique à `rechercherObjets` (parité vérifiée par `scripts/test-catalogue-local.mjs`), hook `useCatalogue` ;
- `ui/src/inventaire.jsx` : page Inventaire — cartes de coffres, formulaire de coffre, rangement d'un objet par la recherche au catalogue de `saisies.jsx`, tableau des stocks ;
- `ui/src/changes.jsx` : badges, panneau des nouveautés et suivi de lecture commun aux deux pages ;
- `ui/src/corps.js` : nom affiché d'un corps (`libelleCorps`), quand il diffère du libellé de la feuille (« Inquisition » → « Garde inquisitoriale ») ; affichage seulement, à garder d'accord avec `ORGANIGRAMME_GARNISONS`. Grade affiché d'un membre selon son corps (`libelleGrade`, alias de l'Inquisition), d'après la table `aliasGrades` renvoyée par le serveur ; le corps peut être le libellé de la feuille ou le nom affiché ;
- `ui/src/change-state.js` : expiration et persistance locale des ID événements vus ;
- `ui/index.template.html` : squelette HTML Apps Script.

Les aperçus de `docs/apercus/` se régénèrent par `npm run apercus`. `scripts/capture-apercus.mjs` sert le `src/Index.html` compilé sur un serveur HTTP local, remplace `google.script.run` par un stub alimenté par `scripts/apercus-donnees.mjs`, puis capture les pages avec Microsoft Edge via `playwright-core`. Le navigateur du système est utilisé tel quel : aucun téléchargement de navigateur, et `playwright-core` reste une `devDependency` absente du bundle Apps Script.

`scripts/codex-local.mjs` reconstitue le Codex depuis les copies locales de `docs/codex/`, avec l'extraction réelle de `SyncCodex.js` et la lecture réelle de `Codex.js` ; la correspondance fichier → document vient de la table de `docs/codex/README.md`. `test-peines.mjs` y vérifie que chaque article du barème existe, et les aperçus du barème y lisent les vrais titres.

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
- Peines et amendes (GARDE, OFFICIER et INTENDANT, lecture ; le barème se corrige dans Sheets)

Le rôle INTENDANT ne se voit proposer que l'Organigramme, la Paye, l'Inventaire, le Codex
et les Décrets de peines et amendes, tous en lecture. La
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
- `estCorpsExcluDesPresences_`
- `mettreAJourSoldesPresences_`
- `lundiCourantPresence_`, `normaliserLundiPresence_`, `estLundiPresence_`,
  `comparerLundisPresence_`, `ecartSemainesPresence_`

`PresenceDashboard.gs.js` et `SoldesGrades.js` utilisent aussi
`lundiCourantPresence_`, `normaliserLundiPresence_` et `estLundiPresence_` de
`Presences.js` : toute lecture de `Présences!A` passe par ces helpers, sans quoi
une ancienne valeur (numéro de semaine, cellule au format date) casse la détection
de la semaine courante.

`Effectifs.js`, `Organigramme.js`, `Presences.js`, `PresenceDashboard.gs.js`,
`Paye.js` et `Amendes.js` utilisent `lireAliasGrades_` (`AliasGrades.js`) ;
`Amendes.js` utilise aussi `gradeAffiche_`. Les suites de test qui chargent ces
fichiers sans `AliasGrades.js` y substituent `lireAliasGrades_`.

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

`Prison.js` utilise aussi, déclarés dans `Amendes.js` depuis le 29 septembre 2026 :
- `validerChefsAccusation_` et `lireChefsAccusation_` (chefs d'accusation) ;
- `garantirColonnesRegistre_`, `lireIdentiteAttendue_`, `verifierIdentiteRegistre_`
  (colonne technique et identité de ligne avant modification) ;

et, déclaré dans `Objets.js`, `lireSaisiesPrisonStructurees_`.

`Amendes.js` et `Prison.js` utilisent :
- `indexerArticlesCodex_` et `cleArticleCodex_` (`Codex.js`) pour valider chaque
  chef d'accusation contre `SyncCodex!A:D` ; les anciennes listes `SyncCodex!L:O`
  ne sont plus lues par l'application, mais encore régénérées une version ;
- `abregerSourceCodex_` (`SyncCodex.js`) pour le sigle d'une source ;
- `Données!O2:O` pour la liste des gardes actifs.

`PeinesAmendes.js` utilise `nettoyerSaisieUtilisateur` (`Amendes.js`) et
`cleArticleCodex_` (`Codex.js`) : une ligne du barème désigne un article par
la même clé source + numéro qu'un chef d'accusation. Côté navigateur, le
barème est chargé une fois (`usePeines`) et partagé par les pages Codex,
Amendes, Prison et Peines et amendes, comme le Codex ; le visiteur public ne
le reçoit pas.

`Codex.js` dérive ses métadonnées du registre `SYNC_CODEX_DOCUMENTS` de `SyncCodex.js`, et les construit à l'exécution afin de ne pas dépendre de l'ordre de chargement Apps Script. Ajouter un texte juridique ne demande donc qu'une entrée dans ce registre, avec au besoin son sigle `abrege` et `citable: false` pour un document de contexte.

`getCodex(token, versionConnue)` renvoie une empreinte MD5 du cache et ne renvoie
`articles` et `sources` que si le navigateur ne la connaît pas. Le navigateur
garde le Codex dans `localStorage` (`ui/src/codex.js`), comme le catalogue des
objets, et y cherche les chefs d'accusation en mémoire.

Le champ `source` d'un document sert de clé d'affichage dans le Codex. Un chef d'accusation est identifié par `source + numéro d'article` (`cleArticleCodex_`, `cleArticle`), jamais par le titre : le titre, la qualification et le sigle sont figés dans le JSON de la ligne. Les lignes antérieures au 29 septembre 2026 n'ont que leur libellé `Art. N — Titre` sans nom de source : il se résout par égalité exacte, puis, à défaut, par numéro d'article dans l'ancien Codex Judiciaire de Blancherive (`resoudreLibelleHistorique` dans `ui/src/codex.js`), caduc depuis le 27 septembre 2026 mais seule source des libellés antérieurs.

Le droit de la châtellerie est porté par quatre codes adoptés par la Cour de Blancherive : Loi fondamentale, Code pénal local, Code civil local et Code du commerce local. Le Code pénal qualifie chaque article dans son titre (« (délit) », « (crime) ») ; `separerClassificationTitreCodex_()` en fait la classification et l'ôte du titre. Aucun des quatre ne chiffre ses peines.

Ne pas considérer les fichiers `.js` Apps Script comme des modules ES isolés : ils partagent le namespace global.
