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
- Toute fonction sans `_` final est appelable anonymement par `google.script.run`. Une fonction qui fabrique un jeton finit par `_` (`createAuthToken_`) : seules `login`, `ouvrirSessionPublique` et `ouvrirSessionDiscord` en délivrent au navigateur, et `getSessionInfo` prolonge à l'identique une session Discord déjà vérifiée. Une session par code n'est jamais prolongée, et son jeton porte l'empreinte du code (changer le code la ferme). `scripts/test-auth-codes.mjs` fige la liste des fonctions publiques d'`Auth.js` et celle des appelants de `createAuthToken_` dans tout `src/`.
- Les codes communs (`PASSWORD_*`) restent le mode de secours de la connexion Discord et le seul accès de l'intendance : ne pas les supprimer. Leur interrupteur `AUTH_CODES` ne vit que dans les Script Properties, jamais dans l'application ni le classeur.
- Connexion Discord : le tableur décide. L'accès au registre se déduit de la fiche `Effectifs` rattachée, jamais des rôles Discord. La colonne `Effectifs!ID Discord` est du texte, lue par `lireLiensDiscordEffectifs_` et écrite seulement par `ecrireLienDiscordEffectif_` (`Discord.js`) ; un lien en anomalie (nombre, illisible, doublon) ne vaut pour personne. Le secret de l'application ne vit que dans les Script Properties, le jeton du bot que dans les secrets du relais Cloudflare.
- Session Discord : une amende ou une incarcération se crée au nom de la session, officier compris ; le serveur l'impose par `imposerGardeSession_` (`Amendes.js`), jamais seulement l'interface. Le Livret de service (`getLivretService`) n'existe qu'en session Discord et ne renvoie que les données du membre du jeton : ne jamais y ajouter de données d'un autre membre ni l'ouvrir à un code commun.
- Rôles Discord (`SynchroDiscord.js`) : le bot ne touche qu'aux rôles nommés dans la feuille `RolesDiscord`, et qu'aux comptes rattachés ; ne jamais retirer ou ajouter un rôle hors de cette feuille, ni toucher aux comptes non rattachés sans décision du propriétaire. Les rôles suivent le grade régulier, jamais l'alias. Le pseudo est « Prénom Nom » de la fiche (effacé pour un départ), sans grade. L'interrupteur `DISCORD_SYNCHRO` (`SIMULATION`, `ACTIF`) ne vit que dans les Script Properties ; une panne Discord ne doit jamais faire échouer une modification d'Effectifs.
- Relais Discord (`relais-discord/worker.js`) : tous les appels du bot y passent, jamais directement depuis Apps Script (Discord refuse l'en-tête imposé par Google, code 40333). Sa liste de routes est fermée et limitée au serveur de la Garde (lecture, ajout et retrait de rôle, pseudo seul) : ne pas l'élargir sans décision explicite du propriétaire. Il ne part pas avec `clasp push` ; après une modification, le propriétaire le redéploie sur Cloudflare. Le seuil OFFICIER (`DISCORD_SEUIL_OFFICIER`, Sergent-Chef) est une constante de `Discord.js`, à ne pas déplacer dans une feuille. La propriété `DISCORD_ACCES` est une table technique recalculée par la synchronisation de l'historique des Effectifs : ne pas l'éditer à la main, ne pas court-circuiter sa vérification dans `verifyAuthToken`.
- Ne jamais supprimer physiquement un membre via l'application Effectifs.
- Ne pas régénérer automatiquement les Présences à la suite d'une modification d'Effectifs sans décision métier explicite.
- Préserver l'historique des semaines de Présences.
- Les colonnes techniques / caches doivent être documentées avant d'être déplacées ou supprimées.
- `Prison.js` dépend de helpers définis dans `Amendes.js`; ne pas les supprimer ou renommer sans vérifier les usages.
- Les chefs d'accusation d'Amendes et Prison sont validés par `validerChefsAccusation_` (`Amendes.js`) contre `indexerArticlesCodex_` (`Codex.js`) : une référence `source + article` doit exister dans `SyncCodex!A:D` et être citable. Ne pas accepter de titre venu du navigateur, ne pas relire `SyncCodex!L:O`, et ne pas écrire le JSON des chefs (Amendes!H, Prison!L) ailleurs que par les helpers d'écriture de ces deux fichiers. La modification d'une entrée exige l'identité affichée (`attendu`) et le rôle OFFICIER.
- Le Codex est tenu en cache local par `ui/src/codex.js` (`getCodex(token, versionConnue)`) : ne pas rappeler `getCodex` sans version depuis une page, et ne pas réintroduire de liste d'infractions servie par `getAmendeFormData` / `getPrisonFormData`.
- Un document du registre `SYNC_CODEX_DOCUMENTS` marqué `citable: false` est de la documentation de contexte : lisible au Codex, jamais proposé ni accepté comme chef d'accusation. Ne pas retirer ce flag sans décision métier.
- `Paye.js` dépend de helpers définis dans `Presences.js`, dont `ecrirePresenceCellule_` : c'est le seul chemin d'écriture d'une case de présence, et il porte le contrôle de rôle, le verrou de document et la vérification d'identité de ligne (`lundi`, `prenom`, `nom`). Ne pas contourner ce helper depuis une nouvelle page, et toujours lui transmettre l'identité affichée.
- `Présences!A` porte le lundi ISO de la semaine en texte `yyyy-MM-dd`, jamais un numéro de semaine ni un objet `Date`. Toute lecture de cette colonne passe par `normaliserLundiPresence_` (`Presences.js`) ; le numéro de semaine n'est calculé que par l'interface (`ui/src/semaine.js`). Ne pas recréer les anciennes fonctions de génération hebdomadaire de `Code.js`.
- `Inventaire.js` dépend de `nettoyerSaisieUtilisateur` (`Amendes.js`) et de `lireCatalogueObjets_` (`Objets.js`). Le bloc `Inventaire!A:D` est réécrit en entier sous verrou : ne pas y écrire cellule par cellule depuis une autre page.
- La page Inventaire n'est pas visible du rôle GARDE, ni en lecture ni en écriture. Ne pas ajouter `GARDE` aux listes de rôles de `Inventaire.js` sans décision métier explicite.
- La page Paye est une vue de lecture sur les Présences : elle ne doit jamais écrire ailleurs que dans `Présences!O`, ni modifier un pointage.
- Un corps de garde non rattaché à un financeur connu doit rester visible et compté dans la Paye. Ne jamais filtrer silencieusement une solde due.
- Un nouveau corps se déclare dans `ORGANIGRAMME_GARNISONS` (`Organigramme.js`), sans quoi ses membres n'apparaissent pas dans l'organigramme, et se rattache à un financeur dans `PAYE_FINANCEURS` (`Paye.js`). Un nom affiché différent du libellé de la feuille (« Inquisition » → « Garde inquisitoriale ») se déclare dans `ui/src/corps.js` et dans `ORGANIGRAMME_GARNISONS` ; il ne sert qu'à l'affichage et n'est jamais envoyé au serveur ni écrit dans la feuille.
- Les alias de grade d'un corps (« Alias Inquisition », `Données!C`) se lisent par `lireAliasGrades_` (`AliasGrades.js`) et s'affichent par `libelleGrade` (`ui/src/corps.js`), ou `gradeAffiche_` côté serveur. Ils ne servent qu'à l'affichage : les options des formulaires gardent le grade régulier pour valeur, et aucun alias n'est envoyé au serveur ni écrit dans une feuille. Les tris, regroupements, couleurs, soldes et descriptions restent ceux du grade régulier. Tout nouvel affichage d'un grade passe par l'un de ces deux helpers avec le corps du membre.
- Le barème des peines (`PeinesAmendes.js`, feuille `PeinesAmendes`) propose, il n'impose pas : `Amendes.js` et `Prison.js` ne le lisent pas et n'en vérifient rien. Ne pas en faire une contrainte serveur, ni l'écrire depuis l'application, sans décision métier explicite. `getPeinesAmendes` est réservé à GARDE, OFFICIER et INTENDANT : le barème n'est pas public.
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
