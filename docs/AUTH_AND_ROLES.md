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
