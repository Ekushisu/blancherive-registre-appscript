# Lieux et tables de loot — installation Keizaal

Extraction locale du 8 septembre 2026, en lecture seule, des 37 plugins de `docs/loadorder.txt`.

## Fichiers à consulter

- **coffres-keizaal.csv** : conteneurs dans le périmètre Keizaal, cellule, coordonnées, ID de placement, contenu direct et listes référencées. Inclut aussi sacs, meubles, urnes et tonneaux.
- **lieux-loot-keizaal.csv** : 55 232 placements candidats dans le périmètre Keizaal, y compris objets posés, végétation et certains personnages.
- **tables-loot.csv** : 56 876 entrées d'inventaires et de listes, tous plugins ; chercher un `cible_id` dans `source_id` pour descendre dans une sous-liste.
- **tables-loot-keizaal.csv** : sous-ensemble des sources affectées par Keizaal ou référençant indirectement un objet affecté. Les sous-listes purement vanilla restent dans le fichier complet.
- **lieux-modifies-keizaal.csv** : cellules et lieux dont la définition finale provient de Keizaal/Kzl.
- `lieux-loot.csv`, `donnees-loot.json`, `rapport.json` : données complètes et compteurs par plugin.

CSV UTF-8 avec BOM et séparateur point-virgule, ouvrables dans Excel. Les noms anglais intégrés aux plugins sont conservés.

## Exemples trouvés

Nombre de placements de conteneurs nommés « Coffre », dans les cellules indiquées, sans garantie d'accessibilité en jeu :

| Cellule | Coffres | Famille identifiée |
|---|---:|---|
| Ilinalta's Deep | 5 | 4 TreasWarlockChest et 1 TreasWarlockChestBoss |
| Ilinalta's Deluge | 2 | 1 TreasWarlockChest et 1 TreasWarlockChestBoss |
| Driftshade Refuge | 8 | 7 TreasBanditChest et 1 TreasBanditChestBoss |
| Driftshade Cellar | 2 | TreasBanditChest |
| Ragnvald Temple | 6 | 5 TreasDraugrChest et 1 TreasDraugrChestBoss |
| Alftand Glacial Ruins | 11 | Plusieurs types de coffres |
| Bthardamz Upper District | 9 | Plusieurs types de coffres |

Les coffres de sorciers d'Ilinalta référencent notamment des listes de gemmes spirituelles, parchemins, potions, livres de sorts et robes enchantées. Les coffres de bandits de Driftshade référencent notamment armes, armures, lingots, bijoux, gemmes et potions. Ce sont des possibilités issues de listes, pas une promesse de tout obtenir.

`Keizaal.esp` contient 385 enregistrements CELL, 15 525 REFR et 9 CONT, mais aucun LVLI. `KeizaalInteriors.esp` contient 27 CELL et 2 308 REFR, aucun CONT ou LVLI. Les modifications de lieux ne signifient donc pas systématiquement une réécriture des tables de loot. Les coffres identifiés ci-dessus utilisent encore des définitions de base Skyrim.

Deux définitions spécifiques existent : `RP_TreasExplorerLootChestSand01` (`keizaal.esp|000093`) et `RP_TreasBanditChestBossSand01` (`keizaal.esp|000096`). Aucun placement correspondant n'a été retrouvé dans les références finales analysées. Ne pas leur attribuer un lieu sur cette seule base.

## Méthode et limites

Les identités sont résolues avec les masters de chaque fichier et la dernière définition dans l'ordre fourni est retenue. Les enregistrements supprimés sont exclus des lignes principales. Les groupes CELL servent à rattacher les références à leur cellule ; XLCN fournit le lieu quand disponible. Les traductions proviennent des STRINGS françaises puis anglaises ; archives indexées par nom, fichiers libres prioritaires, comme l'extracteur d'objets.

Le périmètre « concerne_keizaal » inclut une modification du placement, de la cellule, de la base ou d'une cible d'inventaire indirecte. Il ne signifie pas que chaque objet est nouveau, ni que chaque modification change le loot. Une cellule modifiée par un autre plugin peut également contenir des placements Keizaal.

Les coordonnées sont les coordonnées internes du jeu, pas une carte ni un itinéraire. Certains extérieurs sans nom sont désignés par leur EditorID ou FormID. Les coffres initialement désactivés et les références avec parent d'activation sont signalés, sans simuler leur activation. Les suppressions de groupes, l'état des sauvegardes, les verrous, droits de propriété, quêtes et scripts ne sont pas simulés.

L'extraction ne reconstitue pas le loot serveur de Keizaal Online, les distributions dynamiques, les inventaires hérités via modèles de PNJ, les tenues ni les listes de mort. Les conteneurs sans entrée CNTO sont absents des placements candidats. Les végétaux incluent aussi des éléments non récoltables ; leur présence n'est pas une preuve de loot. Les références vers des bases supprimées ne sont pas certifiées utilisables.

`chance_vide` est la valeur brute LVLD ; `globale_chance` peut la modifier. `flags_liste` conserve les options brutes. Les quantités CNTO/LVLO et niveaux ne sont pas des probabilités finales : aucune chance de drop globale n'est calculée. Les structures sont fondées sur les [définitions Skyrim de xEdit](https://raw.githubusercontent.com/TES5Edit/TES5Edit/dev-4.1.6/Core/wbDefinitionsTES5.pas).

Reproduction :

```powershell
node scripts/export-skyrim-loot.mjs 'M:\Steam\steamapps\common\Skyrim Special Edition\Data' docs/loadorder.txt docs/loot
```

Vérifications : parcours complet avec contrôles de bornes, tailles décompressées, masters et résolution des FormID ; vérification des liens des familles de coffres citées ; tests existants `node scripts/test-export-skyrim-objects.mjs` réussis. Pas de comparaison exhaustive avec un export xEdit ni de validation sur le serveur.
