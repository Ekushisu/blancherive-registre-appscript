# Scripts attachés aux plugins — installation Keizaal

Extraction locale du 21 septembre 2026, en lecture seule, des 37 plugins de
`docs/loadorder.txt`. Aucun contact avec le serveur : le script ne fait que lire les
fichiers `.esp` / `.esm` présents dans `Data`.

Régénération :

```
node --max-old-space-size=8192 scripts/export-skyrim-scripts.mjs \
  "M:\Steam\steamapps\common\Skyrim Special Edition\Data" \
  docs/loadorder.txt docs/scripts-papyrus "84056209, 83973250, 457107"
```

Le quatrième argument est facultatif : une liste de FormID à résoudre (décimal, ou
hexadécimal avec ou sans `0x`). C'est ce qui permet de relire une trace de jeu.

## Ce que contient réellement un `.esp`

Un plugin ne contient **pas** de code Papyrus. Il contient, sur chaque enregistrement,
un sous-enregistrement `VMAD` (*Virtual Machine Adapter*) qui déclare les scripts
attachés, leurs propriétés et les valeurs câblées dessus. Le code lui-même vit
ailleurs :

| Quoi | Où | Comment l'ouvrir |
|---|---|---|
| Attachement + propriétés | `VMAD` dans le `.esp` | ces CSV, ou SSEEdit |
| Code compilé | `Data/Scripts/*.pex`, parfois dans un `.bsa` | BSA Browser pour extraire |
| Source | `Data/Scripts/Source/` et `Data/Source/Scripts/` | éditeur de texte |
| Décompilation | à partir d'un `.pex` sans source | `Champollion.exe Script.pex -p Source` |

## Fichiers à consulter

- **index-scripts.csv** : un script par ligne — nombre d'attachements, types
  d'enregistrements concernés, plugins, et la liste des propriétés vues. C'est le
  point d'entrée : 11 463 scripts distincts pour 24 132 attachements.
- **scripts-attaches.csv** : un couple (enregistrement, script) par ligne, avec la
  cellule d'origine quand l'enregistrement est un placement.
- **scripts-keizaal.csv** : le sous-ensemble dont le plugin d'origine ou le plugin
  gagnant est un plugin Keizaal / Kzl.
- **proprietes-scripts.csv** : une propriété par ligne. La colonne `valeur` donne la
  valeur brute, `valeur_lisible` y accroche l'editor id des objets référencés.
- **scripts-retires.csv** : enregistrements dont un plugin ultérieur reprend la
  définition **sans** `VMAD`, donc dont les scripts sautent au chargement. 2 348 cas
  ici ; c'est la première chose à regarder quand un script « ne part pas ».
- **recherche-formids.csv** : résolution des FormID passés en argument.
- **rapport-scripts.json** : load order, sha256 de chaque plugin, compteurs.

CSV UTF-8 avec BOM et séparateur point-virgule, ouvrables dans Excel.

## Résolution des FormID d'une trace

Les identifiants qui apparaissent en jeu sont des FormID *d'exécution*, pas les
identifiants stockés sur disque :

- index `00` à `FD` : position du plugin parmi les plugins **non légers**, dans
  l'ordre de `loadorder.txt` ;
- index `FE` : plugin léger (ESL), adressé `FE xxx yyy` où `xxx` est le rang parmi
  les plugins légers et `yyy` les douze bits de poids faible.

`recherche-formids.csv` applique cette règle. Exemple, la trace de craft du
21 septembre 2026 :

| Trace | FormID | Résolution |
|---|---|---|
| `craftInputObjects [{"baseId":457107,"count":4}]` | `0x0006F993` | 4 × `Firewood01` (Skyrim.esm) |
| `resultObjectId 83973250` | `0x05015482` | `KzlCharcoalTier2`, « Charcoal » (Keizaal.esp) |
| `workbench 84056209` | `0x05029891` | placement dans Keizaal.esp, sans editor id |

## Limite importante : le craft multijoueur n'est pas du Papyrus

La trace ci-dessus ne vient pas d'un script Papyrus mais du client multijoueur
**SkyMP** (`Data/SKSE/Plugins/MpClientPlugin.dll` et `Data/Platform/`). Les noms de
la forme `_0x3a6cec` sont des noms de fonctions JavaScript minifiées, pas des noms de
scripts Papyrus : ils n'apparaîtront jamais dans ces CSV.

Le bundle livré, `Data/Platform/Plugins/skymp5-client.js`, commence par le marqueur
`SKMPENC1` : il est chiffré et déchiffré à l'exécution par `MpClientPlugin.dll`. Il
n'est donc pas lisible tel quel, et ce n'est pas la bonne porte d'entrée. Pour
déboguer le flux de craft, la source lisible est le dépôt du client et du gamemode
côté serveur.

Ces exports restent utiles en complément : ils disent ce que les plugins déclarent
(objets, établis, scripts Papyrus encore attachés), ce que le gamemode manipule par
FormID.

## Attention aux fichiers voisins

`Data/Platform/Plugins/skymp5-client-settings.txt` contient un `accessToken` de
compte. Éviter de le joindre à un rapport de bug, une capture ou un ticket.
