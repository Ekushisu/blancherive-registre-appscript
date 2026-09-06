# Journal de passation IA

## 2026-09-04 — Validation des gardes sans nom de famille

- Les ajouts Amendes et Prison résolvent désormais le libellé nettoyé du formulaire vers la valeur brute de `Données!O` avant l'écriture.
- Les espaces finaux produits par la formule pour les gardes sans nom de famille ne provoquent plus d'erreur de validation Sheets.
- En cas d'échec d'écriture, les valeurs précédentes de la ligne cible sont restaurées afin d'éviter les entrées fantômes.

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

## 2026-09-04 — Chargement robuste des métadonnées Codex

- Les métadonnées de `Codex.js` ne sont plus construites lors de l'évaluation globale.
- Elles sont désormais créées à l'appel pour éviter une dépendance à l'ordre de chargement de `SyncCodex.js`.

## 2026-09-04 — Contrôle du statut Reversé des Amendes

- Seuls les OFFICIER peuvent modifier `Reversé aux trésoriers`.
- La règle est imposée côté serveur et la case est désactivée pour les GARDE dans l'interface.

## 2026-09-04 — Destinataires dynamiques des amendes

- Chaque amende affiche les collecteurs actifs de son corps de garde.
- En l'absence de collecteur local, l'interface utilise les collecteurs actifs d'État-Major.
- Les corps Cité de Blancherive, Éclaireur, Hird du Jarl et État-Major mutualisent les collecteurs de Cité et d'État-Major ; les grades sont affichés.
- Couleurs des lignes ajustées : rouge non payée, gris payée non reversée, vert payée reversée.

## 2026-09-04 — Exclusion du Hird des présences

- Le Hird du Jarl est exclu de la génération et de l'affichage des présences.
- Il est également exclu des agrégats de solde et des alertes d'inactivité, sans suppression de l'historique.

## 2026-09-04 — Positionnement des nouveaux effectifs

- Les nouveaux membres ne suivent plus la dernière cellule utilisée de la feuille.
- Ils sont ajoutés à la première ligne libre et récupèrent l'intégralité du modèle (dont validations et chips) d'une ligne Effectifs valide, sans en reprendre les données.

## 2026-09-04 — Synchronisation Effectifs / Présences

- L'ajout d'un effectif et toute modification de statut régénèrent la semaine courante de Présences.
- Les autres modifications d'effectif n'entraînent pas de régénération.

## 2026-09-04 — Consultation des Présences

- Les semaines sont repliables, avec ouverture initiale de la semaine courante.
- Un filtre permet de limiter l'affichage à une semaine donnée.
