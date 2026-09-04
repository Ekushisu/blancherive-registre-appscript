# Contexte du projet

## But

Application Web Google Apps Script pour la **Garde de Blancherive** (RP Skyrim / Keizaal Online).

Elle sert de registre opérationnel pour :
- l'organigramme ;
- les effectifs ;
- les présences et soldes ;
- le Codex juridique ;
- les amendes ;
- la prison.

Le backend est Google Apps Script et le stockage principal est un Google Spreadsheet lié au projet.

## Spreadsheet

`SPREADSHEET_ID` est défini dans `src/Code.js`.

Feuilles métier connues :
- `Effectifs`
- `Données`
- `Présences`
- `Vue globale`
- `Amendes`
- `Prison`
- `SyncCodex`

## Principes

- Les documents juridiques sont la source juridique de vérité.
- `SyncCodex` est un cache généré / technique.
- Les effectifs sont administrables par les officiers depuis la Web App, sauf suppression physique.
- Les présences historiques doivent rester stables.
- Les lignes de présence de la semaine courante ne doivent pas être brutalement reconstruites à chaque changement d'effectif.

## Workflow souhaité

Le développement doit désormais se faire localement :
1. Git / VS Code / Codex.
2. Vérification du diff.
3. `clasp push`.
4. Mise à jour du déploiement Web App si nécessaire.

Éviter autant que possible l'édition manuelle dans l'éditeur Apps Script.
