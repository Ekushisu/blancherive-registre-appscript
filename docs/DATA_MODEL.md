# Modèle de données

Ce document décrit uniquement ce qui est confirmé par le snapshot courant.

## Effectifs

Le code Web détecte les colonnes par en-tête et reconnaît notamment :
- `Prénom`
- `Nom`
- `Grade`
- `Corps` / `Corps de garde`
- `Spécialité`
- `Status` / `Statut`
- `Assermenté`

`Données!A2:A` sert de référence pour :
- l'ordre hiérarchique des grades ;
- le style/couleur associé aux grades dans la Web App.

`Données!O2:O` contient la liste triée des gardes actifs utilisée par les formulaires Amendes et Prison. Cette liste est produite dans la feuille par la formule :

```gs
=SORT(FILTER(Effectifs!C2:C&" "&Effectifs!D2:D;Effectifs!C2:C<>"";Effectifs!G2:G="En service actif"))
```

Pour un garde sans nom de famille, cette formule conserve un espace final invisible. Les formulaires affichent un libellé nettoyé, mais le backend résout et écrit la valeur brute de `Données!O` afin de respecter exactement la validation de données des feuilles `Amendes` et `Prison`.

Statut actif :
- `En service actif`

Statut de réserve :
- `Réserve`

Groupes terminaux reconnus :
- Morts
- Radiés
- Démissionnaires
- Déserteurs

## Suivi des changements d'Effectifs

- `Effectifs` : colonne technique `ID membre` ajoutée après la dernière colonne utilisée, sans déplacer de colonne. UUID attribué aux membres et conservé lors des tris de lignes complètes. Ne pas modifier cette colonne ; inclure celle-ci dans les tris et déplacements manuels. Un UUID dupliqué est réattribué aux occurrences suivantes.
- `HistoriqueEffectifs` : feuille créée automatiquement. Colonnes A:H : `ID événement`, `Date ISO`, `ID membre`, `Type`, `Nom`, `Changements JSON`, `État JSON`, `Source`.
- `État JSON` conserve prénom, nom, grade, corps et statut pour comparer les états successifs. `Changements JSON` conserve les valeurs avant/après des arrivées, grades et corps. Les événements `reference` ne produisent pas de notification ; ils initialisent l'état ou suivent une modification non notifiée. Une ligne `initialisation` est écrite même si les effectifs sont vides.
- Journal ajouté par blocs, jamais purgé automatiquement. Seuls les événements des 14 derniers jours des membres encore présents sont transmis à l'interface. Le rôle GARDE ne reçoit que ceux des membres actifs ou réservistes, comme l'organigramme.
- Les états « Vu » sont conservés par ID événement dans le stockage local du navigateur, avec une durée de 14 jours. Ils ne sont ni communs à tous les officiers ni synchronisés entre appareils.

## Présences

Colonnes A:O :

| Colonne | Contenu |
|---|---|
| A | Semaine |
| B | Corps de garde |
| C | Grade |
| D | Prénom |
| E | Nom |
| F | Lun |
| G | Mar |
| H | Mer |
| I | Jeu |
| J | Ven |
| K | Sam |
| L | Dim |
| M | Jours présents |
| N | Solde |
| O | Payé |

Ne pas déplacer ni réutiliser les colonnes à partir de P sans vérifier les notes / données existantes de la feuille.

## Amendes

Colonnes A:G :

| Colonne | Contenu |
|---|---|
| A | Date |
| B | Garde |
| C | Contrevenant |
| D | Infraction |
| E | Montant |
| F | Payé |
| G | Reversé aux trésoriers |

## Prison

Colonnes A:K :

| Colonne | Contenu |
|---|---|
| A | Date |
| B | Garde |
| C | Détenu |
| D | Cellule |
| E | Infraction |
| F | Durée prévue |
| G | Heure d'entrée |
| H | Heure de sortie prévue |
| I | Libéré |
| J | Saisies sur la personne |
| K | Motif / Notes |

## SyncCodex

Le snapshot courant documente encore les colonnes techniques :

| Colonne | Contenu |
|---|---|
| L | Dropdown Amende |
| M | Montant |
| N | Dropdown Prison |
| O | Cachot (heures) |

La colonne P n'est plus utilisée pour les gardes. Une synchronisation du Codex efface l'ancien cache `SyncCodex!P` et ses validations éventuelles.
