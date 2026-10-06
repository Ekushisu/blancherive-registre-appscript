// Barème des peines et amendes : cache local et propositions des formulaires.
//
// `getPeinesAmendes` renvoie les lignes de la feuille PeinesAmendes avec une
// version. Comme le Codex (`codex.js`), on les garde dans `localStorage` et
// le serveur ne les renvoie que si la feuille a changé : les pages Codex,
// Amendes, Prison et « Décrets de peines et amendes » partagent la même copie.
//
// Le barème propose, il n'impose pas. Les formulaires reprennent la
// proposition dans le champ de montant ou de durée, que l'autorité corrige
// librement ; le serveur n'en vérifie rien.

import { cleArticle, normaliserTexteCodex, rangQualification } from './codex.js';

export const CLE_PEINES_LOCAL = 'blancherive.peines.v1';
export const ORDRE_ECHELONS = ['C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4', 'K1', 'K2', 'K3', 'K4', 'PM'];
export const QUALIFICATIONS_BAREME = ['contravention', 'délit', 'crime', 'spéciale', 'renvoi'];
export const FOURCHETTES = {
  contravention: { libelle: 'Contravention', fourchette: 'jusqu’à 500 septims', peines: 'Amende simple ou travaux légers' },
  'délit': { libelle: 'Délit', fourchette: 'de 500 à 2 500 septims', peines: 'Amende élevée ou travaux forcés' },
  crime: { libelle: 'Crime', fourchette: 'au-delà de 2 500 septims', peines: 'Amende forte, emprisonnement ou peine de mort' }
};
// Délai de l'article 8 du De Re Nobilitatis : une contravention ou un délit
// isolé sur sept jours n'est pas poursuivi contre un noble.
export const JOURS_FAIT_ISOLE_NOBLE = 7;

const LIBELLES_QUALIFICATION = { contravention: 'Contravention', 'délit': 'Délit', crime: 'Crime', 'spéciale': 'Sanction spéciale', renvoi: 'Renvoi' };

export function libelleQualification(qualification) {
  return LIBELLES_QUALIFICATION[qualification] || qualification || '';
}

export function formatSeptims(valeur) {
  const n = Number(valeur) || 0;
  return `${new Intl.NumberFormat('fr-FR').format(n)} septim${Math.abs(n) > 1 ? 's' : ''}`;
}

export function formatDuree(valeur) {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (Number.isInteger(n)) return `${n} h`;
  const h = Math.floor(n), m = Math.round((n - h) * 60);
  return `${h} h ${m} min`;
}

/*
  Forme de travail. Les lignes d'un article sont indexées par la même clé que
  le Codex, source et numéro ; une ligne « * » vaut pour toute sa source, à
  défaut de ligne propre à l'article.
*/
export function preparerPeines(reponse) {
  if (!reponse || !Array.isArray(reponse.lignes)) throw new Error('Barème des peines illisible.');
  const parCle = new Map();
  const lignes = reponse.lignes.map((l, index) => {
    const ligne = {
      ...l,
      amende: nombreOuNull(l.amende),
      cachot: nombreOuNull(l.cachot),
      nobiliaire: nombreOuNull(l.nobiliaire),
      sang: l.sang === true,
      avertissements: Array.isArray(l.avertissements) ? l.avertissements : [],
      _index: index,
      _cle: cleArticle(l.source, l.article),
      _renvoi: l.qualification === 'renvoi',
      _pm: l.echelon === 'PM',
      _texte: normaliserTexteCodex(`${l.source} ${l.article} ${l.intitule} ${l.niveau} ${l.complements} ${l.observations}`)
    };
    if (!parCle.has(ligne._cle)) parCle.set(ligne._cle, []);
    parCle.get(ligne._cle).push(ligne);
    return ligne;
  });
  return {
    version: String(reponse.version || ''),
    lignes,
    parCle,
    anomalies: Array.isArray(reponse.anomalies) ? reponse.anomalies : []
  };
}

function nombreOuNull(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') return null;
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Niveaux applicables à un article : les siens, sinon ceux de toute sa source.
export function niveauxArticle(peines, source, article) {
  if (!peines) return [];
  return peines.parCle.get(cleArticle(source, article)) || peines.parCle.get(cleArticle(source, '*')) || [];
}

/*
  Valeur d'un niveau pour un contrevenant donné. Un noble rachète le cachot
  par l'amende nobiliaire, sauf crime de sang (De Re Nobilitatis, art. 9) ; la
  récidive double la peine encourue (Corpus Proceduralis, définitions).
*/
export function valeurNiveau(niveau, { noble = false, recidive = false } = {}) {
  const facteur = recidive ? 2 : 1;
  const rachat = Boolean(noble && niveau.cachot && !niveau.sang && niveau.nobiliaire);
  const amende = rachat ? niveau.nobiliaire : niveau.amende;
  const cachot = rachat ? null : niveau.cachot;
  return {
    amende: amende ? amende * facteur : null,
    cachot: cachot ? cachot * facteur : null,
    rachat
  };
}

// Ordre de gravité : qualification, peine maximale, puis amende et cachot.
export function comparerGravite(a, b) {
  return rangQualification(a.qualification) - rangQualification(b.qualification) ||
    Number(a._pm) - Number(b._pm) ||
    (a.amende || 0) - (b.amende || 0) ||
    (a.cachot || 0) - (b.cachot || 0);
}

/*
  Proposition d'un formulaire. Chaque chef retient un de ses niveaux (`choix`,
  indexé par la clé de l'article, le premier par défaut). Des faits distincts
  cumulent leurs peines ; un même fait qualifié deux fois n'en garde que la
  qualification la plus rigoureuse (Code pénal local, art. 3).
*/
export function propositionBareme(peines, chefs, reglages = {}) {
  const { choix = {}, noble = false, recidive = false, mode = 'cumul' } = reglages;
  const lignes = (chefs || []).map(chef => {
    if (chef.libre !== undefined) return { chef, libre: true, niveaux: [], renvois: [], niveau: null, valeur: null };
    const cle = cleArticle(chef.source, chef.article);
    const tous = niveauxArticle(peines, chef.source, chef.article);
    const niveaux = tous.filter(n => !n._renvoi);
    let index = Number(choix[cle]);
    if (!Number.isInteger(index) || index < 0 || index >= niveaux.length) index = 0;
    const niveau = niveaux[index] || null;
    return { chef, cle, niveaux, renvois: tous.filter(n => n._renvoi), index, niveau, valeur: niveau ? valeurNiveau(niveau, { noble, recidive }) : null };
  });
  const retenues = lignes.filter(l => l.niveau);
  const cumul = retenues.reduce((t, l) => ({ amende: t.amende + (l.valeur.amende || 0), cachot: t.cachot + (l.valeur.cachot || 0) }), { amende: 0, cachot: 0 });
  const plusGrave = retenues.reduce((g, l) => !g || comparerGravite(l.niveau, g.niveau) > 0 ? l : g, null);
  const grave = plusGrave ? { amende: plusGrave.valeur.amende || 0, cachot: plusGrave.valeur.cachot || 0 } : { amende: 0, cachot: 0 };
  const total = mode === 'grave' ? grave : cumul;
  return {
    lignes,
    mode: mode === 'grave' ? 'grave' : 'cumul',
    total: { amende: total.amende || null, cachot: total.cachot || null },
    cumul: { amende: cumul.amende || null, cachot: cumul.cachot || null },
    grave: { amende: grave.amende || null, cachot: grave.cachot || null },
    plusGrave,
    qualification: plusGrave ? plusGrave.niveau.qualification : '',
    retenues: retenues.length,
    peineMaximale: retenues.some(l => l.niveau._pm),
    sang: retenues.some(l => l.niveau.sang),
    rachat: retenues.some(l => l.valeur.rachat),
    // Article 8 du De Re Nobilitatis : contraventions et délits seulement.
    mineur: retenues.length > 0 && retenues.every(l => l.niveau.qualification === 'contravention' || l.niveau.qualification === 'délit'),
    sansBareme: lignes.filter(l => !l.libre && !l.niveaux.length && !l.renvois.length).length,
    libres: lignes.filter(l => l.libre).length,
    renvois: lignes.filter(l => l.renvois.length)
  };
}

/*
  Résumé d'un article pour une puce du Codex : fourchette des amendes, cachot
  le plus long, peine maximale ou renvoi.
*/
export function resumeNiveaux(niveaux) {
  const chiffres = (niveaux || []).filter(n => !n._renvoi);
  if (!chiffres.length) return niveaux?.length ? 'Renvoi' : '';
  // La peine maximale ne se chiffre pas : elle ne fait pas dire « jusqu'à ».
  const chiffrables = chiffres.filter(n => !n._pm);
  const amendes = chiffrables.map(n => n.amende).filter(Boolean);
  const cachots = chiffrables.map(n => n.cachot).filter(Boolean);
  const parts = [];
  if (amendes.length) {
    const min = Math.min(...amendes), max = Math.max(...amendes);
    parts.push(min === max ? formatSeptims(min) : `${new Intl.NumberFormat('fr-FR').format(min)} à ${formatSeptims(max)}`);
  }
  if (cachots.length) {
    const max = Math.max(...cachots);
    parts.push(`${cachots.length < chiffrables.length || Math.min(...cachots) !== max ? 'jusqu’à ' : ''}${formatDuree(max)} de cachot`);
  }
  if (chiffres.some(n => n._pm)) parts.push('peine maximale');
  return parts.join(' · ');
}

/*
  Échelons tels que la feuille les applique : pour chaque code, les valeurs
  les plus fréquentes et le nombre de lignes qui s'en écartent. La grille
  suit donc la feuille, sans table à tenir à jour en double.
*/
export function grilleEchelons(peines) {
  const groupes = new Map();
  for (const l of peines?.lignes || []) {
    if (!l.echelon || l._renvoi) continue;
    if (!groupes.has(l.echelon)) groupes.set(l.echelon, []);
    groupes.get(l.echelon).push(l);
  }
  const rang = code => { const i = ORDRE_ECHELONS.indexOf(code); return i < 0 ? ORDRE_ECHELONS.length : i; };
  const plusFrequente = valeurs => {
    const frequences = new Map();
    for (const v of valeurs) frequences.set(v, (frequences.get(v) || 0) + 1);
    return [...frequences.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  return [...groupes.entries()].sort((a, b) => rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'fr')).map(([code, lignes]) => {
    const peine = l => `${l.amende}|${l.cachot}`;
    const reference = plusFrequente(lignes.map(peine));
    const modele = lignes.find(l => peine(l) === reference);
    // Un crime de sang n'a pas de rachat par principe (art. 9) : ce n'est pas un écart.
    const rachetables = lignes.filter(l => peine(l) === reference && !l.sang);
    const nobiliaire = rachetables.length ? plusFrequente(rachetables.map(l => l.nobiliaire)) : null;
    const ajustes = lignes.filter(l => peine(l) !== reference || (!l.sang && l.nobiliaire !== nobiliaire)).length;
    return {
      code,
      qualification: modele.qualification,
      amende: modele.amende,
      cachot: modele.cachot,
      nobiliaire,
      niveaux: lignes.length,
      articles: new Set(lignes.map(l => l._cle)).size,
      ajustes
    };
  });
}

/*
  Entrées d'un registre au nom d'une personne dans les sept jours qui
  précèdent une date (De Re Nobilitatis, art. 8). Les dates du registre sont
  au format jj/mm/aaaa ; une date illisible n'est jamais retenue.
*/
export function entreesRecentes(rows, nom, dateIso, { champ = 'contrevenant', exclureRow = null, jours = JOURS_FAIT_ISOLE_NOBLE } = {}) {
  const cible = normaliserTexteCodex(nom);
  const fin = jourIso(dateIso);
  if (!cible || fin === null) return [];
  return (rows || []).filter(row => {
    if (exclureRow !== null && row.row === exclureRow) return false;
    if (normaliserTexteCodex(row[champ]) !== cible) return false;
    const jour = jourRegistre(row.date);
    return jour !== null && jour <= fin && fin - jour <= jours;
  });
}

function jourIso(valeur) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valeur || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000 : null;
}

function jourRegistre(valeur) {
  const texte = String(valeur || '').trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texte);
  return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) / 86400000 : jourIso(texte);
}

// --- Stockage local ----------------------------------------------------

function lireStockage() {
  try {
    const brut = globalThis.localStorage?.getItem(CLE_PEINES_LOCAL);
    if (!brut) return null;
    const stocke = JSON.parse(brut);
    return stocke && typeof stocke.version === 'string' && Array.isArray(stocke.lignes) ? stocke : null;
  } catch { return null; }
}

function ecrireStockage(reponse) {
  try { globalThis.localStorage?.setItem(CLE_PEINES_LOCAL, JSON.stringify({ version: reponse.version, lignes: reponse.lignes, anomalies: reponse.anomalies || [] })); }
  catch { /* quota ou stockage refusé : le barème reste en mémoire */ }
}

// --- Chargement --------------------------------------------------------

let peinesCourant = null;
let chargementEnCours = null;

export function peinesEnMemoire() { return peinesCourant; }

export function chargerPeines(serverCall, token) {
  if (chargementEnCours) return chargementEnCours;
  const stocke = lireStockage();
  if (stocke && !peinesCourant) {
    try { peinesCourant = preparerPeines(stocke); } catch { peinesCourant = null; }
  }
  chargementEnCours = (async () => {
    try {
      const reponse = await serverCall('getPeinesAmendes', token, peinesCourant?.version || '');
      if (reponse && Array.isArray(reponse.lignes)) {
        peinesCourant = preparerPeines(reponse);
        ecrireStockage(reponse);
      } else if (!peinesCourant) {
        throw new Error('Le serveur n’a pas renvoyé le barème des peines.');
      }
      return peinesCourant;
    } finally { chargementEnCours = null; }
  })();
  return chargementEnCours;
}

// Réservé aux tests.
export function reinitialiserPeines() { peinesCourant = null; chargementEnCours = null; }

/*
  `actif` à faux pour le visiteur public : le serveur lui refuse le barème,
  la lecture d'un article s'affiche alors sans lui.
*/
export function usePeines(serverCall, token, actif = true) {
  const { useEffect, useState } = React;
  const [etat, setEtat] = useState(() => ({ peines: actif ? peinesEnMemoire() : null, statut: actif ? (peinesEnMemoire() ? 'pret' : 'chargement') : 'inactif', erreur: '' }));
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    setEtat(e => ({ ...e, statut: e.peines ? 'pret' : 'chargement', erreur: '' }));
    chargerPeines(serverCall, token)
      .then(peines => { if (vivant) setEtat({ peines, statut: 'pret', erreur: '' }); })
      .catch(error => { if (vivant) setEtat(e => ({ peines: e.peines, statut: e.peines ? 'pret' : 'erreur', erreur: error.message || String(error) })); });
    return () => { vivant = false; };
  }, [serverCall, token, actif]);
  return etat;
}
