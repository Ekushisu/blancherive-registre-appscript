# Authentification et rôles

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

## Nouveautés des Effectifs

- `getEffectifs` reste OFFICIER ; `getOrganigramme` reste GARDE / OFFICIER. Leurs réponses incluent les événements récents filtrés côté serveur selon le rôle.
- La synchronisation et le déclencheur sont des helpers privés suffixés `_`, non appelables via `google.script.run`. Les mutations publiques vérifient OFFICIER avant tout accès au journal.
- Le journal est commun ; les ID événements vus sont enregistrés dans le navigateur, pas dans le token ni sous une identité Google supposée.
