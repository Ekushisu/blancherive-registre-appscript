// Cache local du catalogue des objets.
//
// Chaque recherche serveur relit les 10 000 fiches de la feuille `Objets` : une
// autocomplétion au serveur met plusieurs secondes par frappe. Les pages qui
// portent un formulaire d'objets (Prison, Inventaire pour un officier)
// préchargent donc le catalogue complet à l'ouverture, le gardent dans
// `localStorage` avec sa version, et cherchent en mémoire. La recherche locale
// reproduit exactement `rechercherObjets` du serveur ; `scripts/test-catalogue-
// local.mjs` compare les deux sur un jeu de requêtes.
//
// Le serveur reste le seul juge à l'enregistrement : les objets envoyés sont
// revalidés contre la feuille. Le cache n'est qu'un confort de saisie, et une
// panne du cache retombe sur la recherche serveur d'aujourd'hui.

export const CLE_CATALOGUE_LOCAL = 'blancherive.catalogue-objets.v1';
const RESULTATS_MAX = 15;

export function normaliserRechercheObjet(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/*
  Forme de travail : la réponse serveur est un tableau compact [id, nom, type],
  qu'on enrichit une fois des chaînes normalisées, pour que chaque frappe ne
  normalise pas 10 000 noms.
*/
export function preparerCatalogue(reponse) {
  if (!reponse || !Array.isArray(reponse.objets)) throw new Error('Catalogue des objets illisible.');
  const alias = reponse.alias && typeof reponse.alias === 'object' ? reponse.alias : {};
  const objets = reponse.objets.map(([id, nom, type]) => {
    const idBas = String(id).toLowerCase();
    return {
      id: String(id), nom: String(nom), type: String(type),
      _nom: normaliserRechercheObjet(nom),
      _id: idBas,
      _local: idBas.split('|').pop().replace(/^0+/, '') || '0',
      _texte: `${normaliserRechercheObjet(nom)} ${idBas} ${alias[idBas] || ''}`
    };
  });
  return { version: String(reponse.version || ''), total: objets.length, objets };
}

/*
  Miroir de `rechercherObjets` (src/Objets.js) : même seuil de trois
  caractères, même identifiant numérique, même classement, quinze résultats.
*/
export function rechercherObjetsLocal(catalogue, recherche) {
  if (typeof recherche !== 'string' || recherche.length > 100) throw new Error('Recherche d’objet invalide (100 caractères maximum).');
  const query = normaliserRechercheObjet(recherche);
  if (query.length < 3) return { objets: [], tronque: false };
  const terms = query.split(/\s+/);
  const numericId = /^[0-9a-f]{3,8}$/.test(query) ? query.replace(/^0+/, '') || '0' : null;
  const matches = [];
  for (const o of catalogue.objets) {
    const exactId = o._id === query || (numericId !== null && numericId === o._local);
    if (exactId || terms.every(term => o._texte.includes(term))) {
      matches.push({ objet: o, rank: exactId ? 0 : o._nom === query ? 1 : o._nom.startsWith(query) ? 2 : 3 });
    }
  }
  matches.sort((a, b) => a.rank - b.rank || a.objet.nom.localeCompare(b.objet.nom, 'fr') || a.objet.id.localeCompare(b.objet.id));
  return {
    objets: matches.slice(0, RESULTATS_MAX).map(m => ({ id: m.objet.id, nom: m.objet.nom, type: m.objet.type })),
    tronque: matches.length > RESULTATS_MAX
  };
}

// --- Stockage local -------------------------------------------------------

function lireStockage() {
  try {
    const brut = globalThis.localStorage?.getItem(CLE_CATALOGUE_LOCAL);
    if (!brut) return null;
    const stocke = JSON.parse(brut);
    return stocke && typeof stocke.version === 'string' && Array.isArray(stocke.objets) ? stocke : null;
  } catch { return null; }
}

function ecrireStockage(reponse) {
  // Quota dépassé ou mémoire refusée : le catalogue reste en mémoire pour la page.
  try { globalThis.localStorage?.setItem(CLE_CATALOGUE_LOCAL, JSON.stringify({ version: reponse.version, alias: reponse.alias || {}, objets: reponse.objets })); }
  catch { /* repli silencieux */ }
}

// --- Chargement ----------------------------------------------------------

let catalogueCourant = null;
let chargementEnCours = null;

export function catalogueEnMemoire() { return catalogueCourant; }

/*
  Précharge le catalogue : version connue envoyée au serveur, qui ne renvoie
  les 10 000 fiches que si elles ont changé. Les appels simultanés partagent
  la même requête. La version en mémoire est servie tout de suite, puis
  rafraîchie.
*/
export function chargerCatalogue(serverCall, token) {
  if (chargementEnCours) return chargementEnCours;
  const stocke = lireStockage();
  if (stocke && !catalogueCourant) catalogueCourant = preparerCatalogue(stocke);
  chargementEnCours = (async () => {
    try {
      const reponse = await serverCall('getCatalogueObjets', token, catalogueCourant?.version || '');
      if (reponse && Array.isArray(reponse.objets)) {
        catalogueCourant = preparerCatalogue(reponse);
        ecrireStockage(reponse);
      } else if (!catalogueCourant) {
        throw new Error('Le serveur n’a pas renvoyé le catalogue.');
      }
      return catalogueCourant;
    } finally { chargementEnCours = null; }
  })();
  return chargementEnCours;
}

// Réservé aux tests.
export function reinitialiserCatalogue() { catalogueCourant = null; chargementEnCours = null; }

/*
  Hook de page : lance le préchargement à l'ouverture si `actif` (le rôle
  permet le formulaire), et expose le catalogue dès qu'il est disponible.
*/
export function useCatalogue(serverCall, token, actif = true) {
  const { useEffect, useState } = React;
  const [etat, setEtat] = useState(() => ({ objets: actif ? catalogueEnMemoire() : null, statut: actif ? (catalogueEnMemoire() ? 'pret' : 'chargement') : 'inactif', erreur: '' }));
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    setEtat(e => ({ ...e, statut: e.objets ? 'pret' : 'chargement', erreur: '' }));
    chargerCatalogue(serverCall, token)
      .then(catalogue => { if (vivant) setEtat({ objets: catalogue, statut: 'pret', erreur: '' }); })
      .catch(error => { if (vivant) setEtat(e => ({ objets: e.objets, statut: e.objets ? 'pret' : 'erreur', erreur: error.message || String(error) })); });
    return () => { vivant = false; };
  }, [serverCall, token, actif]);
  return etat;
}
