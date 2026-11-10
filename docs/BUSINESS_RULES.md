# Règles métier

## Organigramme

- Chaîne verticale : sommet → Maréchal → Commander → Majors du corps État-Major.
- Sommet (décision du propriétaire, 1er novembre 2026), calculé à chaque lecture :
  - un Jarl en service actif tient le sommet, seul, même si des Régents impériaux sont aussi en service ;
  - sans Jarl en service actif, la châtellerie est sous régence impériale : le ou les Régents impériaux en service actif prennent le sommet, par ordre alphabétique, sous le titre de leur grade (« Régence impériale » s'ils sont plusieurs) ;
  - sans l'un ni l'autre, le poste de Jarl est affiché vacant. Aucun nom n'est affiché par défaut : un Jarl mort, radié ou parti disparaît de l'organigramme (Lucius Haldor s'affichait jusque-là en dur).
- Le Jarl est inscrit aux Effectifs au grade « Jarl », en tête de `Données!A`, au-dessus du Maréchal (décision du propriétaire, 12 octobre 2026). Le Régent impérial l'est au grade « Régent impérial » (« Régente impériale » est reconnu aussi). Ces deux grades ne se donnent ni ne se retirent depuis l'application (décisions du propriétaire, 12 octobre et 1er novembre 2026) : les formulaires d'ajout et de modification ne les proposent pas, leur fiche garde son grade figé, et le serveur refuse les deux. Le reste de la fiche reste modifiable. Un changement se fait à la main dans la feuille `Effectifs`.
- Le Huscarl (grade « Huscarl », ou « Huscarl de Blancherive ») est un grade à part, placé sous le Jarl dans `Données!A` (même décision). Depuis le 3 novembre 2026 (décision du propriétaire), son corps décide de sa place à l'organigramme : un Huscarl de l'État-Major est le garde personnel du Jarl, rendu dans la branche « Autorité directe du Jarl », à droite du sommet, hors de la chaîne de l'État-Major ; un Huscarl d'un autre corps protège les thanes locaux et figure au bas de la colonne de son corps, sous tout le personnel, dans un bloc à part portant la mention « Protègent les thanes locaux », compté dans l'effectif du corps. Sous régence, les Huscarls de l'État-Major gardent leur place mais sont détachés du sommet : ni trait, ni mention « Autorité directe du Jarl ». Dans les deux cas le Huscarl n'est ni pointé ni soldé.
- Le Hird du Jarl est dissous (1er novembre 2026) : il n'a plus de branche dans l'organigramme et n'est plus proposé comme corps. Ses fiches et ses lignes historiques restent.
- Les Faubourgs de Blancherive sont dissous (décision du propriétaire, 7 novembre 2026) : plus de colonne dans l'organigramme (`ORGANIGRAMME_GARNISONS`), plus de rôle Discord prérempli (`DISCORD_ROLES_CORPS_INITIAUX`), et le corps est à retirer de `Données!G` par le propriétaire pour ne plus être proposé aux Effectifs ; une ligne « Garnison des faubourgs » déjà écrite dans `RolesDiscord` est à effacer à la main. Les fiches qui portent encore ce corps le gardent jusqu'à leur mutation, leurs lignes de Présences restent, et la Paye continue de rattacher ces semaines passées à l'argentier (jeton `faubourg` conservé) : une solde due n'est jamais écartée.
- Tous les corps et garnisons (Rivebois, Cité de Blancherive, Cap Granite, Bois-de-Chêne, Éclaireurs) répondent directement à l'État-Major central, sur une seule grille de cinq colonnes. Le commandement commun des Majors de Rivebois et Bois-de-Chêne n'existe plus (décision du propriétaire, 7 novembre 2026) : ses Majors rejoignent les Majors hors commandement. Les Capitaines restent en tête de chaque corps / garnison.
- Un corps n'apparaît dans l'organigramme que s'il est déclaré dans `ORGANIGRAMME_GARNISONS` (`Organigramme.js`) ; ses membres actifs n'y figurent pas autrement. Tout nouveau corps doit y être ajouté.
- L'Académie militaire de Blancherive (décision du propriétaire, 3 novembre 2026) est un corps spécial, hors des garnisons : déclarée dans `ORGANIGRAMME_ACADEMIE`, elle est rendue en bas de l'organigramme dans un encart détaché, à côté des Majors hors commandement et de la Réserve, toujours affichée même vide. Son chef n'est pas un Capitaine mais un Sergent-Chef, rendu en tête de l'encart (« Sergent-Instructeur ») ; le reste du personnel suit, groupé par grade affiché. Un Major de l'Académie rejoint les Majors hors commandement, comme ceux des corps directs. Ses membres sont pointés dans les Présences et soldés dans la Paye selon les mêmes critères que tout corps ; son financeur est l'argentier de la cour (jeton `academie`, `PAYE_FINANCEURS`). Le corps doit figurer dans `Données!G` pour être proposé aux Effectifs.

## Nom affiché d'un corps

- La feuille garde le libellé de la liste des corps de `Données` ; l'application peut en afficher un autre. Un seul corps est renommé : « Cité de Blancherive » s'affiche **« Garde de Fort-Dragon »** (décision du propriétaire, 7 novembre 2026), sur l'organigramme comme sur toutes les pages. La feuille, les formulaires et le serveur gardent « Cité de Blancherive » ; le serveur tolère aussi le nouveau libellé (organigramme, Paye, Amendes, rôles Discord) si la feuille l'adopte un jour.
- Le nom affiché est déclaré deux fois : `ORGANIGRAMME_GARNISONS` (serveur, organigramme) et `ui/src/corps.js` (toutes les autres pages). `scripts/test-organigramme.mjs` vérifie qu'ils concordent.
- Seul l'affichage change : les valeurs écrites dans Effectifs et Présences, envoyées au serveur, comparées par les filtres, restent celles de la feuille. Les recherches trouvent les deux noms ; les groupes d'Effectifs, les sections de semaine et la liste des corps des Présences sont triés par nom affiché.
- Les Majors actifs hors État-Major, quel que soit leur corps, sont regroupés à part en bas (« Majors hors commandement »), à côté de la Réserve et de l'Académie.
- Tous les réservistes, quel que soit leur grade ou corps, apparaissent uniquement dans la Réserve commune.

## Grades affichés

- Un grade s'affiche tel que la feuille l'écrit, sauf à l'Académie militaire de Blancherive (décision du propriétaire, 3 novembre 2026) : Caporal et Caporal-Chef s'y affichent « Instructeur », Sergent et Sergent-Chef « Sergent-Instructeur ». La table vit dans le code (`ALIAS_GRADES_CORPS`, `libelleGrade`, `ui/src/corps.js`), jamais dans le classeur : les alias par colonne de `Données` ont été retirés le 1er novembre 2026, et une colonne « Alias <corps> » laissée dans `Données` n'est plus lue.
- L'alias ne touche que l'affichage : Effectifs (en-tête de groupe, le grade de la feuille en rappel ; la recherche trouve les deux noms), Organigramme (groupes par grade affiché : Caporal et Caporal-Chef forment un seul groupe « Instructeur »), Présences, Paye (détail et récapitulatif copié), tableau de bord, collecteurs des Amendes et fiche de service (en-tête, description et chaîne de commandement). La feuille, les formulaires, les tris, les regroupements du serveur, les rôles Discord et la carrière de la fiche gardent le grade régulier. Les deux alias ont leur description de grade (`grades.jsx`).

## Corps dissous

- Décision du propriétaire, 1er novembre 2026 : les corps proposés et acceptés par les formulaires d'Effectifs sont ceux de la liste `Données!G`, et eux seuls. Dissoudre un corps, c'est le retirer de cette liste.
- Un corps dissous n'est plus proposé à l'ajout ni à la mutation, même si des fiches le portent encore. Une fiche qui le porte le garde tant qu'on ne la mute pas : le formulaire l'affiche « (corps dissous) », et le serveur accepte la valeur inchangée.
- Les fiches, les lignes de Présences, les amendes et les incarcérations d'un corps dissous ne sont ni réécrites ni supprimées.
- Le Hird du Jarl est dissous depuis le 1er novembre 2026.

## Effectifs

- Page accessible uniquement aux OFFICIER.
- Un officier peut ajouter un membre, et lui rattacher son compte Discord dès l'ajout (champ facultatif, mêmes contrôles qu'à la modification). Le formulaire d'ajout ne propose aucun grade par défaut : le premier de `Données!A` est le Jarl.
- Un officier peut modifier :
  - grade ;
  - corps ;
  - spécialité ;
  - statut ;
  - assermentation ;
  - nom (prénom et nom), derrière le bouton « Modifier le nom… » puis une confirmation (décision du propriétaire, 12 octobre 2026).

### Renommer un membre

- Le membre garde son ancienneté : toutes ses lignes de Présences, semaines passées et semaine courante, prennent le nouveau nom. Une ligne est à lui quand elle porte son ancien prénom et son ancien nom, sans casse ni espaces autour. Seuls les noms sont réécrits ; pointages et paiements restent tels quels.
- Refus, sans rien écrire : nom vide ; nom déjà porté par un autre membre des Effectifs (sans casse ni accents), partis compris puisque la feuille les garde ; lignes de Présences au nouveau nom tombant les mêmes semaines que des lignes à l'ancien nom (deux personnes). D'autres lignes déjà au nouveau nom sont laissées telles quelles : un renommage interrompu se relance et s'achève.
- Les Présences sont réécrites avant la fiche : si leur verrou ne se libère pas, rien ne diverge. La semaine courante est ensuite régénérée, comme pour un changement de grade.
- Le journal des Effectifs note le changement (« Nom », avant → après) : badge de nouveauté et ligne de carrière à la fiche de service. Un renommage fait à la main dans la feuille y figure de même.
- Connecté par Discord, le membre renommé voit sa session fermée et se reconnecte sous son nouveau nom, que portera son jeton. Le bot renomme son pseudo au passage suivant.
- Les amendes et incarcérations qu'il a dressées passent aussi au nouveau nom (décision du propriétaire, 12 octobre 2026), colonne Garde seule, écrite comme la liste `Données!O`. Une ligne est à lui quand la fiche de service la lui rattache (sans casse, accents ni espaces superflus). Contrevenants, détenus et chefs d'accusation ne changent pas. Seules ses cases sont écrites ; une validation « refuser » qui y resterait est retirée le temps de l'écriture puis remise.
- Ordre des écritures : Présences, puis Amendes et Prison, puis la fiche, dont seules les cases qui changent sont écrites.
- Incident du 12 octobre 2026, version précédente : la colonne Garde était réécrite en entier et chaque case de la fiche réécrite même inchangée ; une validation « refuser » de la feuille a fait échouer le renommage (« cellule B2 »).
- L'application ne doit jamais offrir de suppression physique d'un membre.
- La suppression reste une opération manuelle dans la feuille `Effectifs`.

### Affichage

Organisation :
1. corps de garde ;
2. grades selon l'ordre de `Données!A2:A` ;
3. noms alphabétiques.

La **Réserve** :
- reste rattachée à son corps ;
- forme un groupe distinct ;
- apparaît après tous les grades du corps, y compris les recrues.

Les membres :
- morts ;
- radiés ;
- démissionnaires ;
- déserteurs

sont regroupés en groupes trans-corps à la fin de la page.

### Changements récents des Effectifs et de l'Organigramme

- Les arrivées, changements de grade et changements de corps sont signalés pendant 14 jours. Plusieurs changements simultanés d'un membre constituent un événement détaillé avant/après.
- Le premier chargement initialise les membres existants sans annoncer d'arrivées. Le journal commence à cette date ; aucun historique antérieur n'est inventé.
- Un survol de 800 ms, un focus clavier de même durée ou un clic/appui sur le badge marque les événements du membre comme vus. Un survol plus bref ne le fait pas. Une nouvelle modification crée un nouvel événement non vu.
- « Vu » est propre au navigateur, commun aux deux pages et aux rôles utilisés dans ce navigateur. Pas de compte individuel ni de suivi entre appareils.
- Le panneau propose des filtres par type, nom/corps et non-vus, une actualisation et « Tout marquer comme vu ». Les compteurs par corps comptent les membres avec des événements non vus.
- Les modifications manuelles Sheets sont journalisées lors du déclencheur d'édition ou, en repli, à la prochaine consultation. La date est celle de la détection ; plusieurs changements entre deux détections peuvent être regroupés. Depuis le 12 octobre 2026, un changement de nom crée un événement « Nom » ; un changement de statut actualise la référence sans badge dédié.
- Les GARDE ne reçoivent que les événements des membres actuellement actifs ou réservistes ; les OFFICIER peuvent voir les événements de tous les membres encore dans Effectifs.

## Dates

- Toute date affichée dans l'application l'est en calendrier tamrielien, la date réelle au survol : « Loredas 26 Âtrefeu 4E 226 » pour le 26 septembre 2026. Correspondance jour pour jour ; l'année réelle moins 1 800 donne l'année de la Quatrième Ère. Mois : Primétoile, Clairciel, Semailles, Ondepluie, Plantaisons, Mi-l'An, Hautzénith, Vifazur, Âtrefeu, Soufflegivre, Sombreciel, Soirétoile ; jours : Morndas, Tirdas, Middas, Turdas, Fredas, Loredas, Sundas (noms de la version française des jeux). Les feuilles, l'API et les champs de saisie restent en calendrier réel : seul l'affichage change. Un texte copié, comme le récapitulatif de la Paye, porte les deux dates.

## Présences

- GARDE : lecture seule.
- OFFICIER : modification des jours et du paiement.
- INTENDANT : aucun accès à cette page ; il ne voit que la synthèse de la Paye.
- Les coûts estimés par corps et semaine sont affichés uniquement aux OFFICIER ; ils incluent toutes les soldes du corps, déjà payées ou non, indépendamment de la recherche.
- La synthèse OFFICIER — tuiles financières et gardes à surveiller — est un panneau replié par défaut, en tête de page. Le travail courant de la page est le pointage ; la synthèse répond à une autre question et n'a pas à occuper le premier écran. Elle reste un panneau et non un onglet parce que son en-tête, toujours visible, annonce le nombre de gardes à surveiller : cette alerte d'inactivité n'est signalée nulle part ailleurs, et une navigation la ferait disparaître. Le pli choisi est mémorisé dans le navigateur ; à défaut, la synthèse est repliée.
- La liste se filtre par semaine, par corps et par personne. Le filtre par corps existe pour l'officier de corps, qui vient pointer ses seuls hommes dans une liste hebdomadaire devenue longue : il masque les autres corps dans chaque semaine affichée et restreint le compte d'impayés de la semaine, afin que le badge parle bien du corps demandé. Une ligne sans corps est regroupée sous « Sans corps », dans la liste déroulante comme dans les sections de semaine, pour qu'aucun garde ne disparaisse entre les deux vues.
- La semaine courante n'a jamais d'impayés : la solde se règle le lundi pour la semaine précédente, une semaine en cours est donc impayée par construction. Son badge et son filtre « Impayés » ne s'affichent pas. Le tableau de bord OFFICIER et la Paye appliquent déjà la même exclusion ; les trois doivent rester d'accord, sans quoi une alerte permanente cesserait d'être lue.
- Le cumul des amendes dans le tableau de bord OFFICIER porte sur les amendes datées de la semaine courante, du lundi au dimanche, et cochées Payé et Reversé. La date de reversement n'est pas suivie.
- Le Hird du Jarl (par son corps), le Jarl (par son grade, quel que soit son corps ; décision du propriétaire, 12 octobre 2026) et le Régent impérial (par son grade ; 1er novembre 2026) sont exclus des présences, des calculs de solde, de la Paye et de la surveillance d'inactivité. Les lignes historiques ne sont pas supprimées. Le Huscarl l'est de même, par son grade, quel que soit son corps (3 novembre 2026) : ses lignes de Présences antérieures restent, ignorées par la Paye. La règle unique est `estExcluDesPresences_(corps, grade)` (`Presences.js`).
- Les décrets de la châtellerie sont promulgués et abrogés par dépôt et retrait d'un Google Doc dans le dossier Drive déclaré par `SYNC_CODEX_FOLDERS`. Le dossier fait autorité : la synchronisation suivante reflète son contenu exact. Un décret retiré cesse d'apparaître au Codex et d'être proposé dans les formulaires ; les amendes et incarcérations déjà enregistrées sous ce décret restent inchangées.
- Depuis le 29 septembre 2026, tout article d'un décret ou d'un texte impérial peut fonder un chef d'accusation, qu'il chiffre ou non sa sanction (voir « Chefs d'accusation »). Les règles antérieures, qui réservaient les formulaires aux sources chiffrées du droit de la châtellerie, sont abrogées.
- Le barème journalier est défini par grade dans `SoldesGrades`. Initialisation : Commander (alias Commandant) à 100 septims ; autres grades à l'ancienne base `Vue globale!L2` (50 à l'époque ; feuille archivée depuis, l'initialisation ayant eu lieu), sauf Recrue à 0 et Cadet à la moitié (25 actuellement). Le Hird reste à 0 quel que soit le tarif du grade.
- Le grade `Aspirant-Garde` a été supprimé le 15 septembre 2026 et remplacé par `Cadet`, à tarif identique. Les lignes de Présences antérieures conservent l'ancien nom et leurs formules d'origine ; elles ne doivent pas être renommées. Une feuille `SoldesGrades` déjà créée garde sa ligne `Aspirant-Garde` : il faut y ajouter ou y renommer une ligne `Cadet`, sans quoi les Cadets sont facturés au tarif `Par défaut` au lieu de la moitié.
- Les changements de barème s'appliquent à toute la semaine courante et aux suivantes, selon le grade enregistré dans Présences. Les semaines passées gardent leur tarif, même après régénération/réparation. Corriger un pointage historique utilise sa formule historique lorsqu'elle existe ; un montant saisi manuellement reste inchangé.
- Le tarif journalier est figé numériquement dans la formule de solde. La migration remplace les références historiques à `Vue globale!L2` par sa valeur initiale ; modifier ensuite cette ancienne cellule ne modifie plus les semaines migrées.
- Les données historiques de présence ne doivent pas être détruites par une synchronisation d'effectifs.
- La semaine courante de Présences est régénérée par l'ajout d'un effectif et par tout changement de grade, de corps ou de statut d'un membre existant, appelés directement par `Effectifs.js`, ainsi que chaque lundi par le déclencheur temporel sur `genererPresencesSemaineCourante`. Un changement de spécialité ou d'assermentation ne régénère pas.
- Un membre sorti du service actif en cours de semaine (mort, radié, réserve, démission, désertion, mutation vers le Hird) garde sa ligne de la semaine courante dès qu'elle porte un jour pointé ou un paiement, avec le grade et le corps qu'elle portait. Sans pointage ni paiement, la ligne est retirée. Les pointages déjà cochés ne sont jamais perdus par une modification d'Effectifs.
- Une semaine de Présences est identifiée par le lundi ISO de `Présences!A`, en texte `yyyy-MM-dd` ; le numéro de semaine n'est qu'un libellé d'affichage. La semaine courante est celle dont le lundi est égal au lundi courant à Stockholm ; une semaine est close dès que son lundi est antérieur. Le retard d'une solde se compte en semaines entre les deux lundis, l'année comprise.
- Toute lecture de la colonne A passe par `normaliserLundiPresence_` : un ancien numéro de semaine, une cellule au format date ou un autre jour de la semaine sont ramenés au lundi ISO ; un ancien numéro supérieur à la semaine courante date de l'année précédente ; un texte non reconnu est conservé et affiché tel quel, jamais perdu. Une régénération ne doit jamais réécrire un objet `Date` ni un nombre en colonne A. Si un garde apparaît deux fois pour la semaine courante, les cases cochées sont fusionnées plutôt que perdues ; les doublons de semaines passées sont conservés tels quels.
- Les couleurs des lignes de Présences dans Sheets suivent la même règle que l'application : orange pour la semaine en cours, rouge pour une semaine close impayée à solde due, gris pour une semaine close réglée ou sans solde. Elles sont posées par la génération sur toute la feuille ; une règle posée à la main dans Présences est remplacée à la régénération suivante.
- Un pointage ou un règlement n'est écrit que si la ligne visée porte encore le lundi, le prénom et le nom que l'officier avait sous les yeux ; sinon le serveur refuse et demande de recharger. Une régénération trie et déplace les lignes : le numéro de ligne seul ne suffit pas. L'écriture se fait sous le verrou de document, le même que la régénération.
- Les autres modifications d'Effectifs ne régénèrent pas automatiquement les Présences.

## Paye

La page répond à une question précise : le jour de la paye, combien l'officier
doit-il demander, et à qui. Le registre des Présences est organisé par semaine
puis par corps ; l'argent, lui, vient d'un financeur par corps.

- Financeurs. L'argentier de la cour couvre Cité de Blancherive, Éclaireurs,
  État-Major et l'Académie ; un Thane couvre chacune des garnisons de
  Rivebois, Bois-de-Chêne et Cap Granite. Les Faubourgs de Blancherive,
  payés par l'argentier depuis le 7 octobre 2026 (jusque-là par leur Thane),
  sont dissous depuis le 7 novembre 2026 : leur jeton reste pour que leurs
  semaines passées restent rattachées à l'argentier. Cette coupure ne suit
  pas celle du reversement des amendes.
- Le rattachement se fait par jeton distinctif recherché dans le libellé du corps,
  et non par égalité, afin d'accepter « Rivebois » comme « Garnison de Rivebois ».
  Le jeton « blancherive » seul n'est jamais utilisé : la Cité et les Faubourgs le
  portent tous les deux. Ils relèvent aujourd'hui du même financeur, mais chacun
  garde son jeton propre, pour qu'un changement futur n'en entraîne pas un autre.
- Un corps ne correspondant à aucun financeur connu n'est jamais écarté. Il est
  regroupé sous « Financeur à déterminer », compté dans le total général et
  affiché en tête comme une anomalie de libellé à corriger. Une solde ne doit pas
  disparaître d'une demande de budget parce qu'un libellé a changé dans la feuille.
- Périmètre du montant à demander : les semaines **closes** dont la solde est
  strictement positive et la case Payé décochée. Une solde nulle n'est pas une
  dette ; une recrue ou un garde sans jour pointé n'a rien à percevoir.
- La semaine en cours n'entre jamais dans le montant à demander. Elle est chiffrée
  à part, en prévision, parce que les pointages peuvent encore bouger d'ici
  dimanche.
- Les semaines postérieures à la semaine en cours ne sont pas des retards. La
  colonne Semaine ne portant pas l'année, les semaines de l'année écoulée cessent
  d'être comptées après le passage à la nouvelle année — même limite que le
  tableau de bord OFFICIER.
- Le détail est groupé par corps puis par garde, dettes les plus lourdes d'abord,
  puis les plus anciennes. Le grade affiché est celui de la semaine due la plus
  récente — il peut donc être un grade disparu, comme `Aspirant-Garde`, si la
  semaine due est antérieure au renommage en `Cadet`. Le Hird du Jarl reste
  exclu, comme des Présences.
- La définition de l'impayé est la même que celle du registre des Présences,
  `estImpayePresence` : solde due et non réglée, semaine courante exclue. Les
  deux pages doivent rester
  d'accord, sans quoi un badge de semaine et une demande de budget se
  contrediraient.
- Le règlement se fait une semaine et un garde à la fois : cocher une semaine
  écrit `Présences!O` de cette ligne, rien d'autre. Il n'existe pas de règlement
  en bloc. La ligne réglée quitte la liste des impayés ; elle reste visible dans
  « Réglé à l'instant » le temps de la session, avec une annulation, afin qu'une
  erreur de ligne se rattrape sans passer par la feuille.
- Un filtre par financeur, présenté en tags portant chacun son montant, sert
  aussi de sommaire. Isoler un financeur recalcule le total en tête et le nomme :
  annoncer le total de toute la garde à un seul Thane serait l'erreur exacte que
  cette page doit empêcher.
- Un récapitulatif en texte brut reprend l'ordre de l'écran, montant d'abord et
  justification ensuite, pour être lu ou remis au financeur.
- GARDE n'a pas accès à cette page. INTENDANT la consulte sans pouvoir cocher.

## Chefs d'accusation (Amendes et Prison)

Décisions du propriétaire du 29 septembre 2026, après la mise en place des
quatre codes de Blancherive, qui ne chiffrent aucune peine.

- Une amende ou une incarcération porte **un ou plusieurs chefs d'accusation**,
  vingt au plus. Chaque chef est un article du Codex, identifié par sa source et
  son numéro, ou une référence libre (décret, décision, ordre hors Codex, 1 à
  1 000 caractères). Les deux se mêlent dans une même entrée.
- **Tout le Codex est citable**, droit impérial et décrets compris : le Code
  pénal local renvoie lui-même au droit impérial pour la qualification la plus
  rigoureuse. Seuls les documents marqués `citable: false` dans le registre
  (documentation de contexte) sont exclus, ainsi que les préambules. Un article
  non citable reste lisible au Codex mais n'est ni proposé ni accepté.
- Le titre, la qualification et le sigle de chaque chef sont **figés à
  l'enregistrement**. Un article renommé ou un décret retiré ne modifie pas
  les entrées existantes ; le registre affiche l'instantané avec la mention
  « texte retiré » si l'article n'est plus au Codex.
- **La sentence est à l'appréciation de l'autorité** : montant en septims
  (entier strictement positif) ou durée de cachot en heures (fraction admise),
  saisis librement. Le barème impérial par qualification (contravention
  jusqu'à 100 septims, délit jusqu'à 500, crime jusqu'à 1 000 : Corpus
  Juriscivilis révisé par l'Empire, lu le 3 novembre 2026) est rappelé à titre
  indicatif, jamais imposé. Les montants ou durées que citent encore certains
  articles sont proposés en raccourcis, sans contrainte. Depuis le 4 octobre
  2026, le décret des peines propose en outre une peine par article (voir
  « Décrets de peines et amendes ») ; elle reste une proposition.
- **« À déterminer »** est un choix explicite, pour l'amende comme pour la
  durée de cachot : l'entrée est inscrite sans montant ou sans durée, donc sans
  sortie prévue, et la valeur est fixée ensuite par modification.
- Le serveur revalide chaque chef contre le cache du Codex et refuse un article
  inconnu, non citable ou cité deux fois ; le titre envoyé par le navigateur
  n'est jamais pris pour argent comptant.
- La recherche des chefs se fait dans le navigateur, sur le Codex complet gardé
  en cache local avec sa version (même mécanisme que le catalogue des objets).
  Le formulaire propose les chefs les plus enregistrés du registre, des filtres
  par corpus et par qualification, la lecture de tout article en popup sans le
  retenir, la navigation entre articles voisins et par renvoi (« article 76 »),
  et un sélecteur « Parcourir le Codex » pour retenir depuis la bibliothèque.
- Un formulaire de création garde un brouillon dans l'onglet du navigateur
  jusqu'à l'enregistrement.

## Décrets de peines et amendes

Décision du propriétaire du 4 octobre 2026, sur l'avis du magistrat de
Blancherive : les quatre codes de la châtellerie ne chiffrant aucune peine, la
Garde se réfère aux fourchettes impériales du Corpus Juriscivilis pour les
contraventions, délits et crimes. Le barème qui en découle, article par
article, est tenu dans la feuille `PeinesAmendes` (voir DATA_MODEL). Il
**propose** une peine ; la sentence reste à l'appréciation de l'autorité.

Le 3 novembre 2026, l'Empire ayant révisé le Corpus Juriscivilis (fourchettes
divisées par cinq à douze, amendes déclarées non cumulables) et Blancherive
ayant réécrit son Code pénal local (39 articles au lieu de 96), le barème
initial a été reconstruit en entier sur les nouveaux textes, grille arrêtée par
le propriétaire le même jour.

- **Fourchettes impériales** (Corpus Juriscivilis, classification des
  infractions, texte révisé). Contravention jusqu'à 100 septims (amende simple
  ou travaux légers) ; délit jusqu'à 500 (amende élevée ou travaux forcés) ;
  crime jusqu'à 1 000 (amende forte, emprisonnement ou peine de mort). « Les
  amendes ne sont pas cumulables. » Avant la révision : 500, 2 500 et au-delà.
- **Échelons.** Chaque article est rangé dans la fourchette de sa
  qualification selon la gravité des faits. Valeurs à l'initialisation :

  | Échelon | Amende | Cachot | Rachat noble |
  |---|---|---|---|
  | C1 · C2 · C3 · C4 | 25 · 50 · 75 · 100 | — | — |
  | D1 · D2 | 150 · 250 | — | — |
  | D3 | 375 | 30 min | 500 |
  | D4 | 500 | 1 h | 500 |
  | K1 | 600 | 1 h | 1 000 |
  | K2 | 750 | 2 h | 1 000 |
  | K3 | 900 | 4 h | 1 000 |
  | K4 | 1 000 | 6 h | 1 000 |
  | PM | peine maximale : mort ou bannissement définitif, saisie des biens | | |

  Les durées de cachot sont celles du 4 octobre 2026. Première grille (4
  octobre 2026, fourchettes 500 / 2 500) : contraventions 50 à 500, délits 500
  à 1 250 (resserrés le jour même, de 750 à 2 250 jugés trop sévères), crimes
  3 000 à 12 000, rachat nobiliaire à 1 000 septims l'heure de cachot.

  Le cachot ne vient qu'aux délits graves et aux crimes : la classification
  impériale réserve l'emprisonnement aux crimes, et la juridiction peut le
  prononcer « selon les circonstances et la gravité des faits ». La peine
  maximale n'est prononcée que sur verdict public et motivé du magistrat
  (Corpus Proceduralis, art. 11) et ne se chiffre pas.
- **Portée.** Toutes les infractions qualifiées du Code pénal local réécrit
  (art. 3 à 39, le texte ne portant pas d'article 29), y compris les doubles
  et triples qualifications ; l'infraction du Code du commerce local (art. 17,
  ventes sans droit et tromperies) ; le Corpus Juriscivilis, art. 1 à 17 —
  vol, violences, meurtre… que le code local laisse au droit impérial et que
  les autorités locales peuvent juger (Corpus Proceduralis, art. 1) ; le port
  et la fabrication irréguliers d'équipements Orsimer (décret, art. 4). Sans
  barème : les dispositions générales du Code pénal local (art. 1 et 2), la Loi
  fondamentale, le Code civil, les autres décrets, et les manquements aux
  devoirs nobiliaires, que le De Re Nobilitatis réécrit ne chiffre plus (art.
  14 : amende prononcée par un juge compétent) ; la sentence y est laissée à
  l'appréciation.
- **Renvois.** Codex Penitus (juridictions impériales exclusives), Justicia
  Militaris (légionnaires en service), Decretum de Restitutione Bonorum
  Imperii (juges impériaux), décret dwemer art. 5 (procès impérial à
  Markarth), armes éthérées art. 2 : une ligne `Renvoi` dit la conduite à
  tenir, sans peine locale.
- **Niveaux.** Un article a plusieurs niveaux quand son texte en prévoit :
  forme aggravée, requalification (« constitue un délit… », « est punie comme
  crime »), gradation selon les faits (accusations mensongères selon la
  gravité des faits imputés, usurpation des marques du port à l'exercice d'un
  pouvoir du Jarl), peine maximale pour les crimes les plus graves (sédition,
  trahison, meurtre, assassinat, abominations). Vol et recel (Corpus
  Juriscivilis, art. 6 et 7) : valeur jusqu'à 100 septims, de 100 à 500,
  au-delà ou objet sous licence ; la « valeur particulièrement élevée » qui
  fait le crime est lue au seuil criminel de la classification impériale.
- **Points laissés au magistrat**, signalés dans les observations du barème :
  CPL art. 39 (expériences magiques), crime au titre et délit au corps, et
  art. 4 (entraves), dont le titre annonce un crime que le corps ne définit
  pas (deux niveaux proposés) ; CPL art. 22, dont le corps qualifie de crime
  un recel que le titre ne retient pas ; qualification choisie par le barème
  pour le décret Orsimer, que le texte ne qualifie pas.
- **Plusieurs chefs.** Les amendes ne sont pas cumulables (Corpus
  Juriscivilis, classification des infractions) : la proposition est celle du
  niveau le plus grave des chefs retenus, le cachot suivant la même règle, et
  les autres chefs restent inscrits au registre. Le mode « faits distincts —
  peines cumulées » du 4 octobre 2026 a été retiré le 3 novembre 2026 ; un
  réglage de cumul encore présent dans un brouillon est ignoré.
- **Récidive** : peine encourue doublée. **Tentative et complicité** : punies
  comme l'infraction consommée et comme son auteur (Corpus Proceduralis).
- **Noblesse (De Re Nobilitatis**, texte réécrit en 18 articles, lu le
  3 novembre 2026 ; l'ancien texte numérotait ces règles 8, 9, 10 et 12).
  - Art. 13 : une contravention ou un délit isolé sur sept jours n'est pas
    poursuivi contre un noble. Le formulaire le rappelle et cite les entrées
    du même nom des sept jours précédents dans le registre ouvert. Une amende
    doit toujours lui être proposée, sauf crime de sang : le cachot se rachète
    par l'amende nobiliaire du niveau, égale à l'initialisation au plafond
    impérial de la qualification (500 septims pour un délit, 1 000 pour un
    crime ; décision du propriétaire du 3 novembre 2026). Crimes de sang
    retenus : meurtre, assassinat, torture et mutilation, violences aggravées
    (Corpus Juriscivilis, art. 8, 12, 13, 14).
  - Art. 14 : seules les sanctions prévues par la loi impériale et le Code
    s'appliquent à un noble (amende, bannissement, emprisonnement, déchéance,
    peine capitale quand la loi le prévoit). Les manquements aux devoirs
    nobiliaires valent une amende fixée par le juge : plus de ligne chiffrée au
    barème (l'ancien art. 4 plafonnait à 5 000 septims).
  - Art. 15 : emprisonnement, peine capitale et déchéance sur décision
    conjointe suzeraine et impériale, avec l'accord du Jarl du noble.
- **Formulaires Amendes et Prison.** Un bloc « Barème des peines » propose un
  niveau par chef, la récidive et la noblesse. La
  proposition remplit le montant (Amendes) ou la durée (Prison) tant que le
  champ est vide ou porte encore la proposition précédente : une valeur
  saisie par l'autorité n'est jamais écrasée, « Reprendre la proposition » la
  rétablit, et « À déterminer » n'est jamais rempli automatiquement. La part
  de la peine qui relève de l'autre registre est signalée (cachot dans le
  formulaire d'amende, amende dans celui de la Prison). Ni le niveau retenu ni
  la noblesse ne sont enregistrés : seuls le montant et la durée le sont.
- **Lecture.** La popup d'un article porte son barème partout où elle
  s'ouvre ; les cartes du Codex portent un résumé. La page « Décrets de peines
  et amendes » est ouverte aux GARDE et OFFICIER, et à l'INTENDANT en lecture
  comme le Codex (décision du propriétaire du 4 octobre 2026) ; l'officier y
  voit en plus les lignes de la feuille à reprendre. Le visiteur public n'y a
  pas accès, et le Codex public s'affiche sans barème.
- **Modification** du barème : dans la feuille, par le propriétaire, sur avis
  du magistrat. Aucune édition depuis l'application.

## Modification d'une amende ou d'une incarcération

- Réservée aux **OFFICIER**, comme la suppression. Tout ce que le formulaire de
  création saisit se modifie : date, garde, contrevenant ou détenu, chefs
  d'accusation, montant ou durée, et pour la Prison la cellule, l'entrée, les
  saisies et les notes. La sortie prévue est recalculée.
- Les cases Payé et Reversé, l'acte de sortie et le journal de la Prison ne
  changent pas par ce chemin : ils gardent leur commande dans le registre et
  leur règle de rôle.
- La ligne n'est réécrite que si elle porte encore le garde et le contrevenant
  (ou le détenu) que l'officier avait sous les yeux ; sinon le serveur refuse
  et demande de recharger. Le numéro de ligne seul ne désigne pas une entrée.
- Une entrée antérieure à cette version se modifie aussi ; ses chefs deviennent
  structurés à l'enregistrement. Ses saisies en texte libre, que le formulaire
  ne sait pas rééditer, restent intactes.

## Saisie à son propre nom (session Discord)

Décision du propriétaire, 11 octobre 2026. Une session Discord sait qui est
connecté ; une session par code commun ne le sait pas.

- **Création d'une amende ou d'une incarcération** : connecté par Discord, le
  garde inscrit est toujours celui qui saisit, **officier compris**. Le champ
  est figé dans le formulaire, et le serveur (`imposerGardeSession_`,
  `Amendes.js`) remplace toute valeur envoyée par le navigateur par le nom de
  la session, résolu dans `Données!O` ; un nom absent de cette liste est
  refusé. Par code commun, le champ reste libre.
- **Modification** : réservée aux officiers, elle reste le chemin de correction
  et garde le champ libre, avec le contrôle d'identité de la ligne.
- **Case Payé** : connecté par Discord, un GARDE ne la change que sur les
  amendes dressées à son nom ; un officier, ou une session par code, sur
  toutes. Reversé reste aux officiers.

## Fiche de service

Décision du propriétaire, 1er novembre 2026 : l'ancien Livret de service,
réservé à son propre membre en session Discord, devient la fiche de n'importe
quel effectif (`getFicheService`, `FicheService.js`). Lecture seule.

- **Accès** : GARDE, OFFICIER et INTENDANT, par code commun, sur tout
  effectif, départs compris. Un GARDE n'y lit rien que les Présences, les
  Amendes et la Prison ne lui montrent déjà. L'INTENDANT ne reçoit pas la
  section Justice : il n'a accès ni aux Amendes ni à la Prison.
- **Ouverture** : un clic sur le nom d'un effectif, partout où l'interface
  l'affiche — Organigramme, Effectifs, nouveautés, Présences et gardes
  inactifs, Paye, garde et collecteurs des Amendes, garde de la Prison, chaîne
  de commandement d'une autre fiche. La fiche s'ouvre dans un panneau
  par-dessus la page, qui garde ses filtres et sa position ; un supérieur
  cliqué dans la fiche ouvre la sienne, « Retour » revient à la précédente,
  Échap ou × ferme. Ce n'est pas une page du menu. Contrevenants et détenus ne
  sont pas des effectifs : leurs noms restent du texte.
- **Chargement** (décision du propriétaire, 1er novembre 2026) : toutes les
  fiches sont chargées en arrière-plan au lancement, en un seul appel. Une
  fiche s'ouvre donc aussitôt, puis se met à jour en silence (« Mise à
  jour… ») ; si le serveur ne répond pas, elle reste affichée avec
  l'avertissement « Mise à jour impossible ». Une fiche absente du
  chargement se charge à son ouverture.
- **Rattachement** : l'effectif par son ID membre quand la page le connaît,
  sinon par son nom ; les lignes de Présences, Amendes et Prison par le
  « Prénom Nom » de la fiche, sans casse, accents ni espaces superflus. Un membre renommé depuis les Effectifs garde
  ses Présences, ses amendes et ses incarcérations, réécrites à son nouveau
  nom.
- **Solde** : semaine en cours (jours pointés, solde, payeur selon
  `PAYE_FINANCEURS`) ; **en attente** = même définition que la page Paye
  (semaine close, solde strictement positive, non réglée) ; **perçue** = total
  des semaines réglées, et la dernière d'entre elles. Le Hird du Jarl n'est pas
  soldé par le registre.
- **Service** : jours de service (somme de `Présences!M`), semaines servies
  (au moins un jour), moyenne par semaine servie, **série** (semaines servies
  consécutives, la semaine en cours comprise si elle compte déjà un jour),
  dernier jour pointé. **Inactivité** : en service actif et plus de
  `PRESENCE_DASHBOARD_INACTIVITY_DAYS` (5) jours sans service, ou aucun
  pointage ; même seuil que le tableau des officiers.
- **Carrière** : événements du journal `HistoriqueEffectifs` (arrivée, grade,
  corps) ; un membre présent à l'ouverture du journal (septembre 2026) n'a pas
  de date d'arrivée réelle.
- **Chaîne de commandement** : supérieurs en service actif de son corps, à
  partir de Sergent-Chef ; puis l'État-Major, sauf pour l'État-Major et le Hird
  du Jarl ; puis le sommet, quel que soit son corps : le Jarl, ou sous régence
  le ou les Régents impériaux (« Régence impériale »). Le Huscarl n'entre dans
  la chaîne de personne, et la sienne ne compte que le Jarl (vide sous
  régence) ; le Jarl et le Régent impérial n'en ont pas, et leur solde ne
  figure pas à la fiche. Chaque supérieur ouvre sa propre fiche.
- **Justice** : amendes dressées (nombre, total), à encaisser (non payées,
  montant fixé ou à déterminer), à reverser (payées, non reversées), cinq
  dernières ; incarcérations prononcées, détenus encore en cellule, cinq
  dernières.

## Amendes

- GARDE et OFFICIER peuvent consulter / créer ; connecté par Discord, à son propre nom (voir « Saisie à son propre nom »).
- La liste des gardes provient de `Données!O2:O`, dérivée des membres actifs d'`Effectifs`.
- Seul un OFFICIER peut modifier `Reversé aux trésoriers`.
- Pour chaque amende, le destinataire du reversement est calculé dynamiquement. Les corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major utilisent tous les collecteurs actifs de Cité de Blancherive et d'État-Major ; les autres corps, Faubourgs compris, utilisent leurs collecteurs actifs puis ceux d'État-Major en repli. Les collecteurs sont affichés avec leur grade. La spécialité `Collecteur de la garde` est recherchée parmi toutes les valeurs du chip. L'absence de collecteur est affichée explicitement.
- Couleurs des lignes : rouge si non payée, gris si payée mais non reversée, vert si payée et reversée.
- OFFICIER peut supprimer une entrée.
- La suppression applicative efface le contenu de l'entrée mais doit préserver la structure de la feuille.
- `Payé` et `Reversé` sont liés : conserver la logique actuelle lors de toute refonte.

## Prison

- GARDE et OFFICIER peuvent consulter / créer.
- La liste des gardes provient de `Données!O2:O`, dérivée des membres actifs d'`Effectifs`.
- OFFICIER peut supprimer une entrée.

### Sortie de détention (décision du propriétaire, 7 novembre 2026)

- La sortie d'un détenu est un **acte**, prononcé depuis le registre
  (`prononcerSortiePrison`), jamais une case cochée. Il porte une issue, la
  date et l'heure effectives, le garde signataire et un **motif obligatoire**,
  quelle que soit l'issue.
- Issues (`PRISON_ISSUES`, `Prison.js`, liste fermée dans le code) :
  libération, libération anticipée, transfert à l'Empire, transfert au
  Thalmor, transfert à une châtellerie (nom de la châtellerie exigé),
  transfert à un ordre (nom de l'ordre exigé), évasion, décès en détention.
- Tout transfert exige le nom de la **personne à qui le détenu est remis**
  (« Remis à »). Les deux transferts nommés exigent en plus la destination.
- GARDE et OFFICIER prononcent toutes les issues, transferts compris.
- Une libération prononcée avant la sortie prévue (`Prison!H`) est enregistrée
  comme libération anticipée. La sortie ne peut pas précéder l'entrée.
- Le garde signataire est celui de la session Discord, imposé par le serveur
  (`imposerGardeSession_`) ; par code commun, il se choisit dans `Données!O`
  et doit y figurer. L'identité de ligne affichée (garde, détenu) est exigée,
  comme pour la modification.
- Une incarcération close ne se prononce pas deux fois : un **OFFICIER**
  annule d'abord la sortie (`annulerSortiePrison`, motif obligatoire). Le
  détenu redevient en cellule, les colonnes de sortie sont vidées, le journal
  garde l'acte annulé. Une ligne antérieure cochée sans acte s'annule de même.
- Les **notes** s'ajoutent au journal (`ajouterNotePrison`, GARDE et
  OFFICIER), datées et signées ; aucune ne se modifie ni ne s'efface. La
  colonne `Motif / Notes` (K) reste le motif d'incarcération, modifiable par
  l'officier via le formulaire.
- Le registre affiche l'état (en cellule, libéré, transféré…) et, dans la
  ligne de détail, l'acte de sortie puis le journal. Une ligne antérieure
  cochée sans acte s'affiche « Libéré (sans détail) » ; aucune migration.
- La fiche de service compte les détenus transférés (`transferes`) à partir
  de l'issue ; « encore en cellule » reste lu sur `Libéré`.
- Choix de la cellule : texte libre, avec les cellules 1 à 4 du plan de
  Fort Dragon proposées en suggestion et sur un plan cliquable
  (`ui/src/cellules.jsx`, croquis du propriétaire embarqué, salles en
  quinconce et portes relevées, entrée et sortie en doré). Les lettres A à H
  du croquis sont des coffres : jamais proposées (décision du propriétaire,
  7 novembre 2026). Le serveur n'en vérifie rien.
- Les objets saisis sont sélectionnés dans le catalogue, avec une quantité entière
  strictement positive. Plusieurs ajouts du même ID cumulent les quantités.
- Maximum 100 objets différents ; quantités et sommes doivent être des entiers
  JavaScript sûrs, JSON limité à 45 000 caractères pour tenir dans une cellule.
- Les objets et noms sont revalidés côté serveur à chaque création. Un objet retiré
  du catalogue ne peut plus être ajouté ; les saisies historiques restent lisibles.
- Une recherche ou sélection encore en cours doit être ajoutée ou effacée avant
  de soumettre le formulaire. Aucun objet n'est ajouté implicitement.
- Les anciennes saisies textuelles sont conservées. Un ancien formulaire ouvert
  envoyant encore du texte non vide doit être actualisé.
- Pas de registre séparé ni de suivi de restitution dans cette version.
- Le catalogue des objets est préchargé à l'ouverture de la page Prison et gardé
  dans le navigateur avec sa version : l'autocomplétion cherche en mémoire et
  répond immédiatement. Une recherche au serveur relit toute la feuille `Objets`
  à chaque frappe, ce qui prenait plusieurs secondes. Le serveur ne renvoie les
  fiches que si la version a changé ; tant que le cache n'est pas disponible,
  la recherche retombe sur le serveur. Les objets restent revalidés côté
  serveur à l'enregistrement : le cache n'est qu'un confort de saisie.

## Inventaire

La page répond à une question d'intendance : avons-nous encore des torches,
et dans quel coffre ? Elle liste les objets présents dans les coffres de la
garde à Fort-Dragon.

- OFFICIER consulte et écrit. INTENDANT consulte seulement : c'est le rôle
  remis à l'intendance de la cour, qui doit savoir ce que la garde possède sans
  pouvoir le modifier. GARDE ne voit pas la page, ni en lecture ni en écriture :
  la navigation ne la propose pas, le routage ne la rend pas, et chaque fonction
  serveur refuse son rôle.
- Un coffre porte un nom, une position dans le monde (texte libre) et une
  description. Le nom est unique. Les officiers créent et modifient les coffres ;
  aucune suppression de coffre par l'application.
- Un objet n'apparaît qu'une fois par coffre. Ranger un objet déjà présent
  augmente sa quantité ; retirer la diminue ; à zéro, la ligne disparaît. On ne
  descend jamais sous zéro : le message indique la quantité disponible.
- Le formulaire « Ranger un objet » constitue une liste d'attente hors ligne :
  on y ajoute les objets l'un après l'autre sans appel serveur, puis « Ranger »
  les envoie tous, dans un seul coffre, en une seule requête et une seule
  écriture. Cent objets différents au plus par envoi ; les doublons de la liste
  sont fusionnés ; un lot dont un seul objet est refusé n'écrit rien. Une
  recherche ou une sélection encore en cours doit être ajoutée ou effacée avant
  d'envoyer, comme dans le formulaire de la Prison.
- Les objets viennent du même catalogue `Objets` que les saisies de la Prison,
  par la même recherche (trois caractères, quinze suggestions), avec les mêmes
  raccourcis (or, crochets, torches) et la même saisie libre pour un objet hors
  catalogue. Le nom est figé à l'entrée en stock : renommer le catalogue ne
  renomme pas les stocks existants. Le nom envoyé par le navigateur n'est jamais
  pris pour un objet du catalogue ; la fiche fait foi.
- Un objet se déplace d'un coffre à un autre par la liste déroulante de sa ligne.
  Toute la pile est déplacée ; si le coffre de destination contient déjà cet
  objet, les quantités s'additionnent.
- Une ligne dont le coffre a disparu de la feuille reste visible sous « Coffre
  inconnu » et se déplace comme les autres. Un stock ne disparaît pas de
  l'inventaire parce qu'une ligne de `Coffres` a été effacée à la main.
- Le tableau se filtre par coffre — en cliquant une carte de coffre ou par la
  liste — et par recherche sur le nom ou l'ID. Le compte affiché suit le filtre.
- Les boutons + / − d'une ligne cumulent les clics et n'envoient qu'une seule
  variation après une pause de 600 ms : ajouter cinq torches se fait en cinq
  clics rapides, sans attendre cinq réponses du serveur. La quantité affichée
  est immédiatement la quantité visée, grisée tant qu'elle n'est pas confirmée ;
  on ne peut pas descendre sous zéro. Pendant qu'une ligne a une variation en
  attente ou en vol, son déplacement et son retrait sont désactivés.
- Le catalogue des objets est préchargé à l'ouverture de la page pour l'officier
  seulement — l'intendant n'a pas de formulaire — selon le même mécanisme que la
  Prison.
- Aucun lien automatique avec les saisies de la Prison : une saisie n'entre pas
  d'elle-même dans un coffre, et une restitution n'en sort rien. Ce rattachement
  serait une décision métier à prendre explicitement.

## Permis de chasse

Demande du propriétaire, 2 novembre 2026. La page dit qui a le droit de
chasser sur les terres de la châtellerie.

- GARDE et OFFICIER consultent et délivrent. Seul l'OFFICIER révoque : le code
  des gardes ne retire aucune entrée. INTENDANT et le visiteur public n'y ont
  pas accès ; la navigation ne la propose pas, le routage ne la rend pas, et
  chaque fonction serveur refuse leur rôle.
- Une entrée porte le prénom, le nom (facultatif : bien des habitants n'en ont
  pas) et la date de délivrance, et rien d'autre. Le garde qui délivre n'est
  pas noté (décision du propriétaire).
- Un permis vaut à vie : pas d'échéance, pas de renouvellement. Il ne cesse
  que par révocation, qui retire la ligne du registre ; la personne peut
  recevoir un nouveau permis ensuite.
- Une même personne n'a qu'un permis : un second enregistrement au même
  prénom et nom, sans casse ni accents, est refusé en nommant le permis
  existant et sa date. Deux homonymes se distinguent par leur nom.
- La date de délivrance est celle du jour par défaut et ne peut pas être dans
  l'avenir ; une date passée est acceptée pour inscrire un permis ancien.
- La recherche se fait par prénom, le nom compris, mot par mot, sans casse ni
  accents, dans le navigateur. Le registre est trié du plus récent au plus
  ancien, puis par prénom et nom.
- La révocation exige l'identité affichée de la ligne : une page restée
  ouverte pendant qu'un autre garde a modifié le registre ne révoque jamais un
  autre permis que celui qu'elle montre.

## Codex

- Les documents juridiques restent la source de vérité.
- `SyncCodex` est un cache technique généré.
- Les listes d'infractions d'Amendes / Prison sont dérivées du cache du Codex.
- Les identités des gardes ne doivent pas être stockées dans `SyncCodex`.
- **Nouveautés** (décision du propriétaire, 1er novembre 2026) : chaque synchronisation note ce qu'elle a changé — lois nouvelles, modifiées (avec les champs touchés et la différence du texte), retirées (leur dernier texte reste lisible), documents ajoutés ou retirés — et tous ceux qui consultent le Codex en sont prévenus, visiteur compris : bandeau en tête de page depuis la dernière visite, bouton « Nouveautés » avec le nombre de changements non vus, puces « Nouveau » et « Modifié » sur les articles des quatorze derniers jours. Un article est le même d'une synchronisation à l'autre par sa source et son numéro : un titre corrigé est une modification. Un document que la synchronisation n'a pas pu lire garde ses articles et n'est pas annoncé retiré ; il est signalé aux officiers.
- **Synchronisation depuis le registre** (même décision) : un officier peut la lancer depuis les Nouveautés, au plus une fois toutes les trois minutes pour ce bouton, et suit les traces du serveur en direct ; l'éditeur Apps Script n'est pas soumis à ce délai.
- Depuis le 27 septembre 2026, le droit de la châtellerie est constitué des quatre codes adoptés par la Cour de Blancherive (Loi fondamentale, Code pénal local, Code civil local, Code du commerce local). L'ancien Codex Judiciaire est caduc : il ne figure plus au Codex et ne fonde plus aucune sanction nouvelle. Les amendes et incarcérations enregistrées sous son empire restent inchangées.
- Le Code pénal local qualifie ses infractions (contravention, délit, crime) sans chiffrer les peines, qu'il renvoie au barème impérial (contravention jusqu'à 100 septims, délit jusqu'à 500, crime jusqu'à 1 000 depuis la révision impériale lue le 3 novembre 2026 ; auparavant 500, 2 500 et au-delà). Depuis le 29 septembre 2026, ses articles sont cités comme chefs d'accusation et la sentence est laissée à l'appréciation de l'autorité, le barème n'étant qu'un rappel. Décision du 4 octobre 2026 : un barème article par article, dans ces fourchettes, est tenu dans la feuille `PeinesAmendes` et proposé par les formulaires sans être imposé (voir « Décrets de peines et amendes »). L'imposer côté serveur reste une décision métier à prendre explicitement.
