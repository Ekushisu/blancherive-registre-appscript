// Cache local du Codex et recherche des chefs d'accusation.
//
// `getCodex` renvoie les quelque 470 articles avec leur texte intégral. Les
// pages Codex, Amendes et Prison en ont toutes besoin : on le charge une fois,
// on le garde dans `localStorage` avec sa version, et on le renvoie au serveur
// à l'appel suivant, qui ne renvoie rien tant que le cache SyncCodex n'a pas
// changé. Même mécanisme que `catalogue.js` pour les objets.
//
// La recherche des chefs d'accusation se fait ici, en mémoire : numéro
// d'article, sigle de source, titre, texte, qualification. Le serveur reste
// seul juge à l'enregistrement, il revalide chaque chef contre SyncCodex.

export const CLE_CODEX_LOCAL = 'blancherive.codex.v1';
export const CHEFS_MAX = 20;
export const MOTIF_LIBRE_MAX = 1000;
export const PREFIXE_LIBRE = 'Motif personnalisé — ';
const SUGGESTIONS_MAX = 12;

export function normaliserTexteCodex(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();
}

// Même clé que `cleArticleCodex_` côté serveur : source et numéro, sans titre.
export function cleArticle(source, article) {
  return `${String(source || '').replace(/ /g, ' ').trim().toLowerCase()}|${String(article || '').replace(/ /g, ' ').trim().toLowerCase()}`;
}

// Groupe d'affichage d'une famille : filtres rapides et ordre de classement.
export function groupeFamille(famille) {
  const f = normaliserTexteCodex(famille);
  if (f.includes('blancherive')) return 'blancherive';
  if (f.includes('decret')) return 'decrets';
  if (f.includes('imperial') || f.includes('special')) return 'imperial';
  return 'autres';
}
const ORDRE_GROUPES = { blancherive: 0, imperial: 1, decrets: 2, autres: 3 };

// Rang de gravité d'une qualification, pour le résumé du formulaire.
export function rangQualification(classification) {
  const c = normaliserTexteCodex(classification);
  if (!c) return 0;
  if (c.includes('crime')) return 3;
  if (c.includes('delit')) return 2;
  if (c.includes('contravention')) return 1;
  return 0;
}
export const QUALIFICATIONS = ['', 'contravention', 'délit', 'crime'];
export const BAREME_IMPERIAL = {
  contravention: 'jusqu’à 500 septims',
  'délit': 'de 500 à 2 500 septims',
  crime: 'au-delà de 2 500 septims'
};

function numeroTri(article) {
  const m = String(article || '').match(/^(\d+)(?:-(\d+))?/);
  return m ? Number(m[1]) * 1000 + Number(m[2] || 0) : Number.MAX_SAFE_INTEGER;
}

/*
  Forme de travail : les chaînes normalisées sont calculées une fois, pour que
  chaque frappe ne normalise pas 470 textes.
*/
export function preparerCodex(reponse) {
  if (!reponse || !Array.isArray(reponse.articles) || !Array.isArray(reponse.sources)) throw new Error('Codex illisible.');
  const parCle = new Map();
  const articles = reponse.articles.map(a => {
    const article = {
      ...a,
      abrege: a.abrege || a.source,
      citable: a.citable !== false,
      _cle: cleArticle(a.source, a.article),
      _num: normaliserTexteCodex(a.article),
      _titre: normaliserTexteCodex(a.titre),
      _texte: normaliserTexteCodex(`${a.titre} ${a.texte} ${a.sanction} ${a.classification}`),
      _source: normaliserTexteCodex(a.source),
      _abrege: normaliserTexteCodex(a.abrege || a.source),
      _groupe: groupeFamille(a.famille),
      _tri: numeroTri(a.article)
    };
    parCle.set(article._cle, article);
    return article;
  });
  const sources = reponse.sources.map(s => ({ ...s, abrege: s.abrege || s.nom, citable: s.citable !== false, _abrege: normaliserTexteCodex(s.abrege || s.nom), _nom: normaliserTexteCodex(s.nom) }));
  return { version: String(reponse.version || ''), articles, sources, parCle };
}

export function articleParCle(codex, source, article) {
  return codex?.parCle?.get(cleArticle(source, article)) || null;
}

/*
  Recherche des chefs d'accusation. Termes en ET, sans accents. Un terme égal
  au sigle ou au nom d'une source restreint à cette source ; un terme
  numérique (« 16 », « 15-1 ») vise d'abord le numéro d'article. Classement :
  numéro exact, titre égal, titre commençant par la saisie, titre contenant
  tous les termes, texte contenant tous les termes ; à rang égal, droit de
  Blancherive, droit impérial, décrets, puis numéro d'article.
*/
export function rechercherArticlesLocal(codex, recherche, filtres = {}) {
  if (typeof recherche !== 'string' || recherche.length > 200) throw new Error('Recherche invalide (200 caractères maximum).');
  const query = normaliserTexteCodex(recherche).replace(/\b(art|article|articles)\.?\s*/g, '');
  const groupe = filtres.groupe || '';
  const classification = filtres.classification || '';
  const termes = query.split(' ').filter(Boolean);
  const sourcesForcees = new Set();
  const numeros = [];
  const mots = [];
  for (const terme of termes) {
    const source = codex.sources.find(s => s._abrege === terme || s._nom === terme);
    if (source) { sourcesForcees.add(normaliserTexteCodex(source.nom)); continue; }
    if (/^\d+(-\d+)?$/.test(terme)) numeros.push(terme);
    mots.push(terme);
  }
  if (!termes.length) return { articles: [], tronque: false, total: 0 };
  const matches = [];
  for (const a of codex.articles) {
    if (!a.citable) continue;
    if (groupe && a._groupe !== groupe) continue;
    if (classification && rangQualification(a.classification) !== rangQualification(classification)) continue;
    if (sourcesForcees.size && !sourcesForcees.has(a._source)) continue;
    let rank;
    if (numeros.length && numeros.includes(a._num) && mots.every(m => m === a._num || a._texte.includes(m))) rank = 0;
    else if (!mots.length) rank = sourcesForcees.size ? 6 : -1;
    else if (a._titre === mots.join(' ')) rank = 1;
    else if (a._titre.startsWith(mots.join(' '))) rank = 2;
    else if (mots.every(m => a._titre.includes(m))) rank = 3;
    else if (mots.every(m => a._texte.includes(m))) rank = 4;
    else rank = -1;
    if (rank >= 0) matches.push({ a, rank });
  }
  matches.sort((x, y) => x.rank - y.rank || ORDRE_GROUPES[x.a._groupe] - ORDRE_GROUPES[y.a._groupe] ||
    x.a.source.localeCompare(y.a.source, 'fr') || x.a._tri - y.a._tri || x.a.article.localeCompare(y.a.article, 'fr'));
  return { articles: matches.slice(0, SUGGESTIONS_MAX).map(m => m.a), tronque: matches.length > SUGGESTIONS_MAX, total: matches.length };
}

// --- Chefs d'accusation ------------------------------------------------

export function chefDepuisArticle(article) {
  return { source: article.source, article: article.article, titre: article.titre, classification: article.classification || '', abrege: article.abrege || article.source };
}

export function cleChef(chef) {
  return chef.libre !== undefined ? `libre|${normaliserTexteCodex(chef.libre)}` : cleArticle(chef.source, chef.article);
}

export function libelleChef(chef) {
  if (chef.libre !== undefined) return PREFIXE_LIBRE + chef.libre;
  const reference = `${chef.abrege || chef.source} art. ${chef.article}`;
  return chef.titre ? `${reference} — ${chef.titre}` : reference;
}

export function referenceChef(chef) {
  return chef.libre !== undefined ? 'Motif personnalisé' : `${chef.abrege || chef.source} art. ${chef.article}`;
}

export function ajouterChef(chefs, chef) {
  if (!chef) throw new Error('Sélectionnez un article ou saisissez une référence.');
  if (chef.libre !== undefined) {
    const motif = String(chef.libre).replace(/\s+/g, ' ').trim();
    if (!motif || motif.length > MOTIF_LIBRE_MAX) throw new Error(`Un motif personnalisé compte de 1 à ${MOTIF_LIBRE_MAX} caractères.`);
    chef = { libre: motif };
  }
  const cle = cleChef(chef);
  if (chefs.some(c => cleChef(c) === cle)) throw new Error('Ce chef d’accusation est déjà retenu.');
  if (chefs.length >= CHEFS_MAX) throw new Error(`Une même entrée ne peut porter plus de ${CHEFS_MAX} chefs d’accusation.`);
  return [...chefs, chef];
}

export function retirerChef(chefs, chef) {
  const cle = cleChef(chef);
  return chefs.filter(c => cleChef(c) !== cle);
}

// Forme envoyée au serveur : références seules, jamais le titre.
export function chefsPourServeur(chefs) {
  return chefs.map(c => c.libre !== undefined ? { libre: c.libre } : { source: c.source, article: c.article });
}

export function qualificationMax(chefs) {
  return QUALIFICATIONS[Math.max(0, ...chefs.map(c => rangQualification(c.classification)))];
}

/*
  Lignes antérieures à la refonte : la colonne Infraction porte « Art. N —
  Titre » sans nom de source (ancien Codex Judiciaire, caduc) ou un motif
  personnalisé préfixé. On la résout par égalité de libellé puis, à défaut,
  par numéro d'article dans l'ancien Codex Judiciaire, seule source des
  libellés antérieurs au 27 septembre 2026.
*/
export function resoudreLibelleHistorique(codex, label) {
  const texte = String(label || '');
  if (!codex || !texte || texte.startsWith('Motif personnalis')) return null;
  const exact = codex.articles.find(a => a.label === texte);
  if (exact) return exact;
  const m = texte.match(/Art\.?\s*([0-9IVXLCDM.\-]+)/i);
  if (!m) return null;
  return codex.articles.find(a => String(a.article).toLowerCase() === String(m[1]).toLowerCase() && a.source === 'Codex Judiciaire de Blancherive') || null;
}

/*
  Chefs d'une ligne de registre, avec l'article du Codex quand il existe
  encore. Une ligne récente porte `chefs` ; une ligne antérieure n'a que son
  libellé, converti en un chef unique.
*/
export function chefsDeLigne(codex, row) {
  if (Array.isArray(row.chefs) && row.chefs.length) {
    return row.chefs.map(chef => ({ chef, article: chef.libre !== undefined ? null : articleParCle(codex, chef.source, chef.article) }));
  }
  const label = String(row.infraction || '').trim();
  if (!label) return [];
  if (label.startsWith(PREFIXE_LIBRE)) return [{ chef: { libre: label.slice(PREFIXE_LIBRE.length) }, article: null }];
  const article = resoudreLibelleHistorique(codex, label);
  return [{ chef: article ? chefDepuisArticle(article) : { libre: label }, article, historique: true }];
}

// Les chefs les plus enregistrés dans le registre : raccourcis du formulaire.
export function chefsFrequents(codex, rows, limite = 6) {
  const compte = new Map();
  for (const row of rows || []) {
    for (const { chef, article } of chefsDeLigne(codex, row)) {
      if (chef.libre !== undefined || !article) continue;
      const cle = cleChef(chef);
      const entree = compte.get(cle) || { chef: chefDepuisArticle(article), n: 0 };
      entree.n++;
      compte.set(cle, entree);
    }
  }
  return [...compte.values()].sort((a, b) => b.n - a.n).slice(0, limite).map(e => e.chef);
}

// --- Stockage local ----------------------------------------------------

function lireStockage() {
  try {
    const brut = globalThis.localStorage?.getItem(CLE_CODEX_LOCAL);
    if (!brut) return null;
    const stocke = JSON.parse(brut);
    return stocke && typeof stocke.version === 'string' && Array.isArray(stocke.articles) && Array.isArray(stocke.sources) ? stocke : null;
  } catch { return null; }
}

function ecrireStockage(reponse) {
  try { globalThis.localStorage?.setItem(CLE_CODEX_LOCAL, JSON.stringify({ version: reponse.version, articles: reponse.articles, sources: reponse.sources })); }
  catch { /* quota ou stockage refusé : le Codex reste en mémoire */ }
}

// --- Chargement --------------------------------------------------------

let codexCourant = null;
let chargementEnCours = null;

export function codexEnMemoire() { return codexCourant; }

export function chargerCodex(serverCall, token) {
  if (chargementEnCours) return chargementEnCours;
  const stocke = lireStockage();
  if (stocke && !codexCourant) codexCourant = preparerCodex(stocke);
  chargementEnCours = (async () => {
    try {
      const reponse = await serverCall('getCodex', token, codexCourant?.version || '');
      if (reponse && Array.isArray(reponse.articles)) {
        codexCourant = preparerCodex(reponse);
        ecrireStockage(reponse);
      } else if (!codexCourant) {
        throw new Error('Le serveur n’a pas renvoyé le Codex.');
      }
      return codexCourant;
    } finally { chargementEnCours = null; }
  })();
  return chargementEnCours;
}

// Réservé aux tests.
export function reinitialiserCodex() { codexCourant = null; chargementEnCours = null; }

export function useCodex(serverCall, token, actif = true) {
  const { useEffect, useState } = React;
  const [etat, setEtat] = useState(() => ({ codex: actif ? codexEnMemoire() : null, statut: actif ? (codexEnMemoire() ? 'pret' : 'chargement') : 'inactif', erreur: '' }));
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    setEtat(e => ({ ...e, statut: e.codex ? 'pret' : 'chargement', erreur: '' }));
    chargerCodex(serverCall, token)
      .then(codex => { if (vivant) setEtat({ codex, statut: 'pret', erreur: '' }); })
      .catch(error => { if (vivant) setEtat(e => ({ codex: e.codex, statut: e.codex ? 'pret' : 'erreur', erreur: error.message || String(error) })); });
    return () => { vivant = false; };
  }, [serverCall, token, actif]);
  return etat;
}
