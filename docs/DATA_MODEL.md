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

Statut actif :
- `En service actif`

Statut de réserve :
- `Réserve`

Groupes terminaux reconnus :
- Morts
- Radiés
- Démissionnaires
- Déserteurs

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
| P | Dropdown Garde |

Important : la feuille a récemment été modifiée manuellement pour que les validations de données des gardes puissent provenir d'une concaténation Prénom + Nom des Effectifs. Cependant, **le code du snapshot continue de lire `SyncCodex!P` pour alimenter les formulaires Amende et Prison**. Cette divergence est à traiter explicitement lors d'une prochaine modification ; ne pas supposer qu'elle est déjà corrigée côté code.
