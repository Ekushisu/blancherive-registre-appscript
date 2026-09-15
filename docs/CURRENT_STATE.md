# État courant — snapshot du 4 septembre 2026

Ce fichier décrit le snapshot reçu et doit être mis à jour après les changements importants.

### Refonte visuelle inspirée du manuel (13 septembre 2026)

- Papier, sceau au cheval et illustrations du manuel fourni ; palette sépia,
  cuir brun et or patiné, titres à empattements. Assets légers embarqués au build.
- Nouvelle connexion, navigation latérale sur ordinateur et navigation inférieure
  jusqu’à 900 px. Page Effectifs toujours réservée à OFFICIER.
- À 600 px et moins, les tableaux Amendes/Prison deviennent des fiches avec libellés
  de cellules ; mêmes données et contrôles. Présences avec défilement interne et
  première colonne fixe. Formulaires, filtres, modales, Effectifs et Codex adaptés.
- Codex utilisable au clavier ; focus retenu dans la modale, fermeture Échap,
  restauration du focus et défilement de fond bloqué pendant sa consultation.
- `doGet()` définit le viewport via `HtmlOutput.addMetaTag`, nécessaire à Apps Script.
- Aperçus sous `docs/apercus/`, données simulées uniquement. Tests UI sanctions,
  saisies, changements et test Organigramme réussis. Build frontend reconstruit.
- Aucun push ni déploiement effectué. Publier le nouvel Index et Code.js depuis
  le déploiement existant selon la procédure habituelle ; aucune resynchronisation
  du Codex nécessaire pour cette refonte graphique seule.

### Choix de sanctions et motifs personnalisés (9 septembre 2026)

- Codex judiciaire configuré sur `1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk`.
- Extraction excluant les intertitres numérotés et distinguant les durées de cachot
  des travaux forcés. Choix contextualisés d’amende/cachot dans les caches M/O.
- Formulaires Amendes/Prison : choix chiffrés, saisie libre sur appréciation explicite,
  et motif personnalisé pour décrets/décisions. Validation serveur, sortie calculée,
  anciennes lignes préservées. Composants communs dans `ui/src/sanctions.jsx`.
- Après push et publication de l’interface, relancer `synchroniserCodex()` pour
  régénérer les caches, puis recharger le registre. Aucun push ni changement distant
  effectué pendant cette correction.
- Tests dédiés : `test-sync-codex.mjs`, `test-sanctions.mjs`, `test-sanctions-ui.mjs`.

### Catalogue des objets et saisies Prison (7 septembre 2026)

- Catalogue initial de 10 131 fiches en trois colonnes ID objet, Nom, Type. Feuille
  Objets créée à la première recherche si absente, sous verrou et par écriture en bloc.
  Une feuille existante reste la source de vérité ; aucune réimportation automatique.
- Autocomplétion dès trois caractères, attente de 300 ms, quinze suggestions maximum,
  recherche par nom sans accents ou par ID (avec tolérance aux zéros initiaux).
  Navigation clavier, indication de chargement et d'erreur, réponses obsolètes ignorées.
- Ajouts de plusieurs objets, quantités cumulées par ID, retrait avant enregistrement,
  brouillon non ajouté bloquant la soumission. Champs et fermeture du formulaire
  désactivés pendant l'enregistrement.
- Validation serveur des objets et quantités, noms historiques dans le JSON Prison!J,
  affichage lisible et prise en charge des anciennes saisies en texte libre.
- Aucune lecture du catalogue au chargement du registre, du formulaire ou des autres
  pages. Lecture de A:C en bloc lors de la recherche ; pas de cache tant qu'aucune
  mesure distante ne justifie sa complexité. Ajout sans saisie : aucune lecture Objets.
- Tests : `node scripts/test-prison-objets.mjs`, `node scripts/test-saisies-ui.mjs`,
  et les six suites existantes réussis. Génération : `npm run build` réussie.
- Code envoyé par clasp (16 fichiers), déploiement Web App existant mis à jour en
  version **52** le 7 septembre 2026. L'initialisation réelle d'Objets reste déclenchée
  par la première recherche ; aucun enregistrement d'incarcération de test n'a été
  créé en production. Les tests locaux ne remplacent pas un essai utilisateur connecté.
- Vérification par l'API Apps Script : les 16 fichiers de la version 52 concordent
  avec le dépôt ; accès Web App `ANYONE_ANONYMOUS` conservé. La lecture HTTP directe
  de l'URL depuis l'environnement de développement a retourné 403, donc aucun test
  du formulaire connecté en production n'a été effectué pendant cette intervention.
- Incident confirmé par le propriétaire : le lien demande un accès en navigation
  privée après la publication par clasp. Un diagnostic HTTP anonyme reproduit une
  page Google Drive « accès refusé » (403), malgré `ANYONE_ANONYMOUS` et
  `USER_DEPLOYING`. Les manifestes des versions 51 et 52 sont identiques. Un retour
  temporaire à 51 n'a pas corrigé l'accès ; la version 52 a ensuite été remise sur
  le même déploiement. Cause exacte non établie, accès public **non rétabli**.
  Prochaine action : vérifier et revalider le déploiement existant dans l'interface
  Apps Script du propriétaire (exécuter en tant que Moi, accès Tout le monde), puis
  tester sans connexion Google. Ne pas confondre le partage du classeur/source
  avec l'accès à la Web App.

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
