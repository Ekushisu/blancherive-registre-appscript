# État courant — snapshot du 4 septembre 2026

Ce fichier décrit le snapshot reçu et doit être mis à jour après les changements importants.

### « Garde inquisitoriale » remplace « Brigade des Inquisiteurs » (8 octobre 2026)

- Demande du propriétaire : le corps « Inquisition » s'affiche désormais
  **« Garde inquisitoriale »**, adjectif en minuscule selon l'usage français
  des noms d'institution (« Garde républicaine », « Légion impériale »). La
  feuille garde « Inquisition » ; rien n'y est réécrit.
- `ui/src/corps.js` et `ORGANIGRAMME_GARNISONS` portent le nouveau nom ;
  l'ancien quitte les libellés reconnus de l'Organigramme. Paye : le jeton
  `inquisiteur` devient `inquisitorial`, pour que le nom affiché, s'il était un
  jour écrit dans la feuille, reste rattaché à l'argentier. Aucun libellé de la
  feuille ne portait l'ancien nom affiché : la liste `Données!G` valide la
  colonne Corps.
- Vérifications : suites adaptées, 25 vertes ; `npm run build` ; aperçus
  Organigramme, Effectifs, Présences et Paye régénérés. Aucun push ni
  déploiement.

### Grades de l'Inquisition affichés sous leur alias (8 octobre 2026)

- Le propriétaire a ajouté à `Données` une colonne « Alias Inquisition » (C) :
  Capitaine → Grand Inquisiteur, Lieutenant-Chef → La Plume, Sergent-Chef →
  Enquêteur, Caporal-Chef → Traqueur, Garde → Inquisiteur. Décision : un
  membre de l'Inquisition voit son grade sous l'alias, ou sous le grade
  régulier s'il n'y en a pas ; les données gardent le grade régulier, dont
  l'alias est l'équivalent.
- **Serveur** : nouveau `src/AliasGrades.js`. `lireAliasGrades_` repère les
  colonnes par leur en-tête « Alias <corps> », pas par leur position, et
  renvoie `{ Inquisition: { Capitaine: "Grand Inquisiteur", … } }` ; la table
  accompagne `getEffectifs`, `getOrganigramme`, `getPresences`,
  `getPresenceOfficerDashboard` et `getPaye` (deux lectures de `Données` de
  plus par appel). `gradeAffiche_` nomme les collecteurs des Amendes
  (« Inquisiteur Ragnhild Fer-Juste »), `Données` n'étant lue que s'il existe
  un collecteur actif. Aucune écriture, aucune colonne déplacée.
- **Interface** : `libelleGrade` (`ui/src/corps.js`) dans les titres de grade
  et les listes de grade des formulaires d'Effectifs (alias selon le corps
  choisi, valeur envoyée inchangée), la recherche d'Effectifs, l'Organigramme
  (« Grand Inquisiteur » de la Garde inquisitoriale, même vacant ; groupes de grade et
  Réserve), les Présences, les gardes à surveiller, la Paye et son
  récapitulatif, le panneau des changements. Les descriptions de grade (ⓘ)
  restent celles du grade régulier.
- **Vérifications** : `scripts/test-alias-grades.mjs` (nouveau : lecture de
  `Données`, cas limites, parité serveur / navigateur, collecteurs) ;
  `test-organigramme`, `test-paye`, `test-presence-finances`,
  `test-changes-ui` étendus, `test-presences-lundi` adapté ; 25 suites vertes ;
  `npm run build` ; rendu contrôlé dans Edge sur les données d'aperçu
  (Organigramme, Effectifs et ses formulaires, Présences, Paye et
  récapitulatif copié, panneau des changements), sans erreur JavaScript ;
  aperçus Organigramme, Effectifs, Présences et Paye régénérés. Aucun push ni
  déploiement.

**Mise en service** : relire le `git diff`, `npm run push` (le nouveau fichier
`AliasGrades.js` part avec les autres), publier le déploiement à la main.
L'en-tête « Alias Inquisition » de `Données!C1` doit rester tel quel : sans
lui, l'application affiche les grades réguliers.

### Décret d'application pluriel de Blancherive (8 octobre 2026)

- Nouveau texte au Codex, fourni par le propriétaire :
  `1NKKFL-TfTDhhDj8vRsJtJm4-9V9kBoYCCHTqHiv66XY`, décret du Jarl pris pour
  l'application du Code du commerce local. Il fixe les redevances, les taxes sur
  le chiffre d'affaires, les catégories et les quantités autorisées pour les
  concessions permanentes, les étals et les commerces itinérants. Il contient
  16 articles plus un article 5-1. Ce n'est pas un doublon : il complète le Code
  du commerce sans le remplacer.
- Registre : famille « Droit de Blancherive », autorité « Jarl de
  Blancherive », `local` et `garde` (un garde peut délivrer l'autorisation de
  commerce itinérant, art. 9), sigle dérivé `Décr. APB`, citable.
  `sanctions: false` : le décret ne fixe aucune peine et renvoie aux codes. Ses
  septims sont des redevances, que l'analyseur lit comme des montants
  d'amende.
- Limite connue de l'analyseur, déjà visible sur le décret sur le régime
  fiscal (art. 8 et 11) : les articles 7 et 10 affichent au Codex une pastille
  « 75 septims » et « 50 septims ». Ces montants ne sont pas proposés comme
  amende dans les chefs d'accusation.
- Partage identique à celui des codes de Blancherive : l'export texte répond
  401. Copie locale `docs/codex/decret-application-pluriel-blancherive.txt`
  reconstituée depuis la page de lecture.
- Vérifications : `test-sync-codex.mjs` adapté (droit local), 24 suites vertes.
  Aucun push ni déploiement.

**Après publication, relancer `synchroniserCodex()`** pour que le décret
apparaisse au Codex.

### Brigade des Inquisiteurs ; Faubourgs payés par l'argentier (7 octobre 2026)

- Décision du propriétaire : nouveau corps, inscrit **« Inquisition »** dans la
  liste des corps de `Données` (G10) et affiché **« Brigade des Inquisiteurs »**
  dans l'application *(« Garde inquisitoriale » depuis le 8 octobre 2026, voir
  plus haut)*. Il répond directement à l'État-Major, comme la Cité, les
  Faubourgs, Cap Granite et les Éclaireurs, sous un Capitaine. Payé par
  l'argentier de la cour ; reversement des amendes selon la règle commune (ses
  collecteurs, puis ceux de l'État-Major).
- Même jour : la **garnison des Faubourgs** est désormais payée par l'argentier
  de la cour, et non plus par un Thane. Son reversement des amendes ne change
  pas.
- **Organigramme** : garnison `inquisition` ajoutée à `ORGANIGRAMME_GARNISONS`.
  Un corps absent de cette liste ne figure nulle part dans l'organigramme,
  ses membres actifs compris : tout nouveau corps doit y être déclaré.
- **Paye** : jetons `faubourg`, `inquisition`, `inquisiteur` rattachés à
  l'argentier ; le financeur « Thane des Faubourgs » disparaît. La coupure
  centrale / locale de la Paye ne coïncide plus avec celle du reversement des
  amendes.
- **Nom affiché** : `ui/src/corps.js` (`libelleCorps`) remplace « Inquisition »
  par « Brigade des Inquisiteurs » à l'affichage — onglets, groupes, fiches et
  listes d'Effectifs, organigramme, sections et filtre des Présences, Paye et
  son récapitulatif, panneau des changements. Les valeurs écrites et envoyées
  au serveur restent celles de la feuille. Les recherches trouvent les deux
  noms.
- **Grille de l'organigramme** : sept colonnes à partir de 1401 px (deux pour
  le commandement commun, cinq corps directs), marges intérieures resserrées
  et titres de corps à 16 px ; en dessous, disposition en arbre sur deux
  colonnes, désormais jusqu'à 1400 px au lieu de 1250. Contrôlé sans
  débordement de 1300 à 1920 px avec dix grades par corps.
- Vérifications : `test-organigramme.mjs` et `test-paye.mjs` étendus ; 24
  suites vertes ; `npm run build` ; aperçus Organigramme, Effectifs, Présences
  et Paye régénérés. Aucun push ni déploiement.

« Inquisition » est inscrit en `Données!G10`, dans la plage qui valide la
colonne Corps d'`Effectifs` (confirmé par le propriétaire).

**Mise en service, dans l'ordre** : relire le `git diff` ; `npm run push` ;
publier le déploiement à la main ; seulement ensuite, affecter des membres au
corps.

### Décrets de peines et amendes (4 octobre 2026)

- Demande du propriétaire, sur l'avis du magistrat de Blancherive : les quatre
  codes ne chiffrant aucune peine, se référer aux fourchettes impériales pour
  fixer, article par article, une amende et une durée de cachot, en plusieurs
  niveaux s'il le faut, noblesse comprise ; les présenter dans les formulaires
  et dans une nouvelle page « Décrets de peines et amendes ».
- **Feuille `PeinesAmendes`** (DATA_MODEL), créée et initialisée par
  l'application à la première consultation : 163 niveaux pour 118 articles —
  toutes les infractions qualifiées du Code pénal local, quatre articles du
  Code du commerce local, les art. 1 à 17 du Corpus Juriscivilis, l'art. 4 du
  De Re Nobilitatis et du décret Orsimer, et cinq renvois (Codex Penitus,
  Justicia Militaris, Decretum de Restitutione, décrets dwemer et armes
  éthérées). Échelons, cumul, récidive et noblesse : BUSINESS_RULES. Le
  barème propose et n'impose rien ; il se corrige dans Sheets.
- **Serveur** : `src/PeinesAmendes.js`, `getPeinesAmendes(token,
  versionConnue)` (GARDE, OFFICIER, INTENDANT), versionné comme le Codex ; lignes
  illisibles écartées et signalées, lignes hors fourchette gardées avec un
  avertissement. `Amendes.js` et `Prison.js` inchangés.
- **Correctif d'extraction** (`SyncCodex.js`) : la qualification entre
  crochets des titres du Corpus Juriscivilis (« [Contravention] ») restait dans
  le titre, et le corps décidait à sa place — l'usurpation d'identité passait
  pour un délit, le vol pour un crime, les violences sans qualification. Elle
  devient la classification, comme « (délit) » pour les codes de Blancherive.
  Les titres impériaux perdent leur crochet à la prochaine synchronisation ;
  les entrées déjà enregistrées gardent leur instantané.
- **INTENDANT** : décision du propriétaire, même jour — l'intendance consulte
  aussi le Codex et les décrets de peines, en lecture. `getCodex` et
  `getPeinesAmendes` acceptent son rôle ; sa navigation passe de trois à cinq
  pages ; la route du Codex désigne désormais ses rôles au lieu d'exclure
  l'INTENDANT. Toujours aucune écriture, ni Présences, Amendes, Prison ou
  Effectifs.
- **Délits resserrés** : décision du propriétaire, même jour, le barème étant
  jugé sévère — les échelons de délit passent de 750 / 1 250 / 1 750 / 2 250 à
  500 / 750 / 1 000 / 1 250 septims, cachots inchangés (30 min pour D3, 1 h
  pour D4), rachat nobiliaire recalculé (1 500 et 2 250). Crimes et
  contraventions inchangés. Le changement porte sur le barème initial : une
  feuille `PeinesAmendes` déjà créée garde ses valeurs ; vidée entièrement,
  elle est réinitialisée avec la nouvelle grille à la consultation suivante.
- **Interface** : page « Peines et amendes » (navigation GARDE, OFFICIER et INTENDANT,
  libellé « Peines » sur mobile) — fourchettes cliquables, mode d'emploi
  replié (échelons tels que la feuille les applique, règles, noblesse),
  recherche, filtres, tableau par source devenant des fiches sur téléphone,
  contrôle de la feuille pour l'officier. Barème dans la popup d'article
  (déplacée dans `ui/src/article.jsx`), résumé sur les cartes du Codex, bloc
  « Barème des peines » dans les formulaires Amendes et Prison : niveau par
  chef, récidive, noble, cumul ou qualification la plus rigoureuse,
  pré-remplissage sans jamais écraser une saisie, fait isolé sur sept jours
  pour un noble avec les entrées récentes du registre. Le résumé de
  qualification par article des chefs n'est plus affiché quand le barème est
  chargé : il contredisait le niveau retenu.
- **Vérifications** : `node scripts/test-peines.mjs` (rôles, feuille,
  contrôles ; chaque article du barème existe dans les copies locales des
  textes, chaque infraction qualifiée a son barème, chaque montant tient dans
  sa fourchette) et `test-peines-ui.mjs`, nouveaux ; `scripts/codex-local.mjs`
  reconstitue le Codex des copies locales avec l'extraction réelle ;
  `test-sync-codex`, `test-chefs-ui` et `test-saisies-ui` adaptés. Les 24
  suites sont vertes, `npm run build` passe. Tous les aperçus régénérés (la
  navigation a une entrée de plus) ; nouveaux : `peines`, `peines-principes`,
  `peines-article`, `amendes-bareme`. Le harnais remet la page en haut avant
  chaque capture : les éléments fixes y étaient peints décalés après une
  saisie. Aucun push, aucun déploiement, aucune synchronisation du Codex.

**Mise en service, dans l'ordre** : relire le `git diff`, `npm run push`,
publier le déploiement à la main ; ouvrir une fois la page « Peines et
amendes » (ou un formulaire) pour créer la feuille ; relancer
`synchroniserCodex()` pour le correctif des qualifications impériales ;
soumettre au magistrat les points laissés à son appréciation (BUSINESS_RULES,
« Décrets de peines et amendes »).

### Chefs d'accusation, sentence libre et modification des entrées (29 septembre 2026)

- Constat du propriétaire : les quatre codes de Blancherive ne chiffrent
  aucune peine, le filtre par sanction chiffrée des formulaires Amendes et
  Prison ne proposait donc plus rien. Refonte complète des deux formulaires.
- **Chefs d'accusation.** Une entrée porte un ou plusieurs chefs (vingt au
  plus) : articles de n'importe quel document du Codex, droit impérial et
  décrets compris, et références libres, mêlés. Décision du propriétaire :
  tout est citable sauf les documents marqués `citable: false` dans
  `SYNC_CODEX_DOCUMENTS` (documentation de contexte). Aucun document du
  registre ne porte ce flag aujourd'hui : la Constitution cléricale et le
  Registre de la chevalerie n'y sont pas inscrits ; s'ils le sont un jour,
  c'est avec ce flag.
- **Stockage.** Colonne texte lisible inchangée (Amendes!D, Prison!E,
  `CPL art. 16 — Injure ; …`) et JSON dans une nouvelle colonne technique,
  Amendes!H et Prison!L, créée par l'application avec son en-tête si elle
  manque. Titre, qualification et sigle figés à l'enregistrement. Lignes
  antérieures inchangées, résolues à l'ancienne. **À vérifier dans le
  classeur avant publication : que Amendes!H et Prison!L soient vides.**
- **Sentence.** Montant et durée libres ; « À déterminer » possible pour les
  deux (décision du propriétaire) ; barème impérial rappelé à titre indicatif
  depuis la qualification la plus grave ; valeurs citées par un article
  proposées en raccourcis.
- **Modification** d'une amende ou d'une incarcération par les OFFICIER
  (`modifierAmende`, `modifierPrison`), avec identité de ligne (`attendu`)
  refusée si la ligne a changé. Payé, Reversé et Libéré restent hors de ce
  chemin. Le rôle OFFICIER est une hypothèse alignée sur la suppression, à
  élargir si le propriétaire le souhaite.
- **Cache local du Codex** (`ui/src/codex.js`, `getCodex(token,
  versionConnue)` avec empreinte MD5 de A:J et R:Y) : les 470 articles ne sont
  renvoyés que si la version a changé ; Codex, Amendes et Prison partagent la
  même copie. Recherche en mémoire : numéro, sigle (`cpl 16`), titre, texte ;
  filtres corpus et qualification ; douze suggestions.
- **Interface** (`ui/src/chefs.jsx`) : champ à jetons, chefs fréquents du
  registre en raccourcis, lecture de tout article en popup sans le retenir,
  popup avec « Retenir ce chef », article précédent/suivant et renvois
  cliquables (« article 76 »), sélecteur « Parcourir le Codex » (la page
  Codex en modale, mode sélection), brouillon `sessionStorage` du formulaire
  de création, bouton Modifier dans les registres, jetons dans la colonne
  Infraction.
- **Registre des sources** : champ `abrege` sur les neuf codes (LF, CPL, CCL,
  CCoL, CJI, DRN, CProc, JM, CPen), dérivé du nom pour les décrets
  (`Décr. RFB`) ; cache `SyncCodex!R:W` étendu à `R:Y` (Abrégé, Citable).
  Les anciennes listes `L:O` sont encore écrites mais plus lues.
- Retirés : `ui/src/sanctions.jsx`, `findCodexArticle` d'`Index.html` (devenu
  `resoudreLibelleHistorique` dans `codex.js`), les helpers
  `lireChoixSanction_` / `validerChoixSanction_` / `valeurUniqueSanction_` /
  `preparerMotifSanction_` d'`Amendes.js`. `getAmendeFormData` et
  `getPrisonFormData` ne renvoient plus que les gardes.
- Vérifié par `node scripts/test-chefs.mjs` (serveur), `test-codex-local.mjs`
  et `test-chefs-ui.mjs` (navigateur), suites existantes adaptées
  (`test-sanctions.mjs` réduit à l'analyse des sanctions, `test-prison-objets`,
  `test-saisies-ui`), toutes vertes. Aperçus Amendes, Prison et Codex
  régénérés. Aucun push, aucun déploiement, aucune synchronisation du Codex.

**Après publication** : relancer `synchroniserCodex()` pour écrire les
colonnes X:Y du cache (sinon sigles dérivés du nom et tout citable, ce qui est
le défaut voulu), puis recharger le registre. Retirer à la main, dans Sheets,
la validation de données des colonnes Amendes!D et Prison!E si elle gêne :
l'application la retire déjà cellule par cellule à chaque écriture.

### Régénération sur grade, corps ou statut ; lignes des sortants conservées (28 septembre 2026)

- Décision du propriétaire. `modifierEffectif` régénère la semaine courante
  dès que le grade, le corps ou le statut change (avant : le statut seul), en
  plus de `ajouterEffectif` et du déclencheur du lundi.
- Un membre sorti du service actif en cours de semaine garde sa ligne de la
  semaine courante si elle porte un jour pointé ou un paiement ; les doublons
  éventuels sont fusionnés, grade et corps de la ligne conservés, formule de
  solde réappliquée. Sans pointage ni paiement, la ligne disparaît. Avant, la
  ligne disparaissait dans tous les cas, pointages compris.
- Vérifié par `scripts/test-presences-lundi.mjs` (cas « Parti » conservé,
  « Fantome » retiré) et toutes les suites. Aucun push ni déploiement.

### Dates affichées en calendrier tamrielien (28 septembre 2026)

- Demande du propriétaire : toutes les dates de l'interface en calendrier de
  Tamriel, la date réelle en info-bulle. `ui/src/calendrier.js` fait la
  conversion (jour pour jour, année réelle − 1 800 → « 4E 226 »), avec les
  noms de la version française vérifiés sur le wiki The Elder Scrolls et la
  Grande Bibliothèque de Tamriel ; le composant `DateRP` (`calendrier.jsx`)
  rend « Loredas 26 Âtrefeu 4E 226 » souligné en pointillé, l'attribut
  `title` portant « Calendrier réel : 26/09/2026 ».
- Branché sur : dates des Amendes ; date, entrée et sortie prévue de la
  Prison ; lundis des semaines de Présences (en-têtes, filtre, synthèse) et de
  la Paye ; dernière présence du tableau de bord ; dates du panneau des
  changements d'effectifs. Le récapitulatif texte de la Paye, copié sans
  survol possible, écrit les deux dates. Les champs de saisie des formulaires
  restent en calendrier réel (`<input type="date">`).
- Rien ne change côté serveur ni dans les feuilles ; une valeur que le
  module ne reconnaît pas est affichée telle quelle. Vérifié par
  `node scripts/test-calendrier.mjs` (nouveau) et les autres suites ;
  `npm run build`. Aucun push ni déploiement.

### Présences : lundi ISO en colonne A, identité de ligne au pointage (28 septembre 2026)

- **Incident signalé par le propriétaire.** À l'ajout d'un membre dans
  Effectifs, la feuille Présences était réécrite, des lignes affichaient une
  date de 1900 en colonne A et des pointages disparaissaient, même après
  suppression des déclencheurs horaires. Cause : `ajouterEffectif` et
  `modifierEffectif` (changement de statut) appellent directement
  `genererPresencesSemaineCourante()`, qui relit `Présences!A:O`, efface
  le bloc et le réécrit trié. Une cellule A passée au format date revenait de
  `getValues()` en objet `Date` (39 → 7 février 1900) : la ligne n'était
  plus reconnue comme semaine courante, un doublon à blanc était créé, et la
  `Date` réécrite posait le format date ailleurs à chaque tri.
- **Nouveau modèle.** `Présences!A` porte désormais le lundi de la semaine
  ISO, en texte `yyyy-MM-dd` (Europe/Stockholm), colonne au format texte
  brut, en-tête « Lundi ». Le texte ne dépend ni du format de cellule ni du
  fuseau du classeur, et porte l'année : la semaine 52 de 2025 ne passe plus
  pour une semaine à venir en janvier 2026. Le serveur raisonne en lundis
  (`lundiCourantPresence_`, `normaliserLundiPresence_`,
  `comparerLundisPresence_`, `ecartSemainesPresence_` dans Presences.js) ;
  le numéro de semaine n'est qu'un libellé calculé par l'interface
  (`ui/src/semaine.js`). Les API renvoient `lundiCourant` et `lundi` à la
  place de `currentWeek` et `semaine` ; la Paye renvoie ses `semaines` en
  lundis. `getCurrentIsoWeekWebApp()` subsiste, dérivée du lundi courant.
- **Compatibilité et conversion.** Toute lecture de la colonne A passe par
  `normaliserLundiPresence_` : numéro de semaine, cellule au format date
  (y compris les dates de 1900 de l'incident), numéro de série, texte ISO ou
  autre jour de la semaine sont ramenés au lundi ISO ; un ancien numéro
  supérieur à la semaine courante est daté de l'année précédente ; un texte
  non reconnu est conservé tel quel, trié en tête, jamais perdu. La feuille se
  convertit donc d'elle-même à la première régénération ; les doublons d'un
  garde pour la semaine courante sont fusionnés (case cochée dans l'un ou
  l'autre) au lieu d'être perdus.
- **Pointage sous identité.** `ecrirePresenceCellule_` exige désormais
  `identite = { lundi, prenom, nom }` de la ligne affichée, prend le verrou
  de document (le même que la régénération) et refuse l'écriture si la ligne
  ne correspond plus (« La liste des présences a changé… »). `modifierPresence`
  et `reglerSemainePaye` reçoivent ce cinquième / quatrième argument ; les
  pages Présences et Paye l'envoient (`identitePresence` dans `app.jsx`).
  Sans cela, un tri des Présences faisait cocher un autre garde depuis une
  page restée ouverte.
- **Fonctions historiques retirées de Code.js** : `ajouterSemainePresence`,
  `regenererSemaineCourante`, `reparerFormulesPresence`,
  `reconstruireSeparateursPresence`, `writePresenceWeek`, les déplacements de
  blocs, `installerTriggerPresenceHebdomadaire` / `supprimer…` et
  `miseAJourComplete`. Elles raisonnaient en numéros de semaine et doublaient
  le seul chemin de génération. `synchroniserMiseEnForme` est retirée aussi :
  les sept feuilles de corps qu'elle mettait en forme (vues `QUERY` d'Effectifs,
  triées par une colonne « Grade Order » supprimée depuis) sont supprimées du
  classeur par le propriétaire, l'Organigramme de l'application les remplace.
  Aucune formule ni aucun code ne les référençait.
- **Mise en service, dans l'ordre.** 1. `npm run push`. 2. Dans l'éditeur
  Apps Script, `inventorierReferencesSemainePresences()` : liste les formules
  du classeur mentionnant Présences et signale celles qui lisent la colonne A
  par numéro de semaine (`Vue globale` ou autres) ; les adapter d'abord.
  3. `migrerPresencesVersLundis()` : colonne A seule, valeurs et format, sous
  verrous ; elle rappelle dans le journal les formules lisant A, sans bloquer,
  car une formule adaptée lit légitimement la colonne. 4. Publier le
  déploiement à la main aussitôt : l'ancienne version déployée écrirait encore
  des numéros de semaine, que le nouveau code sait relire mais qui
  brouilleraient la feuille entre-temps. Les pointages déjà remis à blanc par
  une régénération passée ne sont pas reconstituables par le code (historique
  des versions du classeur). Les doublons de semaines passées sont conservés
  et se nettoient à la main.
- L'inventaire lancé par le propriétaire a trouvé une formule concernée :
  `Vue globale!N5`, liste des gardes absents depuis plus de cinq jours ou
  jamais présents, qui reconstruisait les dates par « lundi de la semaine 1
  de l'année en cours + (semaine − 1) × 7 ». Version adaptée fournie le
  28 septembre, puis décision du propriétaire : `Vue globale` date d'avant
  l'application, qui refait tous ses calculs (coûts, impayés, gardes à
  surveiller, paye). La feuille est archivée, la formule N5 n'est pas
  reposée. Le code ne lisait plus que `Vue globale!L2`, et seulement à
  l'initialisation de `SoldesGrades` ou pour figer une formule historique de
  `Présences!N` : les deux conditions sont remplies, le classeur n'a plus
  aucune formule référençant cette feuille. Rien ne la cherche plus.
- **Mise en forme portée par la génération.** Les couleurs (orange semaine
  courante, rouge impayé dû, gris semaine passée) et les séparateurs de semaine
  étaient posés à la main sur une plage fixe et par l'ancienne fonction de
  séparateurs : chaque ligne ajoutée en sortait, et les règles manuelles
  comparaient A à un numéro de semaine. `appliquerCouleursPresences_` remplace
  les règles conditionnelles de la feuille sur `A2:O` jusqu'à la dernière
  ligne physique, fond de A:O remis à blanc avant la pose (les anciens
  remplissages directs masquaient le résultat) ; `tracerSeparateursPresences_`
  efface puis redessine les traits. Le propriétaire a retiré ses règles
  manuelles : elles seraient écrasées de toute façon.
- **Les formules des règles ne contiennent aucun séparateur d'arguments.**
  Contrairement aux formules de cellules, celles des règles conditionnelles
  posées par `whenFormulaSatisfied` sont stockées telles quelles, sans
  traduction dans la locale du classeur : avec des virgules, un classeur à
  point-virgule les tient pour invalides et la règle n'est jamais vraie. C'est
  ce qui a fait échouer trois variantes successives (`TEXT(TODAY()…)`,
  `DATE(LEFT;MID;RIGHT)`, `AND($A2<>""…)`) alors que la même formule saisie à
  la main avec `;` fonctionnait, et que la seule règle sans séparateur,
  `=$A2="2026-09-28"`, a toujours marché. Les règles sont donc écrites en
  produits de booléens et fonctions à un argument :
  `=NOT(NOT((LEN($A2)=10)*($A2<"2026-09-28")*($N2>0)*NOT($O2)))`.
- **Le lundi courant est inscrit en dur dans les règles**, en texte ISO, par
  la génération ; la feuille ne compare que des textes. Conséquence : les couleurs
  changent de semaine quand la génération tourne, d'où l'importance du
  déclencheur du lundi ; entre minuit et son passage, la semaine écoulée
  reste affichée comme courante.
- Vérifié par `node scripts/test-presences-lundi.mjs` (nouveau) et toutes les
  suites `scripts/test-*.mjs` ; `npm run build`. Les aperçus de
  `docs/apercus` n'ont pas été recapturés. Aucun push ni déploiement.

### Quatre codes de Blancherive, Codex Judiciaire caduc (27 septembre 2026)

- Le droit de la châtellerie est désormais porté par quatre codes adoptés par
  la Cour de Blancherive et fournis par le propriétaire : Loi fondamentale
  (`1AMAMjFDZ8…`), Code pénal local (`1QnltaOqty…`), Code civil local
  (`116FByPVeF…`) et Code du commerce local (`1dtSQ_QhP7…`). L'ancien Codex
  Judiciaire (`1_awmZGCcQ…`) est caduc, retiré du registre et conservé en copie
  locale.
- **Listes d'infractions vides jusqu'à décision.** Aucun des quatre codes ne
  chiffre ses peines ; le Code pénal qualifie ses articles (contravention,
  délit, crime) et renvoie au barème impérial. Les formulaires Amendes et
  Prison ne proposent donc plus d'article. Décision provisoire du propriétaire,
  en attendant l'avis du nouveau magistrat : les gardes cochent « Motif
  personnalisé », citent l'article du Code pénal et saisissent eux-mêmes le
  montant ou la durée. Reste à trancher avec le magistrat : chiffrer les peines
  dans les textes, ou fixer dans l'application un barème par qualification.
- Extraction : sauts de ligne doux découpés en lignes ; qualification du titre
  (« (délit) ») convertie en classification et ôtée du titre ; « infraction
  délictuelle / criminelle / contraventionnelle » reconnue dans le texte.
- Les quatre documents sont partagés sans téléchargement pour les lecteurs
  (export HTTP 401, page de lecture accessible). À vérifier à la première
  synchronisation : si `DocumentApp.openById()` échoue, faire autoriser le
  téléchargement pour les lecteurs.
- Vérifié par `node scripts/test-sync-codex.mjs` et les suites sanctions,
  accès public et prison. Aucun push ni déploiement.

**Après publication, relancer `synchroniserCodex()`** : jusque-là, le cache
`SyncCodex` et les formulaires continuent d'afficher l'ancien Codex Judiciaire.

### Inventaire des coffres et décrets impériaux (22 septembre 2026)

- Nouvelle page **Inventaire** : ce que contiennent les coffres de la garde à
  Fort-Dragon. OFFICIER consulte et écrit ; INTENDANT consulte seulement ; GARDE
  ne voit pas la page, ni en lecture ni en écriture. La navigation, le routage
  de `App` et chaque fonction serveur portent la restriction.
- Deux feuilles créées à la première consultation, avec leurs en-têtes :
  `Coffres` (ID coffre, Nom, Position, Description) et `Inventaire` (ID coffre,
  ID objet, Nom, Quantité). Une feuille existante n'est jamais réécrite ; des
  en-têtes différents arrêtent la page.
- Un objet n'apparaît qu'une fois par coffre. `ajusterInventaire` cumule ou
  retire ; à zéro la ligne disparaît ; on ne descend jamais sous zéro. Le bloc
  `Inventaire!A:D` est relu et réécrit en entier sous verrou de script, valeurs
  restaurées en cas d'échec d'écriture.
- Les objets viennent du catalogue `Objets` par la même recherche que les
  saisies de la Prison ; `SaisiesField` reçoit trois props facultatives
  (`titre`, `masquerListe`, `aideLibre`) et reste inchangé pour la Prison.
  Le nom est figé à l'entrée en stock ; un objet déjà en stock réutilise son
  instantané sans relire le catalogue.
- Les coffres se créent et se modifient depuis la page (nom unique, position
  dans le monde, description). Un objet se déplace d'un coffre à l'autre par la
  liste déroulante de sa ligne, la pile entière, avec fusion à destination. Les
  lignes dont le coffre a disparu de la feuille restent visibles sous « Coffre
  inconnu » et peuvent être rattachées à un coffre réel.
- **Cache local du catalogue des objets.** Les pages Prison et Inventaire
  (officier) préchargent le catalogue complet à l'ouverture par
  `getCatalogueObjets` — 10 131 fiches, 654 Ko en tableau compact — et le
  gardent dans `localStorage` (`blancherive.catalogue-objets.v1`) avec une
  empreinte de version ; le serveur ne renvoie les fiches que si elle a changé.
  L'autocomplétion de `SaisiesField` cherche en mémoire dès que le catalogue est
  disponible (`ui/src/catalogue.js`), sinon au serveur comme avant. La recherche
  locale reproduit `rechercherObjets` ; `scripts/test-catalogue-local.mjs`
  compare les deux sur dix-huit requêtes.
- **Rangement groupé.** Le formulaire « Ranger un objet » devient une liste
  d'attente : les objets s'ajoutent hors ligne, avec fusion des doublons et
  plafond de cent, puis « Ranger » envoie la liste entière par
  `rangerInventaire` en une requête et une écriture. `ajusterInventaire` et
  `rangerInventaire` partagent `appliquerAjustementsInventaire_`.
- **Boutons + / − cumulés.** Les clics d'une ligne d'inventaire sont cumulés et
  envoyés en une requête après 600 ms sans clic (`SEUIL_AJUSTEMENT_MS`). La
  quantité visée s'affiche tout de suite, grisée jusqu'à confirmation ; une
  ligne en attente ne peut être ni déplacée ni retirée.
- Codex : le décret sur les équipements dwemers pointe désormais sur sa
  réécriture « Régulation des équipements stratégiques Dwemer »
  (`1g9mqqedq0iUnzTN7CedVPvyNXLS4L2SiC_fvhbZQstQ`), fournie par le
  propriétaire comme lien à jour ; l'ancien texte du Gouverneur
  (`17Y36stT6…`) quitte le registre et reste en copie locale. Nouveau décret
  « Régulation des recherches archéologiques, artefacts et archives »
  (`1Fh_wqNvwbcpyYGCWYwq6hBOw8jdc8mKLBtkYszPnUno`). Le décret Orsimer fourni en
  même temps était déjà référencé sous le même identifiant : rien à changer.
  Aucun de ces textes ne porte de sanction chiffrée ; les formulaires Amendes et
  Prison ne bougent pas. `synchroniserCodex()` reste à lancer pour que le cache
  `SyncCodex` reflète les nouveaux textes.
- Vérifications locales : `node scripts/test-inventaire.mjs` et
  `node scripts/test-catalogue-local.mjs` (nouveaux), `test-saisies-ui`, `test-acces-public`, `test-prison-objets`,
  `test-sync-codex` et les autres suites ; `npm run build` ; aperçus
  `inventaire-1440`, `inventaire-390`, `inventaire-intendant-1440`. Aucun push
  ni déploiement.

### Présences : filtre par corps, synthèse repliable, semaine courante hors impayés (17 septembre 2026)

- La liste hebdomadaire des Présences était devenue très longue à parcourir. Un
  filtre **Corps** a été ajouté dans la barre de filtres, entre le filtre de
  semaine et la recherche par personne, pour que l'officier de corps ne pointe
  que ses hommes : les autres corps sont masqués dans chaque semaine affichée,
  les semaines sans ligne du corps retenu disparaissent, et les accordéons
  s'ouvrent comme lors d'une recherche.
- Les lignes sans corps sont regroupées sous « Sans corps » dans la liste
  déroulante comme dans les sections de semaine, par `corpsPresence`.
- Le compte d'impayés d'une semaine suit le filtre par corps — le badge parle du
  corps demandé — et reste indépendant de la recherche par personne.
- La semaine courante n'affiche plus ni badge d'impayés ni bouton « Impayés » :
  la paye se fait le lundi pour la semaine précédente, donc une semaine en cours
  est impayée par construction. Le tableau de bord OFFICIER et la page Paye
  excluaient déjà la semaine courante ; le registre s'aligne sur elles.
- Le compte vit dans `compteImpayesSemaine(rows, {current, matchesCorps})`,
  exporté depuis `ui/src/app.jsx` et couvert par
  `scripts/test-presences-impayes.mjs`.
- La partie OFFICIER — tuiles financières et « Gardes à surveiller » — est
  regroupée dans un panneau « Synthèse de la garde » replié par défaut, pour la
  même raison : sur téléphone, elle occupait tout le premier écran avant la
  première case à cocher (page de 6 586 à 4 946 px de haut à 390 px de large).
  Un panneau plutôt qu'un onglet, afin que l'en-tête garde « ⚠ N à surveiller »
  sous les yeux — c'est la seule alerte d'inactivité de l'application. Le pli est
  mémorisé sous `blancherive.presences.synthese.v1` ; toute autre valeur que
  `"1"`, mémoire locale refusée comprise, laisse le panneau replié. La synthèse
  se charge même repliée, l'en-tête devant annoncer le compte.
- Aperçu `presences-synthese-1440` : le panneau déroulé, pour que la
  documentation montre encore les tuiles et les gardes à surveiller.
- Vérifications : `node scripts/test-presences-impayes.mjs`, les suites
  Présences / Paye / UI existantes, `npm run build` et les aperçus Présences.
  Aucun push ni déploiement.

### Page Paye et rôle INTENDANT (17 septembre 2026)

- Les impayés étaient jusqu'ici réduits à deux nombres du tableau de bord
  (« 3 » et un montant), sans moyen de savoir qui ni de quelle semaine : l'état
  « Payé » vivait dans la dernière colonne d'un tableau, imbriqué dans un corps,
  lui-même dans un accordéon de semaine. La page **Paye** rassemble cela en une
  demande de budget par financeur, montant d'abord et justification ensuite.
- Financeurs déduits du corps, sans nom de personnage à tenir à jour : argentier
  de la cour pour Cité de Blancherive, Éclaireurs et État-Major ; un Thane pour
  chacune des quatre garnisons. Même coupure centrale / locale que le reversement
  des amendes.
- Le rattachement cherche un jeton distinctif dans le libellé du corps, donc
  « Garnison de Rivebois » fonctionne comme « Rivebois ». Le jeton « blancherive »
  seul n'est jamais employé : la Cité et les Faubourgs le portent tous les deux.
- Un corps inconnu tombe dans « Financeur à déterminer », affiché en tête et compté
  au total général. Une solde due ne disparaît jamais d'une demande de budget.
- Périmètre : semaines closes, solde strictement positive, case Payé décochée. La
  semaine en cours est chiffrée à part, en prévision, et n'entre pas dans le
  montant à demander.
- Règlement une semaine à la fois, avec annulation possible tant que la session
  dure. Un récapitulatif en texte brut peut être copié ; l'API presse-papiers
  pouvant être refusée dans l'iframe Apps Script, un repli affiche le texte en
  clair.
- Nouveau rôle **INTENDANT**, code distribué hors de la garde. Organigramme et
  Paye en lecture seule. `reglerSemainePaye` passe par `ecrirePresenceCellule_`,
  qui exige OFFICIER : un INTENDANT appelant l'API depuis la console est refusé.
- **À faire par le propriétaire avant utilisation** : définir la Script Property
  `PASSWORD_INTENDANT`. Tant qu'elle est absente, aucun code n'ouvre de session
  INTENDANT — c'est le comportement voulu, pas une panne.
- Le déploiement doit inclure `Paye.js`, `Auth.js`, `Presences.js`,
  `Organigramme.js` et le nouvel `Index.html`. Aucune nouvelle feuille, aucune
  nouvelle colonne, aucune synchronisation du Codex nécessaire.
- Limite connue conservée : la colonne Semaine ne porte pas l'année. Après le
  passage à la nouvelle année, les semaines de l'année écoulée cessent d'être
  comptées comme impayées, exactement comme dans le tableau de bord OFFICIER.
- Vérifications locales : `node scripts/test-paye.mjs`, les onze suites
  existantes, `npm run build`, `npm run apercus`. Aucun push ni déploiement
  pendant cette intervention.
### Extraction des articles en listes et onglets (15 septembre 2026)

- `extraireArticlesCodex_()` lisait `getBody().getParagraphs()`, qui ne retourne
  pas les `ListItem`. Tout article rédigé en liste à puces était ignoré sans
  erreur ni article produit. La lecture passe désormais par `getText()`, qui rend
  paragraphes, listes et tableaux, et parcourt les onglets via `getTabs()`
  lorsque l'exécution les expose.
- Mesuré sur les textes réels : les décrets « De Argentaria », « Armes éthérées »
  et « Successions des châtelleries » passent de 0 article à 24, 7 et 5.
  Les codes déjà en service sont inchangés.
- Vérifié par `node scripts/test-sync-codex.mjs`, étendu aux listes, aux onglets
  et aux sous-onglets. Aucun changement du classeur ni des documents.
- Copies locales des textes sous `docs/codex/`, avec la correspondance
  identifiant → document. Les documents Google restent la source de vérité.

### Repérage des soldes impayées par semaine (15 septembre 2026)

- Chaque accordéon de semaine porte un badge « N impayés » dans son en-tête. Il
  reste lisible accordéon replié, ce qui est l'intérêt : repérer une semaine
  ancienne encore en souffrance sans l'ouvrir. *(Depuis le 17 septembre 2026, la
  semaine courante en est exclue — voir la section du 17 septembre.)*
- Un bouton « Impayés » filtre la semaine sur les seules soldes dues et non
  réglées, et ouvre l'accordéon. Il n'apparaît pas quand la semaine n'a aucun
  impayé, et se retire tout seul si le dernier impayé est réglé.
- Le filtre se combine avec la recherche par personne. Le compte du badge porte
  en revanche sur toute la semaine, indépendamment de la recherche : il répond à
  « cette semaine a-t-elle des impayés ? ».
- Définition retenue : solde strictement positive et non réglée. Une solde nulle
  — Recrue, ou semaine sans présence — n'est pas un impayé. C'est la distinction
  que faisaient déjà les couleurs de lignes.
- Vérifié par `node scripts/test-presences-impayes.mjs` et l'aperçu
  `presences-impayes-1440`.

### Consultation publique du Codex (15 septembre 2026)

- `ouvrirSessionPublique()` délivre un jeton `VISITEUR` sans mot de passe, valable
  deux heures. Bouton « Consulter le Codex » sur l'écran de connexion.
- Le visiteur accède à la page Codex entière — codes, décrets, recherche et
  filtres — et à rien d'autre. Navigation réduite à cet onglet.
- `VISITEUR` ne figure que dans la liste de rôles de `getCodex`.
  `scripts/test-acces-public.mjs` échoue si ce rôle apparaît ailleurs dans `src/`.
  C'est le garde-fou central : la Web App s'exécutant en anonyme avec le compte
  du propriétaire, une liste de rôles trop large ouvrirait tout.
- Vérification après publication : ouvrir le lien en navigation privée, cliquer
  « Consulter le Codex », contrôler que seul l'onglet Codex apparaît.

### Correctifs mobiles et décor de fond (15 septembre 2026)

- Onglets par corps des Effectifs : sous 600 px ils passaient en `nowrap` avec
  défilement horizontal, sans barre visible ni indice, et la coupure tombait au
  bord du gabarit. Ils passent désormais à la ligne ; les six corps sont
  atteignables.
- Tuiles du tableau de bord des Présences : `styles.css` passait bien à une
  colonne sous 620 px, mais la règle `repeat(2, …)` de `theme.css` jusqu'à
  1200 px l'emportait, `theme.css` étant chargé après. Corrigé dans le bloc
  `max-width:600px`. La règle mobile était morte depuis la refonte.
- Bandeau d'en-tête illustré supprimé, à la demande du propriétaire :
  `PageIllustration`, ses styles et l'import de `releve.jpg` ont été retirés.
- Nouveau décor : `pilier-nordique.png` en filigrane derrière le contenu, calé
  sur le bord droit de la barre latérale, fixe au défilement, non cliquable,
  masqué sous 900 px. Opacité 0,3, à réajuster si le texte en souffre.
- Aperçus Effectifs rejouables, avec six corps et quatorze membres : c'est à
  cette densité que les défauts d'affichage apparaissent.
- `src/Index.html` passe de 657 à 757 Ko, les assets étant incorporés en data URL.

### Décrets du Jarl par dossier Drive (15 septembre 2026)

- Le Jarl de Blancherive promulgue ses décrets au fil de l'eau, sous forme de
  posts de forum Discord. Les inscrire un par un dans le registre imposerait une
  modification de code et un push à chaque décret.
- `SYNC_CODEX_FOLDERS` déclare des dossiers Drive dont chaque Google Doc natif
  est lu comme un texte juridique. Le nom du fichier devient le nom de la source.
  Déposer un document suffit ; aucun push n'est nécessaire.
- **Le dossier fait autorité.** Les caches sont réécrits sur toute leur hauteur
  précédente à chaque synchronisation : un décret retiré du dossier disparaît du
  Codex et des listes d'infractions, sans intervention. C'est le mécanisme
  d'abrogation. Les lignes d'Amendes et de Prison déjà enregistrées ne sont pas
  touchées, leurs libellés ne portant pas le nom de la source.
- **Le dossier reste à créer.** L'identifiant est vide dans le registre, et la
  lecture est alors simplement sautée. À renseigner quand le dossier existera.
- Les décrets du Jarl sont marqués `sanctions: true` : leurs articles entrent
  dans les listes d'infractions d'Amendes et Prison, mais uniquement ceux qui
  portent réellement une amende ou une durée de cachot. Un décret purement
  réglementaire reste consultable sans encombrer les formulaires. C'est ce que
  le propriétaire a décrit par « les deux selon le décret ».
- Le droit impérial reste hors des formulaires : la Garde sanctionne sur le
  fondement du droit de la châtellerie.
- La synchronisation inscrit les métadonnées des documents en `SyncCodex!R:W`.
  `Codex.js` les y relit, plutôt que de lister le dossier Drive à chaque
  consultation du Codex. Un document déclaré l'emporte sur un homonyme du
  dossier.
- Limite connue de l'analyse des sanctions : un montant nu tel que
  « 50 septims. » n'est pas reconnu, alors qu'une phrase comme « Sanction —
  50 septims. » l'est. Les décrets du Jarl devront suivre la rédaction du Codex
  Judiciaire pour que leurs sanctions alimentent les formulaires.

### Registre juridique renouvelé et décrets intégrés (15 septembre 2026)

- `SYNC_CODEX_DOCUMENTS` devient le registre unique des documents. `Codex.js`
  n'a plus sa propre table : `getCodexDocumentMetadata_()` dérive familles,
  autorités et liens du registre. Ajouter un texte ne demande qu'une entrée.
- Les cinq codes impériaux pointent sur les versions à jour fournies par le
  propriétaire. Le Codex Penitus passe de 15 à 24 articles ; les autres varient
  peu. Le Codex Judiciaire de Blancherive est inchangé.
- Douze décrets ajoutés sous la famille « Décrets impériaux » : fiscalité,
  imposition, banques, Avocatus, administrateurs, successions, chevalerie,
  ordres militaires religieux, équipements orsimer et dwemers, armes éthérées,
  restitution des biens de l'Empire. (Le décret dwemer a changé d'identifiant et
  un treizième décret, sur les recherches archéologiques, s'est ajouté le
  22 septembre 2026 — voir plus haut.)
- Les listes d'infractions d'Amendes et Prison restent issues du seul Codex
  Judiciaire : le filtre existait déjà dans `ecrireCachesTechniquesCodex_()`.
  Les décrets sont consultables sans encombrer les formulaires.
- Écartés volontairement : le Codex Procédural de Blancherive, abandonné et dont
  le document ne répond plus ; la Constitution cléricale et le Registre de la
  Chevalerie, qui sont de la documentation de contexte ; deux décrets de la
  Chancellerie au format Word, que `DocumentApp.openById()` ne sait pas ouvrir ;
  un décret non partagé. Les identifiants sont commentés dans le registre.
- Mesuré sur les copies locales : 18 documents, 381 articles, aucun document
  muet. `synchroniserCodex()` passe de 7 à 18 ouvertures de document ; la marge
  reste confortable sous la limite de six minutes, mais le temps d'exécution
  n'a pas été mesuré en conditions réelles.
- Vérifié par `node scripts/test-sync-codex.mjs`, étendu au registre et aux
  métadonnées dérivées. Aucune synchronisation lancée sur le classeur.

**Après publication, relancer `synchroniserCodex()`** pour régénérer le cache,
sans quoi l'interface continue d'afficher l'ancien droit.

### Descriptions des grades dans l'Organigramme (15 septembre 2026)

- Chaque grade porte une description de son rôle. Permanente sous les libellés de
  la chaîne de commandement, dépliable par un ⓘ pour les grades de corps.
- Textes dans `ui/src/grades.jsx`, sans dépendance au classeur. Les quinze grades
  en service sont couverts ; un grade absent de la table s'affiche sans
  description et sans erreur.
- Vérifié par `node scripts/test-grades.mjs` et l'aperçu `organigramme-grade-1440`.
- Code local uniquement : aucun push ni mise à jour de déploiement.

### Refonte visuelle inspirée du manuel (13 septembre 2026)

- Papier, sceau au cheval et illustrations du manuel fourni ; palette sépia,
  cuir brun et or patiné, titres à empattements. Assets légers embarqués au build.
- Nouvelle connexion, navigation latérale sur ordinateur et navigation inférieure
  jusqu’à 900 px. Page Effectifs toujours réservée à OFFICIER.
- À 600 px et moins, les tableaux Amendes/Prison deviennent des fiches avec libellés
  de cellules ; mêmes données et contrôles. Présences avec défilement interne et
  première colonne fixe. Formulaires, filtres, modales, Effectifs et Codex adaptés.
- Codex utilisable au clavier ; focus retenu dans la modale, fermeture Échap,
  restauration du focus et défilement de fond bloqué pendant sa consultation.
- `doGet()` définit le viewport via `HtmlOutput.addMetaTag`, nécessaire à Apps Script.
- Aperçus sous `docs/apercus/`, données simulées uniquement. Tests UI sanctions,
  saisies, changements et test Organigramme réussis. Build frontend reconstruit.
- Aucun push ni déploiement effectué. Publier le nouvel Index et Code.js depuis
  le déploiement existant selon la procédure habituelle ; aucune resynchronisation
  du Codex nécessaire pour cette refonte graphique seule.

### Choix de sanctions et motifs personnalisés (9 septembre 2026)

- Codex judiciaire configuré sur `1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk`
  *(caduc depuis le 27 septembre 2026, voir la section du même jour)*.
- Extraction excluant les intertitres numérotés et distinguant les durées de cachot
  des travaux forcés. Choix contextualisés d’amende/cachot dans les caches M/O.
- Formulaires Amendes/Prison : choix chiffrés, saisie libre sur appréciation explicite,
  et motif personnalisé pour décrets/décisions. Validation serveur, sortie calculée,
  anciennes lignes préservées. Composants communs dans `ui/src/sanctions.jsx`.
- Après push et publication de l’interface, relancer `synchroniserCodex()` pour
  régénérer les caches, puis recharger le registre. Aucun push ni changement distant
  effectué pendant cette correction.
- Tests dédiés : `test-sync-codex.mjs`, `test-sanctions.mjs`, `test-sanctions-ui.mjs`.

### Catalogue des objets et saisies Prison (7 septembre 2026)

- Catalogue initial de 10 131 fiches en trois colonnes ID objet, Nom, Type. Feuille
  Objets créée à la première recherche si absente, sous verrou et par écriture en bloc.
  Une feuille existante reste la source de vérité ; aucune réimportation automatique.
- Autocomplétion dès trois caractères, attente de 300 ms, quinze suggestions maximum,
  recherche par nom sans accents ou par ID (avec tolérance aux zéros initiaux).
  Navigation clavier, indication de chargement et d'erreur, réponses obsolètes ignorées.
- Ajouts de plusieurs objets, quantités cumulées par ID, retrait avant enregistrement,
  brouillon non ajouté bloquant la soumission. Champs et fermeture du formulaire
  désactivés pendant l'enregistrement.
- Validation serveur des objets et quantités, noms historiques dans le JSON Prison!J,
  affichage lisible et prise en charge des anciennes saisies en texte libre.
- Aucune lecture du catalogue au chargement du registre, du formulaire ou des autres
  pages. Lecture de A:C en bloc lors de la recherche ; pas de cache tant qu'aucune
  mesure distante ne justifie sa complexité. Ajout sans saisie : aucune lecture Objets.
- Tests : `node scripts/test-prison-objets.mjs`, `node scripts/test-saisies-ui.mjs`,
  et les six suites existantes réussis. Génération : `npm run build` réussie.
- Code envoyé par clasp (16 fichiers), déploiement Web App existant mis à jour en
  version **52** le 7 septembre 2026. L'initialisation réelle d'Objets reste déclenchée
  par la première recherche ; aucun enregistrement d'incarcération de test n'a été
  créé en production. Les tests locaux ne remplacent pas un essai utilisateur connecté.
- Vérification par l'API Apps Script : les 16 fichiers de la version 52 concordent
  avec le dépôt ; accès Web App `ANYONE_ANONYMOUS` conservé. La lecture HTTP directe
  de l'URL depuis l'environnement de développement a retourné 403, donc aucun test
  du formulaire connecté en production n'a été effectué pendant cette intervention.
- Incident confirmé par le propriétaire : le lien demande un accès en navigation
  privée après la publication par clasp. Un diagnostic HTTP anonyme reproduit une
  page Google Drive « accès refusé » (403), malgré `ANYONE_ANONYMOUS` et
  `USER_DEPLOYING`. Les manifestes des versions 51 et 52 sont identiques. Un retour
  temporaire à 51 n'a pas corrigé l'accès ; la version 52 a ensuite été remise sur
  le même déploiement.
- **Résolu — précision du propriétaire, 15 septembre 2026.** Le 403 ne survient
  que lorsque le déploiement est mis à jour par clasp. Publié à la main depuis
  l'interface Apps Script, l'accès anonyme fonctionne, navigation privée
  comprise. Ce n'est donc pas un défaut de l'application et ce n'est pas un
  blocage ouvert : c'est la raison pour laquelle la publication reste manuelle.
  Ne pas confondre le partage du classeur ou du code source avec l'accès à la
  Web App.

## Fonctionnel

### Auth
- Login GARDE / OFFICIER.
- Token HMAC avec expiration 8 h.

### Organigramme
- Implémenté dans `Organigramme.js`.
- Refonte locale du 5 septembre 2026 : chaîne centrale jusqu'aux Majors de l'État-Major, Hird relié uniquement au Jarl, Capitaines mis en avant et personnel repliable par corps. Hird replié initialement ; garnisons ouvertes.
- Les Majors actifs de Rivebois et Bois-de-Chêne forment un commandement commun sous l'État-Major central ; les deux garnisons sont rattachées à ce groupe. Les cinq autres corps, dont la Garde inquisitoriale depuis le 7 octobre 2026, restent directement sous l'État-Major.
- Autres Majors actifs hors commandement et Réserve commune dans deux blocs en bas. Répartition vérifiée par `node scripts/test-organigramme.mjs`, notamment les variantes de nom de Bois-de-Chêne, les réservistes et les postes vacants. Version Web déployée non mise à jour par cette refonte locale.

### Effectifs
- Page OFFICIER.
- Ajout et modification.
- Pas de suppression.
- Couleurs de grades depuis `Données!A2:A`.
- Groupement par corps puis grade.
- Réserve à la fin de chaque corps.
- Groupes terminaux trans-corps en fin de page.

### Présences
- Consultation GARDE.
- Modification OFFICIER.
- Tableau de bord OFFICIER.
- Génération / synchronisation historique présente dans le backend.

### Paye
- Consultation OFFICIER et INTENDANT.
- Règlement d'une semaine par les OFFICIER uniquement.
- Aucune écriture hors de `Présences!O`.

### Codex
- Consultation dans la Web App.
- Synchronisation des documents vers `SyncCodex`.

### Amendes / Prison
- Consultation.
- Ajout.
- Modification des cases d'état.
- Suppression OFFICIER.
- Liste des gardes lue depuis `Données!O2:O`.
- Formulaires verrouillés pendant l'enregistrement pour empêcher les doubles soumissions.
- Les gardes sans nom de famille sont écrits avec la valeur brute de `Données!O`, espaces invisibles compris, afin de respecter les validations Sheets.
- Une écriture Amendes / Prison qui échoue restaure les valeurs précédentes de la ligne cible pour ne pas laisser d'entrée fantôme.
- Statut `Reversé` des Amendes modifiable par les OFFICIER uniquement.
- Destinataire du reversement affiché dynamiquement depuis les collecteurs actifs du corps du garde, avec repli État-Major.
- Les amendes des corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major regroupent les collecteurs de Cité et d'État-Major ; leurs grades sont affichés.
- Couleurs des amendes : rouge (non payée), gris (payée non reversée), vert (payée reversée).

### Présences

- Le Hird du Jarl est exclu du tableau, des calculs de solde et des alertes d'inactivité, sans suppression des lignes historiques.
- Les semaines sont affichées en accordéons ; seule la semaine courante est ouverte par défaut et trois filtres — semaine, corps, personne — restreignent la liste.

### Effectifs

- Les ajouts remplissent la première ligne disponible de la liste et héritent format et validations d'une ligne modèle valide.
- Un ajout ou un changement de statut régénère la semaine courante de Présences.

## Changements intégrés

### Source de la liste des gardes dans Amendes / Prison

- `SyncCodex!P` n'est plus généré ni consommé par le code.
- `getAmendeFormData()` et `getPrisonFormData()` lisent désormais `Données!O2:O`.
- Les validations serveur lors des ajouts utilisent également `Données!O2:O`.
- La liste reste dérivée d'`Effectifs` par la formule présente dans la feuille `Données`.

### Double soumission des formulaires Amende et Prison

- Un verrou synchrone empêche tout second submit pendant l'appel serveur.
- Les champs et le bouton sont désactivés et le bouton affiche `Enregistrement…`.
- Le formulaire est réactivé à la fin de l'appel lorsqu'il reste affiché, notamment après une erreur.

## Problèmes / travaux immédiats connus

### 1. Présences / Effectifs

Un décalage a été signalé visuellement / métier entre Effectifs et la liste des Présences.
Aucune correction ne doit être faite avant d'identifier précisément le cas et la règle métier souhaitée.

### 2. Caractères corrompus dans `ui/src/theme.css`

Relevé le 4 octobre 2026, non corrigé : quelques chaînes du fichier ont été
enregistrées en double encodage UTF-8. Visible : le losange décoratif sous
chaque titre de page s'affiche « â—† » et l'aide de défilement mobile des
Présences « Faites dÃ©filer… ». Moins visible : le sélecteur
`td[data-label="DÃ©tenu"]` ne correspond à aucune cellule, et le nom du
détenu n'est pas mis en gras dans les fiches mobiles de la Prison.

## Performance

Aucune pagination/lazy loading n'est jugée nécessaire pour Effectifs à l'échelle actuelle.
Le premier axe d'optimisation, si besoin, est plutôt la réduction / mise en cache des accès Sheets.

### Présences — recherche et coût par corps (6 septembre 2026)

- Recherche par prénom et nom, insensible aux accents et à la casse, combinable avec le filtre de semaine. Les semaines correspondantes sont ouvertes au lancement de la recherche.
- Chaque corps affiche, pour les OFFICIER uniquement, la somme des soldes de la semaine, courante ou passée, paiements inclus. Le total porte sur tout le corps même pendant une recherche et se recalcule après modification des présences.
- Les agrégats `corpsTotals` sont calculés côté serveur dans `getPresences` après contrôle du rôle et ne sont pas renvoyés aux GARDE. Les soldes individuelles existantes restent consultables ; aucune modification des données historiques.
- Le tableau de bord OFFICIER affiche le cumul des amendes datées de la semaine courante (lundi à dimanche, fuseau métier Europe/Stockholm), payées et déjà reversées. Ce cumul utilise la date de l'amende, pas la date de reversement, qui n'est pas enregistrée.
- Vérifications locales : `node scripts/test-presence-finances.mjs` (permissions, totaux courants/passés, exclusion Hird, bornes de semaine et changement d'année).

### Nouveautés des Effectifs et de l'Organigramme (6 septembre 2026)

- Badge « Nouveau » / « Vu » pendant 14 jours, survol de 800 ms, clavier ou appui, détails datés des arrivées et changements de grade/corps. État de lecture partagé entre pages et conservé dans le navigateur ; repli en mémoire si le stockage est bloqué.
- Panneau des changements récents : filtres par type, personne/corps et non vus, actualisation, tout marquer comme vu. Compteurs de membres avec nouveautés dans les onglets Effectifs et les corps/personnels repliés de l'Organigramme.
- Feuille `HistoriqueEffectifs` et colonne `ID membre` créées automatiquement au premier chargement. La structure est documentée dans `DATA_MODEL.md`. Les membres déjà présents sont initialisés sans fausses nouveautés.
- Journalisation des modifications applicatives sous verrou ; déclencheur d'édition Sheets installé automatiquement à la première consultation OFFICIER d'une des deux pages. Comparaison de repli à chaque chargement.
- Le déploiement doit inclure `HistoriqueEffectifs.js` et le nouvel `Index.html`. Les autorisations Apps Script doivent permettre la création du déclencheur. L'installation effective et les écritures Sheets n'ont pas été exécutées pendant le développement local.
- Vérifications : `node scripts/test-historique-effectifs.mjs`, `node scripts/test-changes-ui.mjs`, tests existants Organigramme et finances des Présences, puis `npm run build`.

### Soldes journalières par grade (6 septembre 2026)

- La base commune a été identifiée dans `Vue globale!L2`. Une feuille `SoldesGrades` est créée automatiquement au premier chargement des Présences/du tableau de bord ou à une génération/réparation de formules.
- Commander à 100 septims/jour pour la semaine courante et les suivantes. Le barème initial des autres grades reprend la base existante ; exceptions Recrue 0 et Aspirant-Garde moitié de la base. Hird toujours exclu.
- Le barème est modifiable directement dans `SoldesGrades`, puis appliqué au prochain chargement des Présences. Les anciennes soldes sont préservées en fixant l'ancienne base dans leurs formules, et en restaurant les formules R1C1 lors des reconstructions.
- La pose des validations de cases dans `appliquerStructurePresences` conserve désormais les valeurs des pointages et paiements restaurés.
- Tests : `node scripts/test-soldes-grades.mjs` (migration, barème, historique, modifications des jours, régénération, paiements, colonnes techniques et validations), `node scripts/test-presence-finances.mjs`.
- Code local uniquement : aucun déploiement ni modification du classeur distant pendant cette intervention.
