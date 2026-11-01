// Nouveautés du Codex, côté navigateur : ce que le journal des
// synchronisations (src/JournalCodex.js), reçu avec le Codex, apprend au
// lecteur. Fonctions pures ; les composants sont dans journal-codex.jsx.

import { cleArticle } from './codex.js';

export const CLE_JOURNAL_VU = 'blancherive.codex.journal-vu.v1';
export const JOURS_RECENTS = 14;
// Même délai que le serveur (`JOURNAL_CODEX_DELAI_BOUTON`), qui seul l'impose.
export const DELAI_BOUTON_MS = 3 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;

// Ce qui intéresse le lecteur : lois et documents, pas les incidents de lecture.
const TYPES_LECTEUR = ['ajout', 'modification', 'retrait', 'document-ajout', 'document-retrait'];

export function changementsLecteur(synchro) {
  return (synchro?.changements || []).filter(c => TYPES_LECTEUR.includes(c.type));
}

export function totalLecteur(synchro) {
  const c = synchro?.compte || {};
  return (c.ajouts || 0) + (c.modifications || 0) + (c.retraits || 0) + (c.documentsAjoutes || 0) + (c.documentsRetires || 0);
}

// Dernier passage déjà vu dans ce navigateur : simple confort, perdu sans dommage.
export function lireDernierVu(stockage = globalThis.localStorage) {
  try { return String(stockage?.getItem(CLE_JOURNAL_VU) || ''); } catch { return ''; }
}

export function ecrireDernierVu(date, stockage = globalThis.localStorage) {
  try { if (date) stockage?.setItem(CLE_JOURNAL_VU, date); } catch { /* stockage refusé */ }
}

/*
  Passages non vus qui changent quelque chose pour le lecteur. Celui qui n'a
  jamais ouvert les nouveautés ne reçoit que ceux des quatorze derniers jours :
  tout l'historique ne lui est pas « nouveau ». Dates ISO : comparables en texte.
*/
export function synchrosNonVues(journal, vu, maintenant = Date.now()) {
  const seuil = vu || new Date(maintenant - JOURS_RECENTS * JOUR_MS).toISOString();
  return (journal || []).filter(s => s.date > seuil && totalLecteur(s) > 0);
}

export function resumerSynchros(synchros) {
  const r = { ajouts: 0, modifications: 0, retraits: 0, documents: 0 };
  for (const s of synchros || []) {
    const c = s.compte || {};
    r.ajouts += c.ajouts || 0;
    r.modifications += c.modifications || 0;
    r.retraits += c.retraits || 0;
    r.documents += (c.documentsAjoutes || 0) + (c.documentsRetires || 0);
  }
  return r;
}

export function totalResume(r) {
  return r.ajouts + r.modifications + r.retraits + r.documents;
}

// « 2 nouvelles lois, 1 loi modifiée, 3 lois retirées, 1 document »
export function phraseResume(r) {
  const s = n => (n > 1 ? 's' : '');
  const parties = [];
  if (r.ajouts) parties.push(`${r.ajouts} nouvelle${s(r.ajouts)} loi${s(r.ajouts)}`);
  if (r.modifications) parties.push(`${r.modifications} loi${s(r.modifications)} modifiée${s(r.modifications)}`);
  if (r.retraits) parties.push(`${r.retraits} loi${s(r.retraits)} retirée${s(r.retraits)}`);
  if (r.documents) parties.push(`${r.documents} document${s(r.documents)} ajouté${s(r.documents)} ou retiré${s(r.documents)}`);
  return parties.join(', ');
}

/*
  Articles changés ces derniers jours, pour les repérer dans la bibliothèque :
  « ajout » l'emporte sur une modification qui l'a suivi.
*/
export function changementsRecents(journal, maintenant = Date.now(), jours = JOURS_RECENTS) {
  const seuil = new Date(maintenant - jours * JOUR_MS).toISOString();
  const recents = new Map();
  for (const synchro of journal || []) {
    if (synchro.date < seuil) continue;
    for (const c of synchro.changements || []) {
      if (c.type !== 'ajout' && c.type !== 'modification') continue;
      const cle = cleArticle(c.source, c.article);
      if (c.type === 'ajout') recents.set(cle, 'ajout');
      else if (!recents.has(cle)) recents.set(cle, 'modification');
    }
  }
  return recents;
}

// « aujourd’hui », « hier », « il y a 14 jours »
export function depuis(dateIso, maintenant = Date.now()) {
  const jours = Math.floor((maintenant - Date.parse(dateIso)) / JOUR_MS);
  if (!Number.isFinite(jours)) return '';
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return 'hier';
  return `il y a ${jours} jours`;
}

/*
  Temps restant avant que le bouton des officiers soit de nouveau utilisable :
  depuis le dernier passage lancé du registre, ou le dernier clic de ce
  navigateur. Indicatif ; le serveur tranche.
*/
export function delaiBoutonRestant(journal, dernierClic = 0, maintenant = Date.now()) {
  const parRegistre = (journal || []).find(s => s.origine === 'registre');
  const reference = Math.max(parRegistre ? Date.parse(parRegistre.date) || 0 : 0, dernierClic || 0);
  return Math.max(0, reference + DELAI_BOUTON_MS - maintenant);
}

// Découpage en mots et en blancs : recollés, ils redonnent le texte exact.
function decouper(texte) {
  return String(texte || '').split(/(\s+)/).filter(morceau => morceau !== '');
}

/*
  Différence mot à mot entre deux textes, par la plus longue sous-suite
  commune, pour montrer ce qu'une modification a changé : segments « egal »,
  « retrait », « ajout ». Début et fin communs sont écartés d'abord ; au-delà
  de 1,5 million de comparaisons, `null` : on montre alors les deux textes.
*/
export function diffMots(avant, apres) {
  const a = decouper(avant), b = decouper(apres);
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let finA = a.length, finB = b.length;
  while (finA > debut && finB > debut && a[finA - 1] === b[finB - 1]) { finA--; finB--; }
  const x = a.slice(debut, finA), y = b.slice(debut, finB);
  if (x.length * y.length > 1500000) return null;

  const n = x.length, m = y.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const segments = [];
  const ajouter = (type, texte) => {
    if (!texte) return;
    const dernier = segments[segments.length - 1];
    if (dernier && dernier.type === type) dernier.texte += texte;
    else segments.push({ type, texte });
  };
  ajouter('egal', a.slice(0, debut).join(''));
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { ajouter('egal', x[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) ajouter('retrait', x[i++]);
    else ajouter('ajout', y[j++]);
  }
  while (i < n) ajouter('retrait', x[i++]);
  while (j < m) ajouter('ajout', y[j++]);
  ajouter('egal', a.slice(finA).join(''));
  return segments;
}
