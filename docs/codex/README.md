# Textes juridiques — copies locales

Exports texte des documents Google Docs sources, récupérés le 15 septembre 2026,
complétés le 22 septembre 2026 pour les décrets sur les équipements dwemers,
les équipements orsimer et les recherches archéologiques, le 27 septembre
2026 pour les quatre codes de Blancherive, puis le 8 octobre 2026 pour le
décret d'application pluriel de Blancherive. Le 3 novembre 2026, neuf copies
ont été rafraîchies depuis les documents réécrits : Corpus Juriscivilis
(nouvelles fourchettes), De Re Nobilitatis (18 articles), Justicia Militaris et
Codex Penitus (retouches), et les cinq textes de Blancherive (Code pénal local
de 39 articles, Code civil de 12, Loi fondamentale de 28, Code du commerce et
décret pluriel retouchés).

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
ne pas en déduire la structure réelle sans vérifier. Exception depuis
novembre 2026 : dans « De Argentaria » réécrit, le carré « ■ » devant chaque
article est du texte saisi, rendu par `getText()` ; `reconnaitreArticleCodex_`
l'ignore.

Les quatre codes de Blancherive et le décret d'application pluriel font
exception : leur partage interdit le téléchargement aux lecteurs, et l'export
répond HTTP 401 alors que la page de lecture s'ouvre. Leurs copies du
27 septembre 2026 avaient été reconstituées depuis le modèle embarqué dans la
page de lecture (`DOCS_modelChunk`), qui ne charge que le début d'un long
document. Depuis le 3 novembre 2026, elles viennent de la vue mobile
(`https://docs.google.com/document/d/<ID>/mobilebasic`), qui rend tout le
document en HTML sans chargement différé ; le HTML est converti en texte
(paragraphes et sauts de ligne, entités décodées). Il n'y a ni puce ni
artefact d'export dans ces cinq fichiers.

## Codes — table `SYNC_CODEX_DOCUMENTS`

Les deux tables de ce fichier font aussi la correspondance fichier →
document de `scripts/codex-local.mjs`, qui reconstitue le Codex des copies
locales pour les tests et les aperçus : garder le format
`| `fichier.txt` | `identifiant` | … |` et l'identifiant du registre.

| Fichier | ID | État |
|---|---|---|
| `loi-fondamentale-blancherive.txt` | `1AMAMjFDZ8dUAaAZ6ySE76ulSoByqOIB20SbtNVGZmWE` | Nouveau le 27 septembre 2026 ; réécrit, copie du 3 novembre 2026 : 28 articles (dont 7-1, 7-2 et 20-1), sans sanction |
| `code-penal-local-blancherive.txt` | `1QnltaOqtymMGWiQUtBOts1ltt15KQfNUhrKLaEn7MSw` | Nouveau le 27 septembre 2026 (96 articles) ; réécrit, copie du 3 novembre 2026 : 39 articles numérotés 1 à 39 sans article 29, les art. 1 et 2 étant des dispositions générales, plusieurs qualifications par titre, aucune peine chiffrée |
| `code-civil-local-blancherive.txt` | `116FByPVeFenuLENmTqPnOP_MXu90RM2MVIEyub4eVnk` | Nouveau le 27 septembre 2026 (30 articles) ; réécrit, copie du 3 novembre 2026 : 12 articles, sans sanction (réparation des torts, art. 10 et 11) |
| `code-commerce-local-blancherive.txt` | `1dtSQ_QhP7A6d6gAS7s21x3LAbbZxarmfxXoE4mlctB0` | Nouveau le 27 septembre 2026 ; réécrit, copie du 3 novembre 2026 : 19 articles, un seul qualifié (art. 17, délit) |
| `decret-application-pluriel-blancherive.txt` | `1NKKFL-TfTDhhDj8vRsJtJm4-9V9kBoYCCHTqHiv66XY` | Nouveau le 8 octobre 2026, décret du Jarl pour l'application du Code du commerce, 16 articles et un article 5-1, redevances et taxes sans peine ; copie rafraîchie le 3 novembre 2026 (mise en forme seulement) |
| `ancien-code-judiciaire-blancherive.txt` | `1_awmZGCcQ0TgQycHQGRiBXLTr-f6Yjsn4fR7dAMdQvk` | Caduc depuis le 27 septembre 2026, retiré du registre, conservé pour comparaison |
| `code-corpus-juriscivilis.txt` | `1Q44ArnKr6qsJIRP9pSVCq_eloSzgMxA1JTqbPl7PP-M` | Nouveau, remplace `1_AslqVk…` ; révisé par l'Empire, copie du 3 novembre 2026 : code de tout l'Empire (plus « de Bordeciel »), fourchettes contravention ≤ 100, délit ≤ 500, crime ≤ 1 000 septims, « les amendes ne sont pas cumulables », 17 articles inchangés |
| `code-de-re-nobilitatis.txt` | `1hMA2J9FeE-LfKwdKXy15U6nrpKpdzRZdFg77hqywrzI` | Nouveau, remplace `1Kcw1wll…` ; réécrit, copie du 3 novembre 2026 : 18 articles (noblesse de fonction, personnelle, territoriale) ; fait isolé sur sept jours et amende toujours proposée à l'art. 13, sanctions à l'art. 14 (plus de plafond de 5 000 septims), décision conjointe à l'art. 15 |
| `code-corpus-proceduralis.txt` | `15ij3H8wqKr-kEAlmHtSSAY1EKslKLudAJT-iM78UERE` | Nouveau, remplace `1S7TzUji…` ; inchangé au 3 novembre 2026 |
| `code-justicia-militaris.txt` | `1OfwyV6KQynjJS3QyVJyLLbgoTuQc2IP3CoRBSt45soM` | Nouveau, remplace `17pIYvR6…` ; copie du 3 novembre 2026, retouches de titre seulement |
| `code-codex-penitus.txt` | `1AwLYSziNrCP5oLCyIUAaAauoWmeQVRjvrBcSIBYP000` | Nouveau, remplace `1cO8A1vo…` ; copie du 3 novembre 2026 : titre sans « Bordeciel », art. 16 ter retire aux châtelleries le droit de perception fiscale sur les forteresses orques |

Les fichiers `ancien-*.txt` sont des versions retirées du registre, conservées
pour comparaison. À supprimer une fois la migration validée.

Le propriétaire a déclaré le 27 septembre 2026 que « tous les anciens codes de
Blancherive sont caducs » et que les quatre nouveaux sont officiels. Aucun des
quatre ne chiffre ses peines : le Code pénal local qualifie chaque article
(contravention, délit, crime, ou plusieurs à la fois depuis sa réécriture) dans
son titre et renvoie au barème impérial du Corpus Juriscivilis (contravention
jusqu'à 100 septims, délit jusqu'à 500, crime jusqu'à 1 000 depuis la révision
lue le 3 novembre 2026 ; 500, 2 500 et au-delà auparavant). L'ancien Codex
Judiciaire portait 55 articles chiffrés ; depuis le 4 octobre 2026, le barème
de la feuille `PeinesAmendes` propose une peine par article.

Le Codex Procédural de Blancherive (`17Y3GBQBp_…`) n'a pas pu être récupéré
(HTTP 401) et le propriétaire le signale comme abandonné.

## Décrets et textes annexes

Treize d'entre eux sont référencés dans `SYNC_CODEX_DOCUMENTS` sous la famille
« Décrets impériaux » — douze depuis le 15 septembre 2026, le décret sur les
recherches archéologiques depuis le 22 septembre 2026. Les cinq autres en sont
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
| `decret-equipements-dwemers.txt` | `1g9mqqedq0iUnzTN7CedVPvyNXLS4L2SiC_fvhbZQstQ` | Régulation des équipements stratégiques Dwemer — remplace `17Y36stT6…` depuis le 22 septembre 2026 |
| `ancien-decret-equipements-dwemers.txt` | `17Y36stT6oVpZARCc093XOrhHVCfHimRBwxmFLapq9lM` | Ancien décret du Gouverneur sur les équipements dwemers, retiré du registre, conservé pour comparaison |
| `decret-recherches-archeologiques.txt` | `1Fh_wqNvwbcpyYGCWYwq6hBOw8jdc8mKLBtkYszPnUno` | Régulation des recherches archéologiques, artefacts et archives — ajouté le 22 septembre 2026 |
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
