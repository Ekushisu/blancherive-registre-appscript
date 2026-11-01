/*
  Nouveautés du Codex, côté navigateur (`ui/src/journal-codex.js`) : passages
  non vus, résumé, articles récents, délai du bouton, différence mot à mot ;
  et le journal gardé dans le cache local du Codex (`ui/src/codex.js`).

    node scripts/test-journal-codex-ui.mjs
*/
import assert from 'node:assert/strict';
import {
  changementsLecteur, changementsRecents, delaiBoutonRestant, depuis, diffMots, ecrireDernierVu, lireDernierVu,
  phraseResume, resumerSynchros, synchrosNonVues, totalLecteur, totalResume, JOURS_RECENTS, DELAI_BOUTON_MS
} from '../ui/src/journal-codex.js';
import { preparerCodex } from '../ui/src/codex.js';

const JOUR = 24 * 60 * 60 * 1000;
const maintenant = Date.parse('2026-11-01T12:00:00.000Z');
const il_y_a = jours => new Date(maintenant - jours * JOUR).toISOString();
const compte = (c = {}) => ({ ajouts: 0, modifications: 0, retraits: 0, documentsAjoutes: 0, documentsRetires: 0, documentsIllisibles: 0, ...c });
const synchro = (jours, c, changements = [], origine = 'editeur') => ({ date: il_y_a(jours), origine, compte: compte(c), changements });

// ---------------------------------------------------------------- lecteur
const s1 = synchro(1, { ajouts: 1, documentsIllisibles: 1 }, [
  { type: 'ajout', source: 'Code A', article: '4', titre: 'Recel' },
  { type: 'document-illisible', source: 'Décret B', article: '', titre: '' }
]);
assert.deepEqual(changementsLecteur(s1).map(c => c.type), ['ajout'], 'Un document illisible ne concerne pas le lecteur');
assert.equal(totalLecteur(s1), 1);
assert.equal(totalLecteur(synchro(1, { documentsIllisibles: 2 })), 0);

// ---------------------------------------------------------------- passages non vus
const journal = [
  synchro(0, { modifications: 2 }),
  synchro(3, {}),
  synchro(5, { retraits: 1 }, [], 'registre'),
  synchro(20, { ajouts: 9 })
];
assert.deepEqual(synchrosNonVues(journal, '', maintenant).map(s => s.date), [il_y_a(0), il_y_a(5)],
  'Jamais vu : les quatorze derniers jours, sans les passages vides');
assert.deepEqual(synchrosNonVues(journal, il_y_a(4), maintenant).map(s => s.date), [il_y_a(0)], 'Vu il y a quatre jours');
assert.deepEqual(synchrosNonVues(journal, il_y_a(0), maintenant), [], 'Tout vu');
assert.equal(JOURS_RECENTS, 14);

// ---------------------------------------------------------------- résumé
const resume = resumerSynchros([synchro(0, { ajouts: 2, documentsAjoutes: 1 }), synchro(1, { modifications: 1, retraits: 3, documentsRetires: 1 })]);
assert.deepEqual(resume, { ajouts: 2, modifications: 1, retraits: 3, documents: 2 });
assert.equal(totalResume(resume), 8);
assert.equal(phraseResume(resume), '2 nouvelles lois, 1 loi modifiée, 3 lois retirées, 2 documents ajoutés ou retirés');
assert.equal(phraseResume(resumerSynchros([synchro(0, { ajouts: 1 })])), '1 nouvelle loi');
assert.equal(phraseResume(resumerSynchros([])), '');

// ---------------------------------------------------------------- articles récents
const recents = changementsRecents([
  synchro(1, {}, [{ type: 'modification', source: 'Code A', article: '1' }, { type: 'retrait', source: 'Code A', article: '3' }]),
  synchro(6, {}, [{ type: 'ajout', source: 'Code A', article: '1' }, { type: 'modification', source: 'Code A', article: '2' }]),
  synchro(30, {}, [{ type: 'ajout', source: 'Code A', article: '9' }])
], maintenant);
assert.equal(recents.get('code a|1'), 'ajout', 'Ajouté puis modifié : nouveau');
assert.equal(recents.get('code a|2'), 'modification');
assert.equal(recents.has('code a|3'), false, 'Un retrait n’a plus d’article à repérer');
assert.equal(recents.has('code a|9'), false, 'Trop ancien');

// ---------------------------------------------------------------- dates et délai
assert.equal(depuis(il_y_a(0), maintenant), 'aujourd’hui');
assert.equal(depuis(il_y_a(1), maintenant), 'hier');
assert.equal(depuis(il_y_a(14), maintenant), 'il y a 14 jours');
assert.equal(depuis('n’importe quoi', maintenant), '');
assert.equal(delaiBoutonRestant(journal, 0, maintenant), 0, 'Dernier passage du registre il y a cinq jours');
assert.equal(delaiBoutonRestant([synchro(0, {}, [], 'registre')], 0, maintenant), DELAI_BOUTON_MS, 'Passage du registre à l’instant');
assert.equal(delaiBoutonRestant([synchro(0, {}, [], 'editeur')], 0, maintenant), 0, 'L’éditeur ne compte pas');
assert.equal(delaiBoutonRestant([], maintenant - 60000, maintenant), DELAI_BOUTON_MS - 60000, 'Clic d’il y a une minute');

// ---------------------------------------------------------------- différence mot à mot
const texte = segments => segments.map(s => s.texte).join('');
let d = diffMots('Le vol est puni de cent septims.', 'Le vol est puni de deux cents septims.');
assert.deepEqual(d.filter(s => s.type !== 'egal'), [{ type: 'retrait', texte: 'cent' }, { type: 'ajout', texte: 'deux cents' }]);
assert.equal(texte(d.filter(s => s.type !== 'ajout')), 'Le vol est puni de cent septims.', 'Égal + retraits = avant');
assert.equal(texte(d.filter(s => s.type !== 'retrait')), 'Le vol est puni de deux cents septims.', 'Égal + ajouts = après');
d = diffMots('Identique.', 'Identique.');
assert.deepEqual(d, [{ type: 'egal', texte: 'Identique.' }]);
d = diffMots('', 'Tout nouveau');
assert.deepEqual(d, [{ type: 'ajout', texte: 'Tout nouveau' }]);
d = diffMots('Ligne un.\nLigne deux.', 'Ligne un.\nLigne trois.');
assert.equal(texte(d.filter(s => s.type !== 'retrait')), 'Ligne un.\nLigne trois.', 'Sauts de ligne conservés');
assert.equal(diffMots('a '.repeat(2000), 'b '.repeat(2000)), null, 'Trop long : on montre les deux textes');

// ---------------------------------------------------------------- dernier vu
const stockage = new Map();
const faux = { getItem: k => stockage.get(k) ?? null, setItem: (k, v) => stockage.set(k, v) };
assert.equal(lireDernierVu(faux), '');
ecrireDernierVu(il_y_a(0), faux);
assert.equal(lireDernierVu(faux), il_y_a(0));
ecrireDernierVu('', faux);
assert.equal(lireDernierVu(faux), il_y_a(0), 'Une date vide n’efface rien');
assert.equal(lireDernierVu({ getItem() { throw new Error('refusé'); } }), '', 'Stockage refusé : rien');

// ---------------------------------------------------------------- cache local du Codex
const prepare = preparerCodex({ version: 'v', articles: [], sources: [], journal });
assert.equal(prepare.journal.length, 4, 'Le journal accompagne le Codex');
assert.deepEqual(preparerCodex({ version: 'v', articles: [], sources: [] }).journal, [], 'Cache antérieur sans journal');

console.log('Nouveautés du Codex (navigateur) : passages non vus, résumé, articles récents, délai, différence et cache validés.');
