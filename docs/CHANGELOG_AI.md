# Journal de passation IA

## 2026-09-04 — Snapshot de référence

- Snapshot complet du projet local reçu.
- Le repo devient la source de vérité pour les prochaines modifications.
- Documentation de passation créée pour Codex / VS Code.
- Aucun fichier métier de `src/` modifié dans cette passation.
- Deux travaux immédiats documentés :
  - verrouillage des formulaires Amende / Prison pendant l'envoi ;
  - retrait de la dépendance des gardes à `SyncCodex!P`.
- Un problème Présences / Effectifs signalé reste à diagnostiquer avant modification.

## 2026-09-04 — Découplage de la liste des gardes

- Suppression de la génération du cache `SyncCodex!P`.
- Suppression du rafraîchissement de cette colonne depuis l'API Effectifs.
- Les formulaires Amendes et Prison ainsi que leurs validations serveur utilisent désormais `Données!O2:O`.
- Documentation du rôle de la formule de concaténation présente dans `Données!O`.

## 2026-09-04 — Verrouillage des formulaires Amendes / Prison

- Ajout d'un verrou synchrone anti-double-submit dans `AmendeForm` et `PrisonForm`.
- Désactivation de tous les contrôles pendant l'enregistrement.
- Affichage du libellé `Enregistrement…` jusqu'à la fin de l'appel serveur.
- Aucun changement des API ni des règles métier côté serveur.

## 2026-09-04 — Frontend buildé depuis `ui/`

- Extraction du CSS et du code React hors de `src/Index.html`.
- Ajout d'un build esbuild qui génère l'artefact `src/Index.html` sans Babel côté navigateur.
- Mise à jour des scripts npm pour construire avant un `clasp push`.
