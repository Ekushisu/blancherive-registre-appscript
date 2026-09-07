# État courant — snapshot du 4 septembre 2026

Ce fichier décrit le snapshot reçu et doit être mis à jour après les changements importants.

## Fonctionnel

### Auth
- Login GARDE / OFFICIER.
- Token HMAC avec expiration 8 h.

### Organigramme
- Implémenté dans `Organigramme.js`.
- Refonte locale du 5 septembre 2026 : chaîne centrale jusqu'aux Majors de l'État-Major, Hird relié uniquement au Jarl, Capitaines mis en avant et personnel repliable par corps. Hird replié initialement ; garnisons ouvertes.
- Les Majors actifs de Rivebois et Bois-de-Chêne forment un commandement commun sous l'État-Major central ; les deux garnisons sont rattachées à ce groupe. Les quatre autres corps restent directement sous l'État-Major.
- Autres Majors actifs hors commandement et Réserve commune dans deux blocs en bas. Répartition vérifiée par `node scripts/test-organigramme.mjs`, notamment les variantes de nom de Bois-de-Chêne, les réservistes et les postes vacants. Version Web déployée non mise à jour par cette refonte locale.

### Effectifs
- Page OFFICIER.
- Ajout et modification.
- Pas de suppression.
- Couleurs de grades depuis `Données!A2:A`.
- Groupement par corps puis grade.
- Réserve à la fin de chaque corps.
- Groupes terminaux trans-corps en fin de page.

### Présences
- Consultation GARDE.
- Modification OFFICIER.
- Tableau de bord OFFICIER.
- Génération / synchronisation historique présente dans le backend.

### Codex
- Consultation dans la Web App.
- Synchronisation des documents vers `SyncCodex`.

### Amendes / Prison
- Consultation.
- Ajout.
- Modification des cases d'état.
- Suppression OFFICIER.
- Liste des gardes lue depuis `Données!O2:O`.
- Formulaires verrouillés pendant l'enregistrement pour empêcher les doubles soumissions.
- Les gardes sans nom de famille sont écrits avec la valeur brute de `Données!O`, espaces invisibles compris, afin de respecter les validations Sheets.
- Une écriture Amendes / Prison qui échoue restaure les valeurs précédentes de la ligne cible pour ne pas laisser d'entrée fantôme.
- Statut `Reversé` des Amendes modifiable par les OFFICIER uniquement.
- Destinataire du reversement affiché dynamiquement depuis les collecteurs actifs du corps du garde, avec repli État-Major.
- Les amendes des corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major regroupent les collecteurs de Cité et d'État-Major ; leurs grades sont affichés.
- Couleurs des amendes : rouge (non payée), gris (payée non reversée), vert (payée reversée).

### Présences

- Le Hird du Jarl est exclu du tableau, des calculs de solde et des alertes d'inactivité, sans suppression des lignes historiques.
- Les semaines sont affichées en accordéons ; seule la semaine courante est ouverte par défaut et un filtre permet de sélectionner une semaine.

### Effectifs

- Les ajouts remplissent la première ligne disponible de la liste et héritent format et validations d'une ligne modèle valide.
- Un ajout ou un changement de statut régénère la semaine courante de Présences.

## Changements intégrés

### Source de la liste des gardes dans Amendes / Prison

- `SyncCodex!P` n'est plus généré ni consommé par le code.
- `getAmendeFormData()` et `getPrisonFormData()` lisent désormais `Données!O2:O`.
- Les validations serveur lors des ajouts utilisent également `Données!O2:O`.
- La liste reste dérivée d'`Effectifs` par la formule présente dans la feuille `Données`.

### Double soumission des formulaires Amende et Prison

- Un verrou synchrone empêche tout second submit pendant l'appel serveur.
- Les champs et le bouton sont désactivés et le bouton affiche `Enregistrement…`.
- Le formulaire est réactivé à la fin de l'appel lorsqu'il reste affiché, notamment après une erreur.

## Problèmes / travaux immédiats connus

### 1. Présences / Effectifs

Un décalage a été signalé visuellement / métier entre Effectifs et la liste des Présences.
Aucune correction ne doit être faite avant d'identifier précisément le cas et la règle métier souhaitée.

## Performance

Aucune pagination/lazy loading n'est jugée nécessaire pour Effectifs à l'échelle actuelle.
Le premier axe d'optimisation, si besoin, est plutôt la réduction / mise en cache des accès Sheets.

### Présences — recherche et coût par corps (6 septembre 2026)

- Recherche par prénom et nom, insensible aux accents et à la casse, combinable avec le filtre de semaine. Les semaines correspondantes sont ouvertes au lancement de la recherche.
- Chaque corps affiche, pour les OFFICIER uniquement, la somme des soldes de la semaine, courante ou passée, paiements inclus. Le total porte sur tout le corps même pendant une recherche et se recalcule après modification des présences.
- Les agrégats `corpsTotals` sont calculés côté serveur dans `getPresences` après contrôle du rôle et ne sont pas renvoyés aux GARDE. Les soldes individuelles existantes restent consultables ; aucune modification des données historiques.
- Le tableau de bord OFFICIER affiche le cumul des amendes datées de la semaine courante (lundi à dimanche, fuseau métier Europe/Stockholm), payées et déjà reversées. Ce cumul utilise la date de l'amende, pas la date de reversement, qui n'est pas enregistrée.
- Vérifications locales : `node scripts/test-presence-finances.mjs` (permissions, totaux courants/passés, exclusion Hird, bornes de semaine et changement d'année).

### Nouveautés des Effectifs et de l'Organigramme (6 septembre 2026)

- Badge « Nouveau » / « Vu » pendant 14 jours, survol de 800 ms, clavier ou appui, détails datés des arrivées et changements de grade/corps. État de lecture partagé entre pages et conservé dans le navigateur ; repli en mémoire si le stockage est bloqué.
- Panneau des changements récents : filtres par type, personne/corps et non vus, actualisation, tout marquer comme vu. Compteurs de membres avec nouveautés dans les onglets Effectifs et les corps/personnels repliés de l'Organigramme.
- Feuille `HistoriqueEffectifs` et colonne `ID membre` créées automatiquement au premier chargement. La structure est documentée dans `DATA_MODEL.md`. Les membres déjà présents sont initialisés sans fausses nouveautés.
- Journalisation des modifications applicatives sous verrou ; déclencheur d'édition Sheets installé automatiquement à la première consultation OFFICIER d'une des deux pages. Comparaison de repli à chaque chargement.
- Le déploiement doit inclure `HistoriqueEffectifs.js` et le nouvel `Index.html`. Les autorisations Apps Script doivent permettre la création du déclencheur. L'installation effective et les écritures Sheets n'ont pas été exécutées pendant le développement local.
- Vérifications : `node scripts/test-historique-effectifs.mjs`, `node scripts/test-changes-ui.mjs`, tests existants Organigramme et finances des Présences, puis `npm run build`.

### Soldes journalières par grade (6 septembre 2026)

- La base commune a été identifiée dans `Vue globale!L2`. Une feuille `SoldesGrades` est créée automatiquement au premier chargement des Présences/du tableau de bord ou à une génération/réparation de formules.
- Commander à 100 septims/jour pour la semaine courante et les suivantes. Le barème initial des autres grades reprend la base existante ; exceptions Recrue 0 et Aspirant-Garde moitié de la base. Hird toujours exclu.
- Le barème est modifiable directement dans `SoldesGrades`, puis appliqué au prochain chargement des Présences. Les anciennes soldes sont préservées en fixant l'ancienne base dans leurs formules, et en restaurant les formules R1C1 lors des reconstructions.
- La pose des validations de cases dans `appliquerStructurePresences` conserve désormais les valeurs des pointages et paiements restaurés.
- Tests : `node scripts/test-soldes-grades.mjs` (migration, barème, historique, modifications des jours, régénération, paiements, colonnes techniques et validations), `node scripts/test-presence-finances.mjs`.
- Code local uniquement : aucun déploiement ni modification du classeur distant pendant cette intervention.
