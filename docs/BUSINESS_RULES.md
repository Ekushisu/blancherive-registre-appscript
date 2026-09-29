# Règles métier

## Organigramme

- Chaîne verticale : Jarl → Maréchal → Commander → Majors du corps État-Major.
- Le Hird répond uniquement au Jarl, par une branche directe indépendante du reste de la garde.
- Les Majors actifs de Rivebois et Bois-de-Chêne forment un commandement commun sous les ordres directs de l'État-Major central. Ces deux garnisons dépendent de ce commandement intermédiaire, y compris lorsque les postes de Major sont vacants.
- Cité de Blancherive, Faubourgs, Éclaireurs et Cap Granite répondent directement à l'État-Major central. Les Capitaines restent en tête de chaque corps / garnison.
- Les autres Majors actifs hors État-Major et hors commandement de Rivebois / Bois-de-Chêne sont regroupés à part en bas, à côté de la Réserve.
- Tous les réservistes, quel que soit leur grade ou corps, apparaissent uniquement dans la Réserve commune.

## Effectifs

- Page accessible uniquement aux OFFICIER.
- Un officier peut ajouter un membre.
- Un officier peut modifier :
  - grade ;
  - corps ;
  - spécialité ;
  - statut ;
  - assermentation.
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
- Les modifications manuelles Sheets sont journalisées lors du déclencheur d'édition ou, en repli, à la prochaine consultation. La date est celle de la détection ; plusieurs changements entre deux détections peuvent être regroupés. Les changements de nom ou statut actualisent la référence sans badge dédié dans cette version.
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
- Le Hird du Jarl est exclu des présences, des calculs de solde et de la surveillance d'inactivité. Les lignes historiques ne sont pas supprimées.
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

- Financeurs. L'argentier de la cour couvre Cité de Blancherive, Éclaireurs et
  État-Major ; un Thane couvre chacune des garnisons de Rivebois, Bois-de-Chêne,
  Faubourgs et Cap Granite. C'est la même coupure centrale / locale que le
  reversement des amendes.
- Le rattachement se fait par jeton distinctif recherché dans le libellé du corps,
  et non par égalité, afin d'accepter « Rivebois » comme « Garnison de Rivebois ».
  Le jeton « blancherive » seul n'est jamais utilisé : la Cité et les Faubourgs le
  portent tous les deux et ne dépendent pas du même financeur.
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
  jusqu'à 500 septims, délit de 500 à 2 500, crime au-delà) est rappelé à titre
  indicatif, jamais imposé. Les montants ou durées que citent encore certains
  articles sont proposés en raccourcis, sans contrainte.
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

## Modification d'une amende ou d'une incarcération

- Réservée aux **OFFICIER**, comme la suppression. Tout ce que le formulaire de
  création saisit se modifie : date, garde, contrevenant ou détenu, chefs
  d'accusation, montant ou durée, et pour la Prison la cellule, l'entrée, les
  saisies et les notes. La sortie prévue est recalculée.
- Les cases Payé, Reversé et Libéré ne changent pas par ce chemin : elles
  gardent leur commande dans le registre et leur règle de rôle.
- La ligne n'est réécrite que si elle porte encore le garde et le contrevenant
  (ou le détenu) que l'officier avait sous les yeux ; sinon le serveur refuse
  et demande de recharger. Le numéro de ligne seul ne désigne pas une entrée.
- Une entrée antérieure à cette version se modifie aussi ; ses chefs deviennent
  structurés à l'enregistrement. Ses saisies en texte libre, que le formulaire
  ne sait pas rééditer, restent intactes.

## Amendes

- GARDE et OFFICIER peuvent consulter / créer.
- La liste des gardes provient de `Données!O2:O`, dérivée des membres actifs d'`Effectifs`.
- Seul un OFFICIER peut modifier `Reversé aux trésoriers`.
- Pour chaque amende, le destinataire du reversement est calculé dynamiquement. Les corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major utilisent tous les collecteurs actifs de Cité de Blancherive et d'État-Major ; les autres corps utilisent leurs collecteurs actifs puis ceux d'État-Major en repli. Les collecteurs sont affichés avec leur grade. La spécialité `Collecteur de la garde` est recherchée parmi toutes les valeurs du chip. L'absence de collecteur est affichée explicitement.
- Couleurs des lignes : rouge si non payée, gris si payée mais non reversée, vert si payée et reversée.
- OFFICIER peut supprimer une entrée.
- La suppression applicative efface le contenu de l'entrée mais doit préserver la structure de la feuille.
- `Payé` et `Reversé` sont liés : conserver la logique actuelle lors de toute refonte.

## Prison

- GARDE et OFFICIER peuvent consulter / créer.
- La liste des gardes provient de `Données!O2:O`, dérivée des membres actifs d'`Effectifs`.
- OFFICIER peut supprimer une entrée.
- `Libéré` est modifiable depuis le registre.
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

## Codex

- Les documents juridiques restent la source de vérité.
- `SyncCodex` est un cache technique généré.
- Les listes d'infractions d'Amendes / Prison sont dérivées du cache du Codex.
- Les identités des gardes ne doivent pas être stockées dans `SyncCodex`.
- Depuis le 27 septembre 2026, le droit de la châtellerie est constitué des quatre codes adoptés par la Cour de Blancherive (Loi fondamentale, Code pénal local, Code civil local, Code du commerce local). L'ancien Codex Judiciaire est caduc : il ne figure plus au Codex et ne fonde plus aucune sanction nouvelle. Les amendes et incarcérations enregistrées sous son empire restent inchangées.
- Le Code pénal local qualifie ses infractions (contravention, délit, crime) sans chiffrer les peines, qu'il renvoie au barème impérial (contravention jusqu'à 500 septims, délit de 500 à 2 500, crime au-delà). Depuis le 29 septembre 2026, ses articles sont cités comme chefs d'accusation et la sentence est laissée à l'appréciation de l'autorité, le barème n'étant qu'un rappel. Chiffrer les sanctions dans le texte, ou imposer un barème par qualification dans l'application, reste une décision métier à prendre explicitement.
