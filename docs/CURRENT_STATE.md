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
