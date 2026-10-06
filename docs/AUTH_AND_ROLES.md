# Authentification et rôles

## Rôle public VISITEUR

`ouvrirSessionPublique()` délivre un jeton de rôle `VISITEUR` **sans mot de
passe**, pour la consultation du Codex. Durée deux heures, contre huit pour une
session de service.

La Web App s'exécute avec le compte du propriétaire et en accès anonyme : toute
personne qui charge la page peut appeler n'importe quelle fonction serveur.
`requireRole()` est le seul rempart. Jusqu'à l'introduction de ce rôle, ne pas
connaître de mot de passe suffisait à bloquer l'accès ; ce n'est plus vrai.

**`VISITEUR` ne doit donc figurer que dans la liste de rôles de `getCodex`.**
L'ajouter à une autre fonction la rendrait entièrement publique, sans erreur ni
signal. `scripts/test-acces-public.mjs` échoue si ce rôle apparaît ailleurs dans
`src/`, vérifie que le visiteur ne passe aucune autre liste de rôles, que son
jeton est bien signé et qu'il expire avant celui d'un membre de la Garde.

Côté interface, le visiteur ne voit que l'onglet Codex et les autres pages ne
sont pas rendues. Ce n'est qu'un confort d'affichage : la protection réelle est
côté serveur.


## Rôles UI

Quatre rôles :
- `GARDE`
- `OFFICIER`
- `INTENDANT`
- `VISITEUR`, décrit en tête de ce document : il ne relève pas de `login()` et
  reste cantonné à `getCodex`.

Il n'existe pas de rôle UI `COMMANDEMENT`.

`INTENDANT` est un rôle de consultation distribué **hors de la garde** : argentier
de la cour, Thanes des garnisons, cuisines de la cour. Il ne dispose d'aucun droit
d'écriture, sur aucune page.

## Authentification

`Auth.js` utilise des Script Properties :
- `PASSWORD_GARDE`
- `PASSWORD_OFFICIER`
- `PASSWORD_INTENDANT`
- `AUTH_SECRET`

Une propriété absente ne correspond jamais, y compris à un mot de passe vide :
tant que `PASSWORD_INTENDANT` n'est pas renseigné dans les Script Properties,
aucun code ne peut ouvrir de session `INTENDANT`. Les rôles sont testés du plus
au moins privilégié, afin que le résultat reste déterministe si deux codes ont
été réglés à la même valeur par erreur.

Le login renvoie un token contenant :
- le rôle ;
- une expiration.

Durée actuelle :
- 8 heures.

Le token est signé en HMAC SHA-256.

## Autorisations

Toujours vérifier côté serveur avec `requireRole()`.

Règles connues :

### GARDE
- Organigramme
- Présences en lecture seule
- Codex
- Décrets de peines et amendes, en lecture
- Amendes (création et statut `Payé`)
- Prison

### OFFICIER
- tout ce qui précède ;
- Effectifs ;
- édition Présences ;
- tableau de bord officier ;
- suppression Amendes ;
- modification d'une amende (`modifierAmende` : date, garde, contrevenant,
  chefs d'accusation, montant) ;
- modification du statut `Reversé` des Amendes ;
- suppression Prison ;
- modification d'une incarcération (`modifierPrison` : tout sauf la case
  Libéré) ;
- règlement d'une semaine depuis la page Paye ;
- inventaire des coffres : création et modification des coffres, quantités,
  rangement groupé, déplacements.

### INTENDANT
- Organigramme en lecture, comme un GARDE : c'est de là que les cuisines de la
  cour tirent l'effectif à nourrir ;
- page Paye en lecture seule ;
- page Inventaire en lecture seule : l'intendance de la cour doit savoir ce que
  la garde possède, sans pouvoir le modifier ;
- Codex et décrets de peines et amendes en lecture, depuis le 4 octobre 2026
  (décision du propriétaire) : `getCodex` et `getPeinesAmendes` acceptent son
  rôle.

Aucune autre page ne lui est accessible, ni Présences, ni Amendes, ni Prison,
ni Effectifs. À la différence de `VISITEUR`, `INTENDANT` s'obtient
par un mot de passe et n'ouvre aucune fonction au public. La navigation ne lui propose que ses cinq pages, et
chaque API refuse son rôle côté serveur.

Un contrôle uniquement côté React n'est jamais suffisant.

### Catalogue des objets

`rechercherObjets` et `getCatalogueObjets` autorisent GARDE et OFFICIER après
`requireRole()`, avant toute lecture ou initialisation Sheets. INTENDANT n'a
aucun formulaire d'objets et ne reçoit pas le catalogue ; le rôle public non plus. `ajouterPrison` vérifie le même rôle avant la
validation des objets. L'initialisation d'une feuille Objets absente est un helper
privé, sous verrou ; aucune API Web de remplacement ou d'import libre du catalogue.

## Amendes et Prison

`getAmendes`, `getAmendeFormData`, `ajouterAmende`, `getPrison`,
`getPrisonFormData` et `ajouterPrison` autorisent `GARDE` et `OFFICIER`.
`modifierAmende` et `modifierPrison` n'autorisent que `OFFICIER`, avant toute
ouverture du classeur, au même titre que `supprimerAmende` et
`supprimerPrison` : un garde qui se trompe demande la correction à un
officier. Les deux exigent en outre l'identité affichée de la ligne (`attendu`)
et refusent d'écrire si elle a changé.

`getCodex` reste la seule fonction ouverte au rôle public ; elle autorise
`VISITEUR`, `GARDE`, `OFFICIER` et `INTENDANT`, et son paramètre
`versionConnue` ne change pas sa liste de rôles. Les formulaires Amendes et
Prison lisent le Codex par cette fonction, avec un jeton de service.

## Décrets de peines et amendes

`getPeinesAmendes` autorise `GARDE` et `OFFICIER`, qui sanctionnent, et
`INTENDANT`, qui consulte, avant toute ouverture du classeur. `VISITEUR` est
refusé. Il
n'existe aucune fonction d'écriture du barème : la feuille `PeinesAmendes`
se corrige dans Sheets. Le Codex public (`getCodex`, seule fonction ouverte
au visiteur) ne transporte pas le barème ; la lecture d'un article s'y
affiche sans lui. Le navigateur ne demande pas le barème pour le visiteur,
mais seul `requireRole()` le protège. `scripts/test-peines.mjs` vérifie que
chaque refus précède toute lecture Sheets.

## Paye

`getPaye` autorise `OFFICIER` et `INTENDANT`. `reglerSemainePaye` n'écrit rien
par lui-même : il délègue à `ecrirePresenceCellule_`, partagé avec la page
Présences, qui exige `OFFICIER` avant toute ouverture du classeur. Un INTENDANT
qui appellerait `reglerSemainePaye` depuis la console est donc refusé au même
titre qu'un GARDE, indépendamment de ce que l'interface affiche.

## Inventaire

`getInventaire` autorise `OFFICIER` et `INTENDANT`. `ajouterCoffre`,
`modifierCoffre`, `ajusterInventaire`, `rangerInventaire` et `deplacerInventaire`
n'autorisent que `OFFICIER`, avant toute ouverture du classeur. `GARDE` n'apparaît dans aucune
de ces listes : la page n'existe pas pour lui, ni en lecture ni en écriture.
L'interface cache la page au GARDE et les commandes à l'INTENDANT, mais seul
`requireRole()` protège réellement. `scripts/test-inventaire.mjs` vérifie que
chaque refus précède toute lecture Sheets.

## Nouveautés des Effectifs

- `getEffectifs` reste OFFICIER ; `getOrganigramme` accepte GARDE, OFFICIER et INTENDANT. Leurs réponses incluent les événements récents filtrés côté serveur selon le rôle.
- La synchronisation et le déclencheur sont des helpers privés suffixés `_`, non appelables via `google.script.run`. Les mutations publiques vérifient OFFICIER avant tout accès au journal.
- Le journal est commun ; les ID événements vus sont enregistrés dans le navigateur, pas dans le token ni sous une identité Google supposée.
