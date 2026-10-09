# Aperçus de la refonte

Captures locales de l’interface compilée, avec **données de démonstration** et
appels Apps Script simulés. Aucun accès ni enregistrement dans le classeur réel.

## Regénérer

```
npm run build      # si src/Index.html n'est pas à jour
npm run apercus    # toutes les pages décrites par le script
npm run apercus -- presences prison
```

`scripts/capture-apercus.mjs` sert `src/Index.html` sur un serveur HTTP local,
remplace `google.script.run` par un stub qui répond avec
`scripts/apercus-donnees.mjs`, puis capture chaque page avec Microsoft Edge via
`playwright-core`. Le navigateur du système est utilisé tel quel : aucun
téléchargement de navigateur, et rien n’est ajouté au bundle Apps Script.

Pour ajouter une page, déclarer une entrée dans la table `apercus` du script et,
si la page a besoin de nouvelles réponses serveur, les ajouter à `reponses` et
aux données. Une entrée peut porter ses propres `reponses`, superposées aux
réponses communes : c'est ainsi que l'on capture une même page sous un autre
rôle, comme `paye-intendant`.

Les lignes de présence de démonstration sont la source unique des aperçus
Présences et Paye. Le tableau de bord et la paye en sont **calculés** — la paye
en exécutant le vrai `getPaye` de `src/Paye.js` dans un contexte `vm` avec des
services Apps Script factices. Un aperçu ne peut donc pas s'écarter de ce que
renvoie le serveur, et une évolution du regroupement se voit à la capture
suivante. Un nom de fonction serveur absent du stub fait échouer l’appel avec
un message explicite plutôt que de laisser un écran de chargement muet.

## Captures reproductibles

Générées par le script, donc rejouables à l’identique :

- `effectifs-1440.png`, `effectifs-390.png` : onglets par corps, vue d'ensemble
  et fiches de service. Le jeu de démonstration couvre sept corps, densité à
  laquelle les défauts d'affichage mobile apparaissent, dont « Inquisition »
  affiché « Garde inquisitoriale », ses grades sous leur alias (« Grand
  Inquisiteur », « Inquisiteur »).
- `organigramme-1440.png`, `organigramme-390.png` : chaîne de commandement,
  les sept corps et garnisons sur la grille à sept colonnes, avec les
  descriptions de grades et les alias de grade de la Garde inquisitoriale.
- `organigramme-grade-1440.png` : un encart de description de grade déplié.
- `presences-1440.png`, `presences-390.png` : tableau de bord OFFICIER,
  accordéons de semaines, coût total par corps.
- `paye-1440.png`, `paye-390.png` : demande de budget par financeur, détail par
  corps puis par garde, cases de règlement.
- `paye-filtre-1440.png` : un seul financeur retenu — le total en tête suit le
  filtre et porte son nom.
- `paye-intendant-1440.png` : la même page vue par un INTENDANT — navigation
  réduite à ses cinq pages de lecture, aucune case à cocher.

La table `apercus` et les données de démonstration sont communes : les captures
Présences et Paye décrivent le même registre, donc les impayés repérés semaine
par semaine sont exactement ceux que la Paye regroupe par financeur.
- `prison-1440.png`, `prison-390.png` : registre et fiches mobiles.
- `prison-formulaire-390.png` : nouvelle incarcération, saisies sur la personne.
- `inventaire-1440.png`, `inventaire-390.png` : coffres, formulaire « Ranger un
  objet » déplié, tableau des stocks avec boutons + / −, coffre déroulant et
  retrait.
- `inventaire-intendant-1440.png` : la même page vue par un INTENDANT —
  navigation à cinq entrées, aucune commande.
- `peines-1440.png`, `peines-390.png` : décrets de peines et amendes, filtrés sur
  le Corpus Juriscivilis — fourchettes, niveaux, rachat nobiliaire, crimes de
  sang, peine maximale ; fiches sur téléphone.
- `peines-principes-1440.png` : le mode d'emploi déplié — échelons, règles,
  noblesse.
- `peines-article-1440.png` : lecture d'un article avec son barème, la popup
  commune au Codex et aux registres.
- `amendes-bareme-1440.png`, `amendes-bareme-390.png` : formulaire d'amende,
  deux chefs, requalification en crime retenue, proposition cumulée reportée
  dans le montant.

Les aperçus du barème lisent le vrai barème initial (`src/PeinesAmendes.js`
exécuté dans un contexte `vm`) et un Codex reconstitué depuis les copies
locales des textes (`scripts/codex-local.mjs`), pour afficher les vrais
titres. La page Codex garde son petit Codex de démonstration : avec ses
quelque 450 articles, la capture pleine page serait démesurée. Le harnais
ramène la page en haut avant chaque capture : après une saisie, les éléments
fixes (barre latérale, lien d'évitement) étaient peints décalés.

## Captures antérieures

Produites le 13 septembre 2026 par un harnais qui n’a pas été conservé. Elles
restent valables comme référence visuelle mais ne se régénèrent pas avec la
commande ci-dessus.

- `connexion-ordinateur.png`, `connexion-mobile.png` : entrée dans le registre.
- `amendes-1440.png`, `amendes-390.png` : tableau et fiches mobiles.
- `codex-1440.png`, `codex-390.png` : lecture du Codex.
- `effectifs-1440.png`, `effectifs-390.png`, `effectifs-edition-mobile.png`.
- `formulaire-mobile.png` : saisie d’un motif personnalisé.

## Lecture des captures mobiles

Les captures en pleine hauteur montrent la barre de navigation fixe à la hauteur
du bas de la fenêtre du navigateur, donc au milieu de l’image ; cette barre reste
au bas de l’écran lors du défilement réel.

Le tableau des Présences et les tableaux sur tablette conservent volontairement
leur défilement interne : à 390 px, seules les premières colonnes de jours sont
visibles, la première colonne restant figée.

Vérification navigateur Edge/Chromium à 320, 390, 768 et 1 440 pixels : six pages,
formulaires Amendes/Prison, absence de débordement horizontal du document.
Navigation GARDE/OFFICIER et ouverture clavier du Codex vérifiées ; fermeture
Échap, retour du focus et blocage du défilement sous la modale.
