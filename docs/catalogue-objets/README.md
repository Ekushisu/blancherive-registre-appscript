# Premier catalogue des objets Skyrim / Keizaal

Extraction du 7 septembre 2026, depuis les 37 plugins de `docs/loadorder.txt`, tous présents dans l'installation locale indiquée par le propriétaire. Les 32 entrées actives de `docs/Plugins.txt` concordent avec cette liste et son ordre ; les cinq autres entrées sont les fichiers officiels.

## Résultat

- `objets-candidats.csv` : **10 131 fiches**, avec des identifiants distincts ; **9 175 noms distincts** selon la comparaison PowerShell utilisée pour le contrôle. Un même nom peut désigner plusieurs objets ou variantes.
- `objets-keizaal.csv` : sous-ensemble de **117 fiches** dont le plugin d'origine commence par Keizaal ou Kzl : 80 pour `Keizaal.esp`, 35 pour `KzlOnlineMods.esp`, 2 pour `KzlHorses.esp`. Ce classement technique ne prouve pas que les modèles sont des créations originales de l'équipe.
- `objets-a-verifier.csv` : **1 640 fiches écartées du catalogue candidat**, dont 819 sans nom, 739 non jouables d'après le drapeau de l'enregistrement et 82 non jouables d'après les données de l'objet.
- `rapport-extraction.json` : ordre de chargement, masters, empreintes SHA-256 des plugins, sources de traduction et compteurs.

Les CSV sont en UTF-8 avec BOM, séparés par des points-virgules. Les champs sont entre guillemets.

| Catégorie | Fiches candidates |
|---|---:|
| Armes | 3 190 |
| Armures / vêtements | 4 134 |
| Clés | 451 |
| Gemmes spirituelles | 17 |
| Ingrédients | 117 |
| Livres / sorts | 1 160 |
| Lumières transportables / torches | 4 |
| Munitions | 32 |
| Objets divers | 494 |
| Parchemins | 96 |
| Potions / nourriture | 436 |

## Méthode et identifiants

Le script Node lit les plugins et les tables STRINGS, y compris dans les archives BSA, sans écrire dans l'installation. Il ne nécessite pas xEdit. Il parcourt les objets de base WEAP, ARMO, AMMO, ALCH, INGR, MISC, BOOK, KEYM, SLGM, SCRL et LIGH. Pour chaque identité, la dernière définition rencontrée dans l'ordre fourni remplace la précédente. Les masters de chaque plugin servent à résoudre l'origine des FormID ; leur présence et leur ordre sont contrôlés.

`id` combine le nom du plugin d'origine en minuscules et l'identifiant local hexadécimal : `skyrim.esm|00000F`. Cet identifiant ne contient pas l'index de chargement de la session. `plugin_final` indique le fichier qui fournit la dernière définition. Une mise à jour qui renomme un plugin ou renumérote ses objets demandera un rapprochement ; cette clé n'est pas garantie immuable entre versions du mod.

Les noms localisés privilégient les tables françaises, avec repli anglais explicite si nécessaire. Sur les 11 771 définitions finales, 9 578 noms proviennent de tables françaises, 1 374 sont intégrés aux plugins et 819 sont absents. Aucune référence FULL localisée non résolue n'a été détectée. Les noms intégrés ne sont pas traduits automatiquement ; certains restent anglais. Les archives présentes sont indexées, puis les tables libres prennent priorité. Aucune table homonyme entre archives n'a été trouvée sur cette installation ; le rapport signalerait cette ambiguïté pour une extraction future.

## Limites et utilisation dans le registre

Ce résultat est un **catalogue technique candidat**, pas une liste certifiée des objets accessibles sur le serveur. Des objets de test, variantes enchantées, objets de quête ou équipements réservés peuvent subsister. Les drapeaux de jouabilité et de transportabilité sont un premier filtre. Les instances renommées et les créations uniquement définies côté serveur ne sont pas couvertes. Le script n'analyse pas les distributions, inventaires des personnages, scripts, sauvegardes ou restrictions serveur, et n'a pas été comparé exhaustivement avec un export xEdit.

L'ordre fourni est utilisé tel quel ; les réglages de chargement d'archives et les traductions éventuelles d'interface ne sont pas reconstruits. La lecture BSA contrôle les bornes et tailles décompressées ; les checksums optionnels LZ4 ne sont pas vérifiés.

Pour l'application, conserver l'identité technique et ajouter ensuite un libellé métier français, des alias de recherche et un statut de validation. Ne pas fusionner automatiquement deux fiches qui portent le même nom. Les saisies référenceront une fiche validée avec quantité et précisions propres à l'exemplaire. Aucun import Sheets ni changement du formulaire Prison n'a encore été effectué.

Évolution du 7 septembre : le premier usage applicatif utilise uniquement ID, nom
et type, sans statut de validation ni alias supplémentaire. `Objets.csv` est préparé
par `scripts/prepare-catalogue-objets.mjs`, également exécuté par le build. La ressource
serveur `src/CatalogueObjets.html` permet à l'application de créer automatiquement
la feuille Objets absente lors de la première recherche. Le formulaire Prison prend
en charge une liste d'objets et de quantités ; voir `docs/DATA_MODEL.md`.

## Reproduire et vérifier

Depuis la racine du dépôt :

```powershell
node scripts/export-skyrim-objects.mjs 'M:\Steam\steamapps\common\Skyrim Special Edition\Data' docs/loadorder.txt docs/catalogue-objets
node scripts/test-export-skyrim-objects.mjs
```

L'export remplace les quatre fichiers générés du dossier de sortie. Tests : résolution des identifiants avec masters dans un ordre différent, remplacements et suppressions, collisions d'ID locaux entre plugins, enregistrements compressés, décompression LZ4 avec copie chevauchante, décodage de caractères accentués, refus de master absent et de sortie dans Data. Contrôle sur l'extraction réelle : identifiants uniques, noms `Or` / `Gold001` et `Épée d'acier` / `SteelSword`, absence de traduction non résolue.

Références techniques : [définitions Skyrim de xEdit](https://raw.githubusercontent.com/TES5Edit/TES5Edit/dev-4.1.6/Core/wbDefinitionsTES5.pas), [lecteur BSA de Bethesda Structs](https://bethesda-structs.readthedocs.io/en/latest/_modules/bethesda_structs/archive/bsa.html), [spécification des frames LZ4](https://raw.githubusercontent.com/lz4/lz4/dev/doc/lz4_Frame_format.md).
