# Références visuelles du manuel

Assets dérivés des documents fournis par le propriétaire pour la refonte du 13 septembre 2026.

- `fort-dragon.jpg` : `design/assets-manuel/illustrations/fort-dragon-croquis/01-exterieur-pont-2x1.png` du projet voisin `manuel-garde-blancherive` ; réduction à 1 000 pixels et composition sur fond papier. **Plus référencé** depuis la refonte de l'écran de connexion du 10 novembre 2026 ; conservé, hors du bundle.
- `releve.jpg` : `design/assets-manuel/illustrations/generiques/04-releve-remparts-3x1.png` ; réduction à 1 200 pixels. **Plus référencé** depuis le retrait du bandeau d'en-tête le 15 septembre 2026 ; conservé au cas où, il n'entre plus dans le bundle.
- `connexion-fond.jpg` : capture du jeu fournie par le propriétaire le 10 novembre 2026 (Blancherive depuis les pins, 2 560 × 1 440), bandeau de boussole et logo rognés (120 px en haut), croix de visée effacée, passage en sépia et contraste renforcé (gravure), réduction à 1 600 × 825, JPEG qualité 74 (334 Ko). Fond pleine page des écrans de connexion et d'activation (`CadreConnexion`, `navigation.jsx`).
- `pilier-nordique.png` : charpente fournie par le propriétaire, affichée en filigrane derrière le contenu. PNG pour la transparence du détourage. Réduit de 724 à 420 pixels de large et postérisé à 8 niveaux par canal, ce qui ramène 2,8 Mo à 202 Ko.
- `parchemin.jpg` : fond orné embarqué dans le PDF `manuel.pdf` fourni, objet image 14.
- `papier.jpg`, `sceau.jpg` : extraits de ce fond (papier intérieur et médaillon au cheval).

Le build incorpore ces fichiers en data URL : **leur poids s'ajoute directement à
`src/Index.html`**, rechargé à chaque ouverture de la Web App. Réduire et
compresser une image avant de l'ajouter n'est pas une coquetterie. Un asset
présent dans ce dossier mais importé par aucun module n'entre pas dans le bundle.

Les originaux du manuel n’ont pas été modifiés. Les copies web sont indépendantes
de son emplacement local. Le build esbuild les incorpore en data URL dans
`src/Index.html` pour permettre leur affichage dans Apps Script sans hébergement
d’images supplémentaire. Aucune nouvelle dépendance frontend.
