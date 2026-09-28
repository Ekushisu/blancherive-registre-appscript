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

### Barème des soldes

- Ancienne base commune : `Vue globale!L2`, référencée autrefois par les formules de `Présences!N`. Recrue : 0 ; Aspirant-Garde : moitié de cette base ; Hird : 0. `Aspirant-Garde` n'existe plus depuis le 15 septembre 2026, mais reste inscrit dans les formules et les lignes de Présences historiques.
- La feuille `Vue globale` date d'avant l'application : calculs manuels (coûts, impayés, absents) que l'application refait de son côté. Archivée par le propriétaire le 28 septembre 2026 : `SoldesGrades` est initialisée et plus aucune formule de `Présences!N` ne référence `L2`, donc le code ne la lit plus. Ne pas la recréer ni y référencer de nouvelles formules.
## SyncCodex — cache technique

- `A:J` articles extraits ; `L:O` listes d'infractions des formulaires.
- `R:W` métadonnées des documents synchronisés : Source, Famille, Autorité, Applicabilité, Local, Lien. Écrit par `ecrireCacheDocumentsCodex_()` et relu par `Codex.js`. Ce bloc existe pour les décrets déposés dans un dossier Drive, qui ne figurent dans aucune déclaration du code : sans lui, chaque consultation du Codex devrait lister le dossier.
- L'ensemble est régénéré par `synchroniserCodex()` et ne doit pas être édité à la main.

- Nouvelle feuille `SoldesGrades`, créée automatiquement : A `Grade`, B `Solde journalière (septims)`. Une ligne `Par défaut` reprend l'ancienne base ; les grades de `Données!A2:A` sont initialisés au tarif précédent, sauf Commander (alias Commandant), à 100. Recrue et Cadet restent respectivement à 0 et à la moitié de l'ancienne base lors de l'initialisation. L'initialisation n'a lieu que sur une feuille vide : une feuille existante n'acquiert pas de ligne `Cadet` toute seule.
- Les valeurs de `SoldesGrades` sont modifiables dans Sheets. Le Hird reste exclu indépendamment du barème. Aucun déplacement ni réemploi de colonne technique de Présences ou Données.
- La formule N de la semaine courante contient le tarif journalier numérique du grade de la ligne, multiplié par M. Le barème est appliqué au chargement des Présences/du tableau de bord et lors des générations/réparations de formules.
- Les anciennes références à `Vue globale!L2` des semaines passées sont remplacées par sa valeur au moment de la migration, sans modifier le résultat. Les autres formules et montants historiques sont conservés. Les formules sont restaurées en R1C1 lors des réordonnancements de lignes, pour conserver leurs références relatives.

Colonnes A:O :

| Colonne | Contenu |
|---|---|
| A | Lundi de la semaine ISO, texte `yyyy-MM-dd` |
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

La colonne A (en-tête « Lundi ») porte le lundi de la semaine ISO en texte `yyyy-MM-dd`, fuseau Europe/Stockholm, colonne au format texte brut `@` posé sur toutes les lignes à chaque régénération. Le texte ne dépend ni du format de cellule ni du fuseau du classeur, et porte l'année. Jusqu'au 28 septembre 2026 la colonne contenait un numéro de semaine sans année ; toute lecture passe encore par `normaliserLundiPresence_` (Presences.js), qui ramène au lundi ISO un ancien numéro, une cellule au format date, un numéro de série ou un autre jour de la semaine, et conserve tel quel un texte non reconnu. `migrerPresencesVersLundis()` convertit explicitement la colonne A, après `inventorierReferencesSemainePresences()` pour les formules du classeur qui la lisent. Ne jamais écrire d'objet `Date` ni de nombre en colonne A.

La mise en forme conditionnelle de A:O et les séparateurs de semaine sont posés par la génération, sur toute la hauteur de la feuille : orange pour la semaine courante, rouge pour une semaine passée impayée à solde due, gris pour une semaine passée réglée ou sans solde ; trait plein sous la dernière ligne de chaque semaine, pointillé à chaque changement de corps. Les règles conditionnelles de la feuille sont remplacées à chaque régénération : ne pas en poser à la main dans Présences.

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

La colonne J conserve les anciennes saisies en texte libre. Les nouvelles saisies
sont une chaîne JSON : `[{"id":"skyrim.esm|00000F","nom":"Or","quantite":9000}]`.
Le nom est un instantané lu dans Objets à l'enregistrement ; il reste inchangé si
le catalogue est renommé. Une liste vide est stockée sous la forme `[]`.
Les listes structurées sont affichées en lignes « Nom × quantité » dans la Web App.
Les cellules historiques ou non reconnues comme liste structurée restent affichées
en texte. Aucun déplacement de colonne et aucune conversion des anciennes lignes.

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

## Objets

Feuille créée automatiquement à la première recherche d'au moins trois caractères,
uniquement si elle n'existe pas. A:C : `ID objet`, `Nom`, `Type` ; valeurs textuelles,
10 131 fiches initiales. L'ID complet contient le plugin et l'identifiant local,
par exemple `skyrim.esm|013989` ; ne pas utiliser uniquement la partie numérique.
Les IDs doivent rester uniques sans distinction de casse. Les en-têtes et leur
ordre sont contrôlés. Une feuille existante n'est jamais remplacée ni réimportée,
même si elle est vide ; les noms et types peuvent être modifiés dans Sheets.

`docs/catalogue-objets/Objets.csv` est l'export à trois colonnes.
`src/CatalogueObjets.html` est la ressource JSON générée pour initialiser la feuille,
chargée côté serveur uniquement à sa création ; elle n'est pas incluse dans Index.
Le catalogue initial reste un catalogue technique candidat, sans certification de
disponibilité des objets sur le serveur de jeu.

## Coffres

Feuille créée automatiquement, avec ses en-têtes, à la première consultation de
la page Inventaire si elle n'existe pas. Une feuille existante n'est jamais
réécrite ; des en-têtes différents arrêtent la page avec un message explicite.

| Colonne | Contenu |
|---|---|
| A | ID coffre — UUID technique, attribué à la création, jamais affiché |
| B | Nom — unique sans distinction de casse ni d'accents, 100 caractères maximum |
| C | Position — texte libre décrivant l'emplacement dans le monde, 200 caractères maximum |
| D | Description — texte libre, 1 000 caractères maximum |

Le coffre est référencé par son identifiant dans `Inventaire` : renommer un
coffre ne touche pas à son contenu. Effacer une ligne de `Coffres` à la main
n'efface pas ses objets ; ils apparaissent sous « Coffre inconnu » et peuvent
être déplacés vers un coffre réel depuis la page. Aucune suppression de coffre
par l'application dans cette version.

## Inventaire

Feuille créée automatiquement dans les mêmes conditions que `Coffres`.

| Colonne | Contenu |
|---|---|
| A | ID coffre — référence à `Coffres!A` |
| B | ID objet — ID complet du catalogue `Objets` (`skyrim.esm|01D4EC`), vide pour un objet hors catalogue |
| C | Nom — instantané du nom au moment de l'entrée en stock, comme dans `Prison!J` |
| D | Quantité — entier strictement positif |

Un objet n'occupe qu'une ligne par coffre. La clé d'unicité est l'ID objet en
minuscules pour le catalogue, ou le nom normalisé (casse, accents, espaces)
pour un objet hors catalogue. Le bloc A:D est relu et réécrit en entier à chaque
écriture, sous verrou de script : une quantité ramenée à zéro retire la ligne et
le bloc est compacté, sans ligne fantôme. Colonnes A:C en format texte, D en
nombre. Une ligne invalide — coffre ou nom vide, quantité non entière ou nulle —
bloque la page en nommant sa ligne physique, plutôt que d'être ignorée en
silence.

## SyncCodex

Le snapshot courant documente encore les colonnes techniques :

| Colonne | Contenu |
|---|---|
| L | Dropdown Amende |
| M | Choix d’amende JSON version 1 (ancien montant numérique encore lisible) |
| N | Dropdown Prison |
| O | Choix de cachot JSON version 1 (ancienne durée numérique encore lisible) |

La colonne P n'est plus utilisée pour les gardes. Une synchronisation du Codex efface l'ancien cache `SyncCodex!P` et ses validations éventuelles.

Les cellules M et O contiennent désormais `{version:1, options:[{value,label}], libre, texte}`.
`value` est un montant en septims ou une durée de cachot en heures ; `label` conserve
le contexte de la sanction. `libre` n’est activé que sur une mention explicite
d’appréciation ou de fixation par une autorité dans le texte de sanction.
Les colonnes A:J conservent leur structure et leur texte complet ; les nombres
uniques restent numériques. L’API Codex expose aussi `montants` et `dureesCachot`.
Les titres de sections numérotés sont exclus du texte et des sanctions des articles.

Les valeurs choisies sont enregistrées dans Amendes!E et Prison!F ; Prison!H est
calculée depuis cette durée. Aucune réécriture des entrées historiques.
Les motifs hors Codex sont enregistrés avec le préfixe `Motif personnalisé —`
dans Amendes!D ou Prison!E. Seule la validation de cette cellule est retirée pour
l’entrée personnalisée ; elle est restaurée avec les valeurs en cas d’échec.
Aucune colonne déplacée ou ajoutée.
