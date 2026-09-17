# Journal de passation IA

## 2026-09-17 — Page Paye et rôle INTENDANT

- Nouvelle page **Paye**, qui répond à la question du jour de paye : combien
  demander, et à qui. Les semaines closes impayées sont regroupées par financeur —
  argentier de la cour pour Cité / Éclaireurs / État-Major, un Thane par garnison —
  avec le détail par corps puis par garde, et un récapitulatif en texte brut à
  remettre au financeur.
- La semaine en cours n'entre jamais dans le montant à demander ; elle est chiffrée
  à part, en prévision. Les soldes nulles ne comptent pas comme impayés.
- Un corps non rattaché à un financeur connu apparaît sous « Financeur à
  déterminer », en tête et compté au total, plutôt que d'être écarté.
- Règlement une semaine et un garde à la fois. La ligne réglée reste visible dans
  « Réglé à l'instant » le temps de la session, avec une annulation.
- Nouveau rôle **INTENDANT** (`PASSWORD_INTENDANT`), distribué hors de la garde :
  argentier, Thanes et cuisines de la cour. Organigramme et Paye en lecture seule,
  rien d'autre. Sans cette Script Property, aucun code ne peut ouvrir la session.
- `modifierPresence` conserve son nom et son comportement ; son écriture validée
  est extraite dans `ecrirePresenceCellule_`, désormais partagée avec `Paye.js`.
  Les deux chemins appliquent donc exactement les mêmes contrôles.
- Aperçus `paye-1440`, `paye-390` et `paye-intendant-1440`. Les données de
  démonstration de la paye sont calculées par le vrai `getPaye` dans un contexte
  `vm`, et les lignes de présence servent de source unique aux deux pages.
- Vérifications : `node scripts/test-paye.mjs` et les onze suites existantes,
  `npm run build`, `npm run apercus`. Aucun push ni déploiement.
## 2026-09-15 — Soldes impayées repérables semaine par semaine

- Badge « N impayés » dans l'en-tête de chaque accordéon de Présences, visible
  accordéon replié, et bouton de filtre sur les seuls impayés de la semaine.
- Le bouton n'existe que si la semaine compte au moins un impayé, et disparaît
  dès que le dernier est réglé.
- L'en-tête était un `<button>` occupant toute la largeur ; il devient une barre
  contenant le basculement et le bouton de filtre, pour éviter des boutons
  imbriqués, invalides en HTML.
- Règle retenue : solde strictement positive et non réglée, alignée sur les
  couleurs de lignes existantes. Couverte par `scripts/test-presences-impayes.mjs`.
- Harnais d'aperçus : les transitions et animations sont neutralisées avant
  capture. Une capture prise juste après un clic figeait un bouton au milieu de
  son changement de couleur et donnait l'illusion d'un défaut de style.

## 2026-09-15 — Consultation publique du Codex

- Rôle `VISITEUR` obtenu sans mot de passe par `ouvrirSessionPublique()`, jeton
  signé comme les autres mais valable deux heures au lieu de huit.
- Ajouté à la seule liste de rôles de `getCodex`. `createAuthToken()` accepte
  désormais une durée, sans changement pour les appels existants.
- Interface : bouton « Consulter le Codex » sous le formulaire de connexion,
  navigation réduite au seul onglet Codex, badge de session « Visiteur ».
- `scripts/test-acces-public.mjs` verrouille l'invariant de sécurité : le rôle
  public ne doit apparaître dans aucune autre liste de rôles ni aucun autre
  fichier de `src/`. Sans ce test, un ajout distrait ouvrirait Effectifs ou
  Présences au monde entier, sans erreur ni signal.

## 2026-09-15 — Correctifs mobiles et décor de fond

- Onglets Effectifs : passage à la ligne sous 600 px au lieu d'un défilement
  horizontal sans affordance, dont la coupure tombait au bord du gabarit.
- Tuiles des Présences : la règle mobile de `styles.css` était écrasée par une
  règle plus large de `theme.css`, chargé après. Morte depuis la refonte.
- Bandeau d'en-tête illustré supprimé à la demande du propriétaire ; décor de
  charpente ajouté en filigrane derrière le contenu.
- `pilier-nordique.png` réduit de 2,8 Mo à 202 Ko avant incorporation : les
  assets sont inclus en data URL dans `src/Index.html`, rechargé à chaque
  ouverture de la Web App.

## 2026-09-15 — Décrets du Jarl découverts par dossier Drive

- `SYNC_CODEX_FOLDERS` déclare des dossiers dont chaque Google Doc natif devient
  un texte juridique, le nom du fichier servant de nom de source. Déposer un
  décret suffit : ni modification de code ni push.
- Identifiant de dossier laissé vide, donc lecture sautée, pour livrer le code
  avant que le dossier n'existe.
- Le filtre des listes d'infractions ne repose plus sur le nom du Codex
  Judiciaire en dur, mais sur un drapeau `sanctions` du registre. Un article
  n'y entre que s'il porte réellement une amende ou une durée de cachot.
- Métadonnées des documents mises en cache dans `SyncCodex!R:W`, relues par
  `Codex.js` : les décrets d'un dossier sont inconnus du code, et lister le
  dossier à chaque consultation du Codex coûterait un appel Drive par affichage.
- Doublons, noms vides et fichiers non-Docs écartés ; un document déclaré
  l'emporte sur un homonyme du dossier. Le tout couvert par le test.

## 2026-09-15 — Registre juridique unique et intégration des décrets

- Les documents étaient déclarés deux fois : identifiants et familles dans
  `SYNC_CODEX_DOCUMENTS`, autorités et liens dans `getCodexDocumentMetadata_()`.
  À vingt documents, deux tables parallèles divergent. `Codex.js` dérive
  désormais ses métadonnées du registre, qui porte tous les champs.
- Cinq identifiants de codes impériaux renouvelés, Codex Procédural de
  Blancherive retiré, douze décrets ajoutés en famille « Décrets impériaux ».
- Aucun changement nécessaire côté formulaires : `ecrireCachesTechniquesCodex_()`
  restreignait déjà les listes d'infractions au Codex Judiciaire.
- Les libellés d'infraction stockés dans Amendes et Prison sont de la forme
  `Art. N — Titre` et ne portent pas le nom de la source ; renommer une source
  impériale n'orpheline donc aucune ligne historique.
- Test étendu : unicité des sources et des identifiants, longueur d'identifiant
  de 44 caractères — un Word importé en fait 33 et serait illisible —, absence
  des documents écartés, et concordance registre / métadonnées dérivées.

## 2026-09-15 — Lecture des articles en listes et en onglets

- `extraireArticlesCodex_()` lisait `getBody().getParagraphs()`, qui ne retourne
  pas les `ListItem`. Les décrets rédigeant leurs articles en listes à puces
  produisaient zéro article, sans erreur. La lecture passe par `getText()` et
  parcourt les onglets via `getTabs()`.
- « De Argentaria », « Armes éthérées » et « Successions des châtelleries »
  passent de 0 article à 24, 7 et 5.
- Copies locales des textes sous `docs/codex/`, avec index et correspondance
  identifiant → document, pour travailler sans accès Drive.

## 2026-09-15 — Renommage du grade Aspirant-Garde en Cadet

- Le propriétaire a supprimé `Aspirant-Garde` de `Données` et introduit `Cadet`
  au même tarif : Recrue à 0, Cadet à la moitié de la base. `SoldesGrades.js`
  portait déjà le renommage ; le reste du dépôt a été aligné.
- Alignés : fixtures et attentes de `test-soldes-grades.mjs`, commentaire de
  `ui/src/app.jsx`, données d'aperçus, `BUSINESS_RULES.md` et `DATA_MODEL.md`.
- Volontairement conservés sous l'ancien nom : la formule historique reproduite
  par `oldFormula` dans le test, et la ligne de Présences de semaine passée qui
  la porte. L'historique des Présences doit rester stable.
- Point restant à traiter dans le classeur : `SoldesGrades` n'est initialisée que
  si elle est vide. La feuille existante conserve sa ligne `Aspirant-Garde` ; il
  faut y renommer ou y ajouter `Cadet`, sinon les Cadets sont payés au tarif
  `Par défaut` au lieu de la moitié.

## 2026-09-15 — Descriptions des grades dans l'Organigramme

- Quinze descriptions doctrinales fournies par le propriétaire, réparties dans
  `ui/src/grades.jsx`. Table statique : aucune lecture du classeur, aucune
  fonction serveur ajoutée.
- Design hybride retenu : texte permanent sous les libellés de la chaîne de
  commandement (Jarl, Maréchal, Commander, Major), et bouton ⓘ dépliable pour
  les grades de corps et de garnison, sur le modèle de `ChangeBadge`.
- Les Majors du commandement de Rivebois et Bois-de-Chêne reçoivent une
  description distincte de celle des Majors d'État-Major, via la variante
  `commandementLocal` passée à `CentralGroup`.
- « Commandant » et « Commander » partagent le même texte, comme le fait déjà
  `estGradeCommandant()` dans `src/Organigramme.js`. Un grade absent de la table
  s'affiche sans description et sans erreur.
- Harnais d'aperçus complété pour l'Organigramme : réponse `getOrganigramme` et
  jeu de démonstration couvrant toute l'échelle des grades.
- Vérifications : `node scripts/test-grades.mjs` et les onze suites existantes,
  puis `npm run build`. Aucun push ni déploiement.

## 2026-09-04 — Validation des gardes sans nom de famille

- Les ajouts Amendes et Prison résolvent désormais le libellé nettoyé du formulaire vers la valeur brute de `Données!O` avant l'écriture.
- Les espaces finaux produits par la formule pour les gardes sans nom de famille ne provoquent plus d'erreur de validation Sheets.
- En cas d'échec d'écriture, les valeurs précédentes de la ligne cible sont restaurées afin d'éviter les entrées fantômes.

## 2026-09-04 — Snapshot de référence

- Snapshot complet du projet local reçu.
- Le repo devient la source de vérité pour les prochaines modifications.
- Documentation de passation créée pour Codex / VS Code.
- Aucun fichier métier de `src/` modifié dans cette passation.
- Deux travaux immédiats documentés :
  - verrouillage des formulaires Amende / Prison pendant l'envoi ;
  - retrait de la dépendance des gardes à `SyncCodex!P`.
- Un problème Présences / Effectifs signalé reste à diagnostiquer avant modification.

## 2026-09-04 — Découplage de la liste des gardes

- Suppression de la génération du cache `SyncCodex!P`.
- Suppression du rafraîchissement de cette colonne depuis l'API Effectifs.
- Les formulaires Amendes et Prison ainsi que leurs validations serveur utilisent désormais `Données!O2:O`.
- Documentation du rôle de la formule de concaténation présente dans `Données!O`.

## 2026-09-04 — Verrouillage des formulaires Amendes / Prison

- Ajout d'un verrou synchrone anti-double-submit dans `AmendeForm` et `PrisonForm`.
- Désactivation de tous les contrôles pendant l'enregistrement.
- Affichage du libellé `Enregistrement…` jusqu'à la fin de l'appel serveur.
- Aucun changement des API ni des règles métier côté serveur.

## 2026-09-04 — Frontend buildé depuis `ui/`

- Extraction du CSS et du code React hors de `src/Index.html`.
- Ajout d'un build esbuild qui génère l'artefact `src/Index.html` sans Babel côté navigateur.
- Mise à jour des scripts npm pour construire avant un `clasp push`.

## 2026-09-04 — Chargement robuste des métadonnées Codex

- Les métadonnées de `Codex.js` ne sont plus construites lors de l'évaluation globale.
- Elles sont désormais créées à l'appel pour éviter une dépendance à l'ordre de chargement de `SyncCodex.js`.

## 2026-09-04 — Contrôle du statut Reversé des Amendes

- Seuls les OFFICIER peuvent modifier `Reversé aux trésoriers`.
- La règle est imposée côté serveur et la case est désactivée pour les GARDE dans l'interface.

## 2026-09-04 — Destinataires dynamiques des amendes

- Chaque amende affiche les collecteurs actifs de son corps de garde.
- En l'absence de collecteur local, l'interface utilise les collecteurs actifs d'État-Major.
- Les corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major mutualisent les collecteurs de Cité et d'État-Major ; les grades sont affichés.
- Couleurs des lignes ajustées : rouge non payée, gris payée non reversée, vert payée reversée.

## 2026-09-04 — Exclusion du Hird des présences

- Le Hird du Jarl est exclu de la génération et de l'affichage des présences.
- Il est également exclu des agrégats de solde et des alertes d'inactivité, sans suppression de l'historique.

## 2026-09-04 — Positionnement des nouveaux effectifs

- Les nouveaux membres ne suivent plus la dernière cellule utilisée de la feuille.
- Ils sont ajoutés à la première ligne libre et récupèrent l'intégralité du modèle (dont validations et chips) d'une ligne Effectifs valide, sans en reprendre les données.

## 2026-09-04 — Synchronisation Effectifs / Présences

- L'ajout d'un effectif et toute modification de statut régénèrent la semaine courante de Présences.
- Les autres modifications d'effectif n'entraînent pas de régénération.

## 2026-09-04 — Consultation des Présences

- Les semaines sont repliables, avec ouverture initiale de la semaine courante.
- Un filtre permet de limiter l'affichage à une semaine donnée.
