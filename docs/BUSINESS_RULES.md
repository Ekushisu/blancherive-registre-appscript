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
- Les coûts estimés par corps et semaine sont affichés uniquement aux OFFICIER ; ils incluent toutes les soldes du corps, déjà payées ou non, indépendamment de la recherche.
- Le cumul des amendes dans le tableau de bord OFFICIER porte sur les amendes datées de la semaine courante, du lundi au dimanche, et cochées Payé et Reversé. La date de reversement n'est pas suivie.
- Le Hird du Jarl est exclu des présences, des calculs de solde et de la surveillance d'inactivité. Les lignes historiques ne sont pas supprimées.
- Le barème journalier est défini par grade dans `SoldesGrades`. Initialisation : Commander (alias Commandant) à 100 septims ; autres grades à l'ancienne base `Vue globale!L2` (50 actuellement), sauf Recrue à 0 et Aspirant-Garde à la moitié (25 actuellement). Le Hird reste à 0 quel que soit le tarif du grade.
- Les changements de barème s'appliquent à toute la semaine courante et aux suivantes, selon le grade enregistré dans Présences. Les semaines passées gardent leur tarif, même après régénération/réparation. Corriger un pointage historique utilise sa formule historique lorsqu'elle existe ; un montant saisi manuellement reste inchangé.
- Le tarif journalier est figé numériquement dans la formule de solde. La migration remplace les références historiques à `Vue globale!L2` par sa valeur initiale ; modifier ensuite cette ancienne cellule ne modifie plus les semaines migrées.
- Les données historiques de présence ne doivent pas être détruites par une synchronisation d'effectifs.
- L'ajout d'un effectif et toute modification de son statut régénèrent la semaine courante de Présences.
- Les autres modifications d'Effectifs ne régénèrent pas automatiquement les Présences.
- Toute politique de traitement d'un changement de statut en cours de semaine doit être décidée explicitement avant implémentation.

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

## Codex

- Les documents juridiques restent la source de vérité.
- `SyncCodex` est un cache technique généré.
- Les listes d'infractions d'Amendes / Prison sont dérivées du cache du Codex.
- Les identités des gardes ne doivent pas être stockées dans `SyncCodex`.
