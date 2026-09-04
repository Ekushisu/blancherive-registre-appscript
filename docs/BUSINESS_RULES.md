# Règles métier

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

## Présences

- GARDE : lecture seule.
- OFFICIER : modification des jours et du paiement.
- Les données historiques de présence ne doivent pas être détruites par une synchronisation d'effectifs.
- Ne pas exécuter automatiquement une reconstruction complète de la semaine lors d'une simple modification d'Effectifs.
- Toute politique de traitement d'un changement de statut en cours de semaine doit être décidée explicitement avant implémentation.

## Amendes

- GARDE et OFFICIER peuvent consulter / créer.
- OFFICIER peut supprimer une entrée.
- La suppression applicative efface le contenu de l'entrée mais doit préserver la structure de la feuille.
- `Payé` et `Reversé` sont liés : conserver la logique actuelle lors de toute refonte.

## Prison

- GARDE et OFFICIER peuvent consulter / créer.
- OFFICIER peut supprimer une entrée.
- `Libéré` est modifiable depuis le registre.

## Codex

- Les documents juridiques restent la source de vérité.
- `SyncCodex` est un cache technique généré.
- Les listes d'infractions d'Amendes / Prison sont dérivées du cache du Codex.
- Ne pas mélanger les données métier d'Effectifs avec le cache juridique sans nécessité.
