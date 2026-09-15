# Garde de Blancherive — Instructions Codex

## Source de vérité

Le code présent dans ce repo est la source de vérité technique.
Ne jamais reconstruire un fichier depuis un ancien chat si le fichier actuel existe.

Avant toute modification, lire :
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/BUSINESS_RULES.md`
- `docs/AUTH_AND_ROLES.md`
- `docs/CURRENT_STATE.md`

## Règles de travail

- Ne jamais demander au propriétaire de fusionner manuellement des snippets.
- Quand un fichier Apps Script ou HTML doit être livré hors édition directe du repo, fournir le fichier complet.
- Préserver les noms de fonctions publiques existantes sauf demande explicite.
- Ne jamais redéclarer `SPREADSHEET_ID` dans un fichier feature : il est défini dans `src/Code.js`.
- Vérifier les permissions côté serveur avec `requireRole()`. Cacher un bouton côté UI ne constitue pas une protection.
- Ne jamais supprimer physiquement un membre via l'application Effectifs.
- Ne pas régénérer automatiquement les Présences à la suite d'une modification d'Effectifs sans décision métier explicite.
- Préserver l'historique des semaines de Présences.
- Les colonnes techniques / caches doivent être documentées avant d'être déplacées ou supprimées.
- `Prison.js` dépend de helpers définis dans `Amendes.js`; ne pas les supprimer ou renommer sans vérifier les usages.
- Toute modification sensible doit être relue avec un `git diff` avant `clasp push`.

## Style

- Code Apps Script V8 / JavaScript simple.
- Frontend React chargé dans `Index.html`, sans build frontend séparé.
- Noms métier et messages UI en français.
- Favoriser les lectures/écritures Sheets par blocs plutôt que cellule par cellule.
- Éviter d'ajouter de la complexité de pagination/lazy-loading sans mesure montrant qu'elle est utile.

## Déploiement

Le repo représente le code source. Un `clasp push` met à jour le projet Apps Script, mais la Web App déployée peut nécessiter une nouvelle version / mise à jour de déploiement.

Le partage des rôles est fixé : `clasp push` envoie le code, et **la publication
du déploiement se fait à la main** par le propriétaire depuis l'interface Apps
Script — Déployer > Gérer les déploiements > Modifier, avec *Exécuter en tant
que : Moi* et *Qui a accès : Tout le monde*. Conserver le lien existant.

Ne jamais relancer une mise à jour de déploiement par clasp sans demande
explicite : c'est précisément ce qui casse l'accès anonyme. L'incident du
7 septembre 2026, un HTTP 403 en navigation privée malgré `ANYONE_ANONYMOUS`,
provenait d'un déploiement par clasp. Publié à la main, l'accès anonyme
fonctionne, navigation privée comprise.

Ne pas décrire l'accès public comme cassé, ni en faire un préalable aux
fonctionnalités destinées aux visiteurs anonymes.
