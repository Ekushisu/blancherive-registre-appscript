# Textes juridiques — copies locales

Exports texte des documents Google Docs sources, récupérés le 15 septembre 2026.

**Ces copies ne sont pas la source de vérité.** Les Google Docs le restent, et
`SyncCodex` reste le cache technique généré à partir d'eux. Ces fichiers servent
à travailler hors ligne sur l'extraction : comparer une version à une autre,
concevoir un analyseur, vérifier une structure sans dépendre d'un accès Drive.

Regénération d'un fichier, sans authentification tant que le document reste
partagé publiquement :

```
https://docs.google.com/document/d/<ID>/export?format=txt
```

Attention : l'export texte insère les puces des listes en début de ligne
(`* Article 1`, `■ Article I`). Ces puces n'existent pas dans le document ;
ne pas en déduire la structure réelle sans vérifier.

## Codes — table `SYNC_CODEX_DOCUMENTS`

| Fichier | ID | État |
|---|---|---|
| `code-judiciaire-blancherive.txt` | `1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk` | En service, inchangé |
| `code-corpus-juriscivilis.txt` | `1Q44ArnKr6qsJIRP9pSVCq_eloSzgMxA1JTqbPl7PP-M` | Nouveau, remplace `1_AslqVk…` |
| `code-de-re-nobilitatis.txt` | `1hMA2J9FeE-LfKwdKXy15U6nrpKpdzRZdFg77hqywrzI` | Nouveau, remplace `1Kcw1wll…` |
| `code-corpus-proceduralis.txt` | `15ij3H8wqKr-kEAlmHtSSAY1EKslKLudAJT-iM78UERE` | Nouveau, remplace `1S7TzUji…` |
| `code-justicia-militaris.txt` | `1OfwyV6KQynjJS3QyVJyLLbgoTuQc2IP3CoRBSt45soM` | Nouveau, remplace `17pIYvR6…` |
| `code-codex-penitus.txt` | `1AwLYSziNrCP5oLCyIUAaAauoWmeQVRjvrBcSIBYP000` | Nouveau, remplace `1cO8A1vo…` |

Les fichiers `ancien-*.txt` sont les versions encore référencées par
`src/SyncCodex.js`, conservées pour comparaison. À supprimer une fois la
migration validée.

Le Codex Procédural de Blancherive (`17Y3GBQBp_…`) n'a pas pu être récupéré
(HTTP 401) et le propriétaire le signale comme abandonné.

## Décrets et textes annexes

Douze d'entre eux sont référencés dans `SYNC_CODEX_DOCUMENTS` sous la famille
« Décrets impériaux » depuis le 15 septembre 2026. Les cinq autres en sont
écartés, pour les raisons données plus bas.

| Fichier | ID | Titre |
|---|---|---|
| `decret-regime-fiscal.txt` | `1u3x3SrbR0IAP3S2hZg-8szrQajtPUBz8dPnLdydb_hE` | Régime fiscal de la province |
| `decret-imposition.txt` | `1a2Iq5wEduHZlnoFFMbaOuBNHRG7kfhTQGxHM7PnJR-A` | Imposition en la province de Bordeciel |
| `decret-de-argentaria-banques.txt` | `1OEoAUcDVqnjH22Knnyl8ki4v2ED5UYqdg9P6dqww1Zo` | De Argentaria — établissements bancaires |
| `decret-avocatus.txt` | `1epKkQLkEHy9RhLZycOUt-HNxFwVP8szyh_zhBRv0lGQ` | Avocatus de Bordeciel |
| `decret-administrateurs-imperiaux.txt` | `1PAtsn1rI81OLlwCmNvjM8EvPbd6oAHGrnUE-rzS2jOA` | Statut des administrateurs impériaux |
| `decret-successions-chatelleries.txt` | `1AZpHX8bqLZktW9Y36AI7QiAN_qBkZdxMxdkXYycg7sU` | Successions des châtelleries |
| `decret-chevalier-bordeciel.txt` | `1HprPbGwA0B_0eOA4wlTnckxFDZZK-ikCfbklJ_p6RwA` | Qualité de Chevalier de Bordeciel |
| `registre-chevalerie.txt` | `1gYIyIBhVVvGYoDenjQtpf-I5grlfqfVbgWp6oGhHXzQ` | Registre de la Chevalerie |
| `decret-ordres-militaires-religieux.txt` | `105KB6YllsBgQr7m_gcOVj74vHQFy30e2ja0omh5BNfE` | Ordres Militaires Religieux |
| `constitution-clericale-huit-divins.txt` | `1446YbBlsqc-q8tm5vzdK5vNSrfbo3wVx_cfYCJt9pSA` | Constitution cléricale du Conseil des Huit Divins |
| `decret-equipements-orsimer.txt` | `19asrJHgFRAu3KDaHkXZjAAggqOI-gyFp5ZJl2jrepU8` | Équipements stratégiques Orsimer |
| `decret-equipements-dwemers.txt` | `17Y36stT6oVpZARCc093XOrhHVCfHimRBwxmFLapq9lM` | Équipements dwemers |
| `decret-armes-etherees.txt` | `1vvolhoVSss_EEI8cECbNrVdQAgBpjbUbfN_iiZJoYG8` | Armes éthérées |
| `decret-restitution-biens-empire.txt` | `1x9jV2Ijc_4niwHQe4yK3PKmp28fqfWCN4FFuwRTTOzs` | Restitution des biens de l'Empire |
| `decret-chancellerie-a.txt` | `1jP5L4_Y6Mn6AmQaofUDXcNxqLe8MPpLW` | Décret de la Chancellerie impériale |
| `decret-chancellerie-b.txt` | `1bHAKCcyHORBhNySubRTfqWm81pd1CH74` | Décret de la Chancellerie impériale |

Un dix-septième document, `13faCeylp2cI_asJcb7JmTosG6Dbt8_FDl488NPZuf9U`,
renvoie HTTP 401 : il n'est pas partagé publiquement, contrairement aux autres.

## Classification

Trois natures distinctes, qui n'appellent pas le même traitement :

- **Codes** — droit applicable, articles porteurs de sanctions. Alimentent le
  Codex et les listes d'infractions d'Amendes et Prison.
- **Décrets** — droit applicable, articles sans sanction chiffrée dans la quasi-
  totalité des cas. Consultables dans le Codex, mais à tenir hors des listes
  de sanctions sous peine de les rendre inutilisables.
- **Documentation de contexte** — `constitution-clericale-huit-divins` et
  `registre-chevalerie`. Ni l'un ni l'autre n'est du droit applicable par la
  Garde ; le propriétaire les a qualifiés ainsi le 15 septembre 2026.

Cette répartition est corroborée par l'extraction : sur les vingt-sept
documents, seuls le Codex Judiciaire (55 articles sanctionnés) et le décret sur
le régime fiscal (2) portent des sanctions chiffrées. Tous les autres en sont
dépourvus.

## Obstacles techniques

Le premier est corrigé, les deux autres relèvent de Drive.

1. **Corrigé le 15 septembre 2026.** `extraireArticlesCodex_()` lisait
   `getBody().getParagraphs()`, qui ne retourne pas les `ListItem`. Les décrets
   « De Argentaria », « Armes éthérées » et « Successions des châtelleries »
   produisaient zéro article ; ils en produisent désormais 24, 7 et 5. La
   lecture passe par `getText()` et couvre aussi les onglets.
2. `DocumentApp.openById()` n'ouvre pas les fichiers Word importés.
   `decret-chancellerie-a` et `-b` ont des identifiants de 33 caractères,
   caractéristiques d'un binaire non converti. À convertir en Google Docs natif.
3. `13faCeylp2cI…` n'est pas partagé publiquement et n'a pas pu être récupéré.
