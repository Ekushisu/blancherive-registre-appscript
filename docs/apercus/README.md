# Aperçus de la refonte

Captures locales de l’interface compilée, avec **données de démonstration** et
appels Apps Script simulés. Aucun accès ni enregistrement dans le classeur réel.

- `connexion-ordinateur.png`, `connexion-mobile.png` : entrée dans le registre.
- `organigramme-1440.png`, `organigramme-390.png` : navigation et commandement.
- `amendes-1440.png`, `amendes-390.png` : tableau et fiches mobiles.
- `codex-1440.png`, `codex-390.png` : lecture du Codex.
- `formulaire-mobile.png` : saisie d’un motif personnalisé.

Vérification navigateur Edge/Chromium à 320, 390, 768 et 1 440 pixels : six pages,
formulaires Amendes/Prison, absence de débordement horizontal du document.
Le tableau des Présences et les tableaux sur tablette conservent volontairement
leur défilement interne. Navigation GARDE/OFFICIER et ouverture clavier du Codex
vérifiées ; fermeture Échap, retour du focus et blocage du défilement sous la modale.

Les captures mobiles longues montrent la barre de navigation fixe à la hauteur
du bas de la fenêtre du navigateur ; cette barre reste au bas de l’écran lors
du défilement réel.
