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

Deux rôles :
- `GARDE`
- `OFFICIER`

Il n'existe pas de rôle UI `COMMANDEMENT`.

## Authentification

`Auth.js` utilise des Script Properties :
- `PASSWORD_GARDE`
- `PASSWORD_OFFICIER`
- `AUTH_SECRET`

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
- Amendes (création et statut `Payé`)
- Prison

### OFFICIER
- tout ce qui précède ;
- Effectifs ;
- édition Présences ;
- tableau de bord officier ;
- suppression Amendes ;
- modification du statut `Reversé` des Amendes ;
- suppression Prison.

Un contrôle uniquement côté React n'est jamais suffisant.

### Catalogue des objets

`rechercherObjets` autorise GARDE et OFFICIER après `requireRole()`, avant toute
lecture ou initialisation Sheets. `ajouterPrison` vérifie le même rôle avant la
validation des objets. L'initialisation d'une feuille Objets absente est un helper
privé, sous verrou ; aucune API Web de remplacement ou d'import libre du catalogue.

## Nouveautés des Effectifs

- `getEffectifs` reste OFFICIER ; `getOrganigramme` reste GARDE / OFFICIER. Leurs réponses incluent les événements récents filtrés côté serveur selon le rôle.
- La synchronisation et le déclencheur sont des helpers privés suffixés `_`, non appelables via `google.script.run`. Les mutations publiques vérifient OFFICIER avant tout accès au journal.
- Le journal est commun ; les ID événements vus sont enregistrés dans le navigateur, pas dans le token ni sous une identité Google supposée.
