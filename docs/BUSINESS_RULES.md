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

## Présences

- GARDE : lecture seule.
- OFFICIER : modification des jours et du paiement.
- INTENDANT : aucun accès à cette page ; il ne voit que la synthèse de la Paye.
- Les coûts estimés par corps et semaine sont affichés uniquement aux OFFICIER ; ils incluent toutes les soldes du corps, déjà payées ou non, indépendamment de la recherche.
- Le cumul des amendes dans le tableau de bord OFFICIER porte sur les amendes datées de la semaine courante, du lundi au dimanche, et cochées Payé et Reversé. La date de reversement n'est pas suivie.
- Le Hird du Jarl est exclu des présences, des calculs de solde et de la surveillance d'inactivité. Les lignes historiques ne sont pas supprimées.
- Les décrets de la châtellerie sont promulgués et abrogés par dépôt et retrait d'un Google Doc dans le dossier Drive déclaré par `SYNC_CODEX_FOLDERS`. Le dossier fait autorité : la synchronisation suivante reflète son contenu exact. Un décret retiré cesse d'apparaître au Codex et d'être proposé dans les formulaires ; les amendes et incarcérations déjà enregistrées sous ce décret restent inchangées.
- Un article de décret n'est proposé dans les formulaires Amendes ou Prison que s'il porte une sanction chiffrée. Les décrets purement réglementaires restent consultables sans encombrer les listes.
- Le droit impérial est consultable mais n'alimente jamais les formulaires : la Garde sanctionne sur le fondement du droit de la châtellerie.
- Le barème journalier est défini par grade dans `SoldesGrades`. Initialisation : Commander (alias Commandant) à 100 septims ; autres grades à l'ancienne base `Vue globale!L2` (50 actuellement), sauf Recrue à 0 et Cadet à la moitié (25 actuellement). Le Hird reste à 0 quel que soit le tarif du grade.
- Le grade `Aspirant-Garde` a été supprimé le 15 septembre 2026 et remplacé par `Cadet`, à tarif identique. Les lignes de Présences antérieures conservent l'ancien nom et leurs formules d'origine ; elles ne doivent pas être renommées. Une feuille `SoldesGrades` déjà créée garde sa ligne `Aspirant-Garde` : il faut y ajouter ou y renommer une ligne `Cadet`, sans quoi les Cadets sont facturés au tarif `Par défaut` au lieu de la moitié.
- Les changements de barème s'appliquent à toute la semaine courante et aux suivantes, selon le grade enregistré dans Présences. Les semaines passées gardent leur tarif, même après régénération/réparation. Corriger un pointage historique utilise sa formule historique lorsqu'elle existe ; un montant saisi manuellement reste inchangé.
- Le tarif journalier est figé numériquement dans la formule de solde. La migration remplace les références historiques à `Vue globale!L2` par sa valeur initiale ; modifier ensuite cette ancienne cellule ne modifie plus les semaines migrées.
- Les données historiques de présence ne doivent pas être détruites par une synchronisation d'effectifs.
- L'ajout d'un effectif et toute modification de son statut régénèrent la semaine courante de Présences.
- Les autres modifications d'Effectifs ne régénèrent pas automatiquement les Présences.
- Toute politique de traitement d'un changement de statut en cours de semaine doit être décidée explicitement avant implémentation.

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
  `estImpayePresence` : solde due et non réglée. Les deux pages doivent rester
  d'accord, sans quoi un badge de semaine et une demande de budget se
  contrediraient.
- Le règlement se fait une semaine et un garde à la fois : cocher une semaine
  écrit `Présences!O` de cette ligne, rien d'autre. Il n'existe pas de règlement
  en bloc. La ligne réglée quitte la liste des impayés ; elle reste visible dans
  « Réglé à l'instant » le temps de la session, avec une annulation, afin qu'une
  erreur de ligne se rattrape sans passer par la feuille.
- Un récapitulatif en texte brut reprend l'ordre de l'écran, montant d'abord et
  justification ensuite, pour être lu ou remis au financeur.
- GARDE n'a pas accès à cette page. INTENDANT la consulte sans pouvoir cocher.

## Amendes

- Les formulaires Amendes et Prison proposent les valeurs chiffrées identifiées
  dans le texte de sanction avec leur contexte ; plusieurs valeurs nécessitent un
  choix explicite. La saisie libre est disponible lorsque la sanction est
  explicitement laissée à l’appréciation ou à la fixation de l’autorité.
- Un mode « Motif personnalisé » permet aux GARDE et OFFICIER de saisir une
  référence de décret/décision absente du Codex (1 à 1 000 caractères) et une
  sanction positive : montant entier en septims ou durée en heures, fraction admise.
- Les choix du Codex sont revalidés côté serveur. Une alerte de parsing ou une
  peine non numérique n’autorise pas à elle seule la saisie libre. Les articles
  sans valeur exploitable ni appréciation explicite ne sont plus proposés.
- Les montants et durées enregistrés sont des instantanés conservés après une
  modification du Codex. Les conditions de récidive et les autres conditions
  restent appréciées par l’utilisateur à la lecture du texte affiché.

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

## Codex

- Les documents juridiques restent la source de vérité.
- `SyncCodex` est un cache technique généré.
- Les listes d'infractions d'Amendes / Prison sont dérivées du cache du Codex.
- Les identités des gardes ne doivent pas être stockées dans `SyncCodex`.
