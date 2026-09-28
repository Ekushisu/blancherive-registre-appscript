# Journal de passation IA

## 2026-09-28 — Régénération sur grade, corps ou statut ; sortants conservés

- Règles fixées par le propriétaire : la semaine courante se régénère à
  l'ajout d'un membre et à tout changement de grade, corps ou statut
  (`Effectifs.js`, avant : statut seul) ; un membre sorti du service actif
  garde sa ligne de la semaine si elle porte un pointage ou un paiement
  (`Presences.js`, avant : ligne perdue) ; les pointages sont toujours
  conservés. Test étendu, doc BUSINESS_RULES mise à jour.

## 2026-09-28 — Dates affichées en calendrier tamrielien

- Sur demande du propriétaire, toutes les dates de l'interface sont rendues
  en calendrier de Tamriel avec la date réelle en info-bulle : nouveau module
  `ui/src/calendrier.js` (`lireDate`, `dateTamriel`, `dateReelle`) et
  composant `DateRP` dans `calendrier.jsx`. Année réelle − 1 800 → « 4E 226 »,
  jour de semaine Morndas…Sundas, mois Primétoile…Soirétoile (VF des jeux).
- Branché sur Amendes, Prison, Présences, Paye, tableau de bord et panneau
  des changements. Données, API et champs de saisie inchangés. Texte copié de
  la Paye : les deux calendriers. Test `scripts/test-calendrier.mjs`.

## 2026-09-28 — Présences : lundi ISO en colonne A, identité de ligne au pointage

- Le propriétaire a signalé que l'ajout d'un membre réécrit la feuille
  Présences, y met des dates de 1900 en colonne A et perd des pointages, même
  après suppression des déclencheurs horaires. La régénération n'est pas
  déclenchée par un CRON mais par `ajouterEffectif` et `modifierEffectif`.
  Une cellule `Présences!A` au format date revenait de `getValues()` en
  objet `Date` (39 → 7 février 1900) ; la ligne n'était plus reconnue comme
  semaine courante, un doublon à blanc était créé, et la `Date` réécrite
  posait le format date ailleurs à chaque tri, `clearContent()` gardant les
  formats.
- Décision du propriétaire : ne plus stocker de numéro de semaine. La
  colonne A porte le lundi ISO en texte `yyyy-MM-dd`, format texte brut,
  en-tête « Lundi ». Le serveur raisonne en lundis, l'interface calcule le
  numéro de semaine (`ui/src/semaine.js`). Texte plutôt que cellule date :
  aucune dépendance au format de cellule ni au fuseau du classeur, même
  convention que `HistoriqueEffectifs`. L'année est enfin portée : la Paye
  et le tableau de bord ne perdent plus les semaines de l'année écoulée en
  janvier.
- `Presences.js` : `normaliserLundiPresence_` ramène toute ancienne valeur
  (numéro, date de 1900, numéro de série, texte) au lundi ISO, un numéro
  supérieur à la semaine courante datant de l'année précédente ; la génération,
  `getPresences`, `Paye.js`, `PresenceDashboard.gs.js` et
  `mettreAJourSoldesPresences_` l'utilisent. Fusion des doublons de la semaine
  courante, tri chronologique par lundi, format `@` sur toute la colonne A.
  Nouvelles fonctions manuelles `inventorierReferencesSemainePresences()` et
  `migrerPresencesVersLundis()` (colonne A seule ; les formules lisant A sont
  rappelées dans le journal, sans bloquer, une formule adaptée les lisant
  légitimement). La formule `Vue globale!N5` du propriétaire, seule concernée,
  a été adaptée au lundi ISO.
- `ecrirePresenceCellule_` exige l'identité de la ligne (`lundi`, `prenom`,
  `nom`), prend le verrou de document et refuse un numéro de ligne périmé.
  `modifierPresence` et `reglerSemainePaye` transmettent `identite` ;
  `app.jsx` l'envoie depuis les pages Présences et Paye. Les champs d'API
  `currentWeek` / `semaine` deviennent `lundiCourant` / `lundi`.
- Mise en forme de Présences portée par la génération : trois règles
  conditionnelles (semaine courante, impayé dû, semaine passée) sur toute la
  hauteur de A:O, remplaçant les règles manuelles de la feuille, et séparateurs
  de semaine redessinés. Motif : les règles manuelles ne couvraient pas les
  lignes ajoutées et comparaient A à un numéro de semaine.
- `Code.js` : retrait des fonctions historiques de génération hebdomadaire
  par numéro de semaine (voir CURRENT_STATE). `getCurrentIsoWeekWebApp`
  conservée, dérivée du lundi courant.
- Vérifications : `node scripts/test-presences-lundi.mjs` (nouveau, remplace
  `test-presences-semaine`), `test-paye` (étendu au passage d'année et à
  l'identité de ligne), `test-presence-finances`, `test-soldes-grades`,
  `test-presences-impayes` et les autres suites ; `npm run build`. Données
  d'aperçu adaptées, aperçus non recapturés. Aucun push ni déploiement ;
  ordre de mise en service dans CURRENT_STATE.

## 2026-09-27 — Quatre codes de Blancherive, Codex Judiciaire caduc

- Le propriétaire a fourni quatre Google Docs et déclaré caducs tous les
  anciens codes de Blancherive : Loi fondamentale, Code pénal local, Code civil
  local et Code du commerce local, tous adoptés par la Cour de Blancherive. Ils
  entrent dans `SYNC_CODEX_DOCUMENTS` sous la famille « Droit de Blancherive »
  et remplacent le Codex Judiciaire (`1_awmZGCcQ…`), retiré du registre et
  conservé sous `docs/codex/ancien-code-judiciaire-blancherive.txt`. Aucun
  doublon avec les textes déjà référencés : ce sont des textes nouveaux, pas
  des réécritures.
- **Les formulaires Amendes et Prison perdent leurs listes d'infractions.**
  L'ancien Codex chiffrait 55 articles ; aucun des quatre nouveaux codes ne
  porte de montant ni de durée. Le Code pénal qualifie chaque article
  (contravention, délit, crime) et renvoie au barème impérial. Décision
  provisoire du propriétaire, le 27 septembre 2026, en attendant l'avis du
  nouveau magistrat : les gardes cochent « Motif personnalisé », citent
  l'article et saisissent eux-mêmes le montant ou la durée. Les deux issues
  restent ouvertes — chiffrer les peines dans le texte, ou fixer un barème par
  qualification dans l'application. `sanctions: true` est posé sur le Code
  pénal et le Code du commerce pour que leurs articles entrent dans les listes
  dès qu'ils seront chiffrés.
- Extraction : les sauts de ligne doux (Maj+Entrée) séparent désormais des
  lignes. Les codes de Blancherive en usent entre le titre d'un article et son
  corps ; sans ce découpage, 33 articles du Code pénal restaient sans texte.
  La qualification portée par le titre, « (délit) », devient la classification
  de l'article et quitte le titre ; « infraction délictuelle » dans le texte
  vaut délit et non simple infraction. Les codes impériaux gardent leurs
  classifications entre crochets.
- Ces documents sont partagés en lecture sans téléchargement : la page de
  lecture s'ouvre, l'export texte répond 401. Les copies locales ont été
  reconstituées depuis la page de lecture. Si `synchroniserCodex()` n'arrive
  pas à les ouvrir, demander au propriétaire des documents d'autoriser le
  téléchargement pour les lecteurs.
- `CODEX_JUDICIAIRE_SOURCE` reste défini : `findCodexArticle` dans `Index.html`
  résout encore par numéro d'article, dans cette seule source, les libellés
  des amendes et incarcérations antérieures. Les lignes historiques restent
  lisibles ; seul le lien d'information vers l'ancien article cessera de se
  résoudre après synchronisation.
- Vérifications : `node scripts/test-sync-codex.mjs` (étendu aux sauts de ligne
  doux, aux qualifications de titre et au nouveau registre), `test-sanctions`,
  `test-sanctions-ui`, `test-acces-public`, `test-prison-objets`. Extracteur
  passé sur les copies locales : 28, 97, 31 et 21 articles, aucun sans texte.
  Aucun push ni déploiement ; `synchroniserCodex()` à lancer après publication.

## 2026-09-22 — Inventaire des coffres, rôle INTENDANT en lecture, deux décrets

- Nouvelle page **Inventaire** et module `src/Inventaire.js` : liste des objets
  présents dans les coffres de Fort-Dragon, avec nom, quantité et coffre. La
  page répond à une question d'intendance — avons-nous encore des torches, et
  dans quel coffre ? — d'où ses droits : OFFICIER écrit, INTENDANT lit, GARDE
  n'y accède pas du tout.
- Feuilles `Coffres` et `Inventaire` créées à la première consultation ; le
  coffre est référencé par un UUID pour qu'un coffre renommé garde son contenu.
  Un objet par coffre : les ajouts cumulent, les retraits décrémentent, zéro
  efface la ligne. Écriture du bloc entier sous verrou, avec restauration en cas
  d'échec.
- Même catalogue et même recherche que les saisies de la Prison, par
  `SaisiesField` rendu paramétrable (`titre`, `masquerListe`, `aideLibre`) sans
  changement pour le formulaire Prison. Un objet déjà en stock ne relit pas le
  catalogue : les boutons + / − ne coûtent qu'une lecture d'`Inventaire`.
- Coffres : création et modification (nom unique, position dans le monde,
  description), pas de suppression applicative. Déplacement d'un objet entre
  coffres par liste déroulante, avec fusion. Les lignes orphelines d'un coffre
  effacé à la main restent visibles et se rattachent depuis la page.
- Navigation : entrée « Inventaire » après « Paye » pour OFFICIER, troisième
  entrée pour INTENDANT. Nouvelle icône de coffre.
- **Catalogue des objets préchargé.** L'autocomplétion des saisies appelait le
  serveur à chaque frappe, et chaque appel relit les 10 131 lignes d'`Objets` :
  plusieurs secondes par lettre. Nouvelle fonction `getCatalogueObjets` (GARDE,
  OFFICIER) qui renvoie le catalogue compact avec une empreinte MD5, ou rien si
  le navigateur connaît la version. `ui/src/catalogue.js` précharge à
  l'ouverture des pages Prison et Inventaire (officier), stocke dans
  `localStorage`, et cherche en mémoire avec le même classement que le serveur ;
  `SaisiesField` reçoit le catalogue en prop et retombe sur le serveur sans lui.
  Les alias de recherche (or, crochets, torches) ne sont définis qu'une fois,
  côté serveur, et transmis avec le catalogue.
- **Rangement groupé dans l'Inventaire.** Chaque objet ajouté au formulaire
  partait aussitôt au serveur, et il fallait attendre la réponse pour ajouter
  le suivant. Le formulaire garde désormais une liste d'attente — la même liste
  que les saisies de la Prison, avec retrait par ligne — et un bouton « Ranger »
  envoie tout par `rangerInventaire` : une requête, une lecture du catalogue au
  plus, une écriture. Le chemin unitaire des boutons + / − et le chemin groupé
  sont le même code serveur.
- **+ / − cumulés dans l'Inventaire.** Il fallait attendre chaque réponse pour
  cliquer à nouveau. Les clics sont désormais cumulés par ligne et envoyés en
  une seule variation après 600 ms de pause ; la quantité visée s'affiche
  aussitôt, grisée jusqu'à confirmation. Une variation partie et non confirmée
  bloque la suivante sur la même ligne jusqu'au retour du serveur.
- Codex : trois liens de décrets fournis. Le décret Orsimer était déjà
  référencé sous le même identifiant. Le décret dwemer est une réécriture de
  l'ancien texte du Gouverneur — même sujet, nouvelles institutions, articles
  renumérotés — et remplace l'ancien identifiant dans `SYNC_CODEX_DOCUMENTS`,
  le lien fourni faisant foi ; le nom de source est conservé. Le décret sur les
  recherches archéologiques est ajouté. Copies locales dans `docs/codex/`.
- Vérifications : `node scripts/test-catalogue-local.mjs` (nouveau : droits,
  version, parité stricte serveur/local sur dix-huit requêtes, stockage,
  requête partagée, replis) ; `node scripts/test-inventaire.mjs` (nouveau, 60 assertions :
  droits refusés avant toute lecture Sheets, en-têtes, coffres, cumul, zéro,
  déplacement, rollback, lignes orphelines), suites existantes, `npm run build`,
  aperçus Inventaire. Aucun push ni déploiement ; `synchroniserCodex()` à lancer
  après publication pour rafraîchir le cache.

## 2026-09-17 — Présences : filtre par corps, synthèse repliable, semaine courante hors impayés

- Nouveau filtre **Corps** dans la barre de filtres des Présences, à côté du
  filtre de semaine et de la recherche par personne. Il répond au besoin de
  l'officier de corps, qui vient pointer ses seuls hommes dans une liste
  hebdomadaire devenue très longue : les autres corps sont masqués dans chaque
  semaine affichée, et les semaines sans aucune ligne du corps retenu
  disparaissent. Comme la recherche, il ouvre les accordéons.
- Les lignes sans corps sont regroupées sous « Sans corps » dans la liste
  déroulante comme dans les sections de semaine : `corpsPresence` est désormais
  la seule définition de ce libellé, afin qu'aucun garde ne se perde entre les
  deux vues.
- Le compte d'impayés d'une semaine suit le filtre par corps : le badge parle du
  corps demandé, pas de toute la garde. Il reste indépendant de la recherche par
  personne, pour rester lisible accordéon replié.
- La **semaine courante n'affiche plus d'impayés** — ni badge ni bouton de
  filtre. On est payé le lundi pour la semaine précédente : une semaine en cours
  est impayée par construction, et la signaler faisait de chaque semaine une
  alerte permanente. Le tableau de bord OFFICIER (`pastUnpaid*`) et la page Paye
  appliquaient déjà cette exclusion ; le registre s'aligne sur elles.
- Le compte est extrait dans `compteImpayesSemaine(rows, {current, matchesCorps})`,
  exporté et testé, plutôt que calculé dans le rendu de `WeekSection`.
- La partie OFFICIER — cinq tuiles financières et « Gardes à surveiller » —
  devient un panneau **« Synthèse de la garde »** replié par défaut. Sur
  téléphone, elle occupait tout le premier écran avant la première case à
  cocher ; la page passe de 6 586 à 4 946 pixels de haut à 390 px de large.
  Panneau et non onglet à dessein : l'en-tête reste visible et porte « ⚠ N à
  surveiller », la seule alerte d'inactivité de l'application, qu'une navigation
  aurait masquée. Le pli est mémorisé dans `localStorage`
  (`blancherive.presences.synthese.v1`) ; toute valeur autre que `"1"`, mémoire
  refusée comprise, laisse le panneau replié. La synthèse est chargée même
  repliée, puisque l'en-tête doit annoncer le compte.
- Nouvel aperçu `presences-synthese-1440`, panneau déroulé, pour que la
  documentation continue de montrer les tuiles et les gardes à surveiller.
- Vérifications : `node scripts/test-presences-impayes.mjs`, étendu à l'exclusion
  de la semaine courante, au filtre par corps et au pli par défaut de la
  synthèse ; les suites Présences/Paye/UI existantes ; `npm run build` et les
  aperçus Présences. Aucun push ni déploiement.

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
