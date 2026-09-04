# État courant — snapshot du 4 septembre 2026

Ce fichier décrit le snapshot reçu et doit être mis à jour après les changements importants.

## Fonctionnel

### Auth
- Login GARDE / OFFICIER.
- Token HMAC avec expiration 8 h.

### Organigramme
- Implémenté dans `Organigramme.js`.

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

## Problèmes / travaux immédiats connus

### 1. Double soumission des formulaires Amende et Prison

Le snapshot montre que `AmendeForm` et `PrisonForm` appellent `onSubmit(form)` sans état `submitting`.

Conséquence observée :
- après clic sur Enregistrer, le formulaire reste interactif pendant l'appel Apps Script ;
- l'utilisateur peut cliquer à nouveau ;
- plusieurs requêtes peuvent créer des doublons.

Correction attendue :
- état `submitting` ;
- garde anti-double-submit ;
- désactivation des champs / bouton pendant la requête ;
- libellé visible du type `Enregistrement…` ;
- réactivation en cas d'erreur.

Ne pas corriger ce problème sans repartir du code du snapshot présent dans le repo.

### 2. Source de la liste des gardes dans Amendes / Prison

Le snapshot courant lit encore :
- `SyncCodex!P` dans `getAmendeFormData()`;
- `SyncCodex!P` dans `getPrisonFormData()`;
- `SyncCodex!P` dans les validations serveur lors des ajouts.

Une validation de données Sheet a été réorganisée récemment pour utiliser une concaténation Prénom + Nom issue des Effectifs, mais cette évolution n'est pas encore reflétée dans le code du snapshot.

Décision architecturale souhaitée :
- les identités des gardes ne devraient pas dépendre du cache juridique `SyncCodex`;
- utiliser une liste de référence dédiée dérivée d'`Effectifs`.

### 3. Présences / Effectifs

Un décalage a été signalé visuellement / métier entre Effectifs et la liste des Présences.
Aucune correction ne doit être faite avant d'identifier précisément le cas et la règle métier souhaitée.

## Performance

Aucune pagination/lazy loading n'est jugée nécessaire pour Effectifs à l'échelle actuelle.
Le premier axe d'optimisation, si besoin, est plutôt la réduction / mise en cache des accès Sheets.
