// Livret de service, côté navigateur : libellés (septims, pluriels,
// carrière, ancienneté du dernier service) et rendu de la page, avec ses
// cas particuliers (inactivité, Hird non soldé, rien en attente). React
// minimal, comme `test-chefs-ui.mjs`.
//
//   node scripts/test-livret-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

let slots = [], cursor = 0, effects = [], dirty = false, tree;
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  Fragment: 'fragment',
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i] = { deps, cleanup: fn() }; });
  },
  useId() { cursor++; return 'id'; },
  useRef(v) { const i = cursor++; return slots[i] ||= { current: v }; }
};
const context = vm.createContext({ React, exports: {}, console, Intl, Date, Promise });
context.module = { exports: context.exports };
context.globalThis = context;
const bundle = await build({ entryPoints: ['ui/src/livret.jsx'], bundle: true, write: false, format: 'cjs',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
vm.runInContext(bundle.outputFiles[0].text, context);
const L = context.module.exports;

// ---------------------------------------------------------------- libellés
const espaces = s => s.replace(/ | /g, ' ');
assert.equal(L.septims(1), '1 septim');
assert.equal(L.septims(0), '0 septim');
assert.equal(espaces(L.septims(1250)), '1 250 septims');
assert.equal(L.pluriel(1, 'jour'), '1 jour');
assert.equal(L.pluriel(3, 'jour'), '3 jours');
assert.equal(L.pluriel(2, 'travail', 'travaux'), '2 travaux');
assert.equal(L.libelleEvenement({ type: 'grade', avant: 'Caporal', apres: 'Sergent' }), 'Élevé au grade de Sergent, auparavant Caporal');
assert.equal(L.libelleEvenement({ type: 'corps', avant: 'Cité de Blancherive', apres: 'Inquisition' }), 'Affecté à Garde inquisitoriale, venant de Cité de Blancherive',
  'Nom affiché du corps');
assert.equal(L.libelleEvenement({ type: 'arrivee', avant: '', apres: 'Eydis' }), 'Inscription au registre de la Garde');
assert.equal(L.libelleEvenement({ type: 'nom', avant: 'Eydis Silencieuse', apres: 'Eydis la Silencieuse' }),
  'Nom changé en Eydis la Silencieuse, auparavant Eydis Silencieuse');
assert.equal(L.depuisJours(0), 'aujourd’hui');
assert.equal(L.depuisJours(1), 'hier');
assert.equal(L.depuisJours(4), 'il y a 4 jours');
assert.equal(L.depuisJours(null), '');

// ---------------------------------------------------------------- rendu
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? (typeof node.type === 'function' ? text(node.type(node.props)) : text(node.props.children)) : '';
async function rendre(reponse) {
  slots = []; effects = []; const appels = [];
  const props = { token: 'jeton', serverCall: (nom, ...args) => { appels.push([nom, ...args]); return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse); } };
  for (let i = 0; i < 10; i++) {
    dirty = false; cursor = 0; tree = L.LivretPage(props);
    effects.splice(0).forEach(fn => fn());
    await new Promise(r => setTimeout(r, 0));
    if (!dirty) break;
  }
  return appels;
}

const base = {
  fiche: { prenom: 'Ivar', nom: 'Œil-Sombre', nomComplet: 'Ivar Œil-Sombre', grade: 'Garde', corps: 'Inquisition', specialite: '', statut: 'En service actif', assermente: true },
  aliasGrades: { inquisition: { garde: 'Inquisiteur' } },
  commandement: { corps: [{ nomComplet: 'Ragnhild Fer-Juste', grade: 'Capitaine', corps: 'Inquisition' }], etatMajor: [] },
  carriere: { inscription: '2026-10-03T10:00:00.000Z', avantJournal: false, evenements: [] },
  service: { lundiCourant: '2026-10-12', exclu: false, semaineCourante: null, enAttente: [], totalEnAttente: 0, totalPercu: 0,
    derniereSemaineReglee: '', joursTotal: 0, semainesServies: 0, moyenne: 0, serie: 0, dernierJour: '', joursDepuis: null, inactif: true, seuilInactivite: 5 },
  justice: { amendes: { nombre: 0, total: 0, aEncaisser: { nombre: 0, total: 0, aDeterminer: 0 }, aReverser: { nombre: 0, total: 0 }, dernieres: [] },
    prison: { nombre: 0, enCellule: [], dernieres: [] } }
};
const appels = await rendre(base);
assert.deepEqual(appels, [['getLivretService', 'jeton']]);
let page = text(tree);
assert.match(page, /Livret de service/);
assert.match(page, /Ivar Œil-Sombre/);
assert.match(page, /Garde inquisitoriale/, 'Corps sous son nom affiché');
assert.match(page, /Aucun jour de service enregistré à votre nom/, 'Jamais pointé : inactivité signalée');
assert.match(page, /Aucun pointage cette semaine/);
assert.match(page, /Aucune solde en attente : vous êtes à jour/);
assert.match(page, /Aucune amende dressée/);
assert.match(page, /Aucune promotion ni mutation/);
assert.match(page, /Inscrit au registre le/);
assert.ok(nodes(tree).some(n => n.props?.role === 'status'), 'Alerte annoncée');

// Inactif depuis douze jours, avec une solde en attente.
await rendre({ ...base, service: { ...base.service, inactif: true, dernierJour: '2026-10-02', joursDepuis: 12,
  enAttente: [{ lundi: '2026-09-28', joursPresents: 2, solde: 80, financeur: 'Argentier de la cour' }], totalEnAttente: 80 } });
page = text(tree);
assert.match(page, /Aucun service depuis 12 jours : au-delà de 5, votre nom remonte au tableau des officiers/);
assert.match(page, /À réclamer : 80 septims/);
assert.match(page, /Argentier de la cour/);

// Hird : pas de solde ni de service au registre, pas d'alerte.
await rendre({ ...base, fiche: { ...base.fiche, corps: 'Hird du Jarl' }, service: { ...base.service, exclu: true, inactif: false } });
page = text(tree);
assert.match(page, /Le Hird du Jarl n’est pas soldé par le registre/);
assert.doesNotMatch(page, /jours de service/);
assert.ok(!nodes(tree).some(n => n.props?.role === 'status'));

// Jarl : non soldé, quel que soit son corps ; Huscarl : le Jarl pour seul supérieur.
await rendre({ ...base, fiche: { ...base.fiche, grade: 'Jarl', corps: 'État-Major' }, service: { ...base.service, exclu: true, inactif: false } });
assert.match(text(tree), /Le Jarl n’est pas soldé par le registre/);
await rendre({ ...base, fiche: { ...base.fiche, grade: 'Huscarl', corps: 'Cité de Blancherive' },
  commandement: { corps: [], etatMajor: [], jarl: [{ nomComplet: 'Siddgeir Vent-Doré', grade: 'Jarl', corps: 'État-Major' }] } });
page = text(tree);
assert.match(page, /Aucun officier au-dessus de vous dans votre corps/);
assert.match(page, /Siddgeir Vent-Doré/, 'Le Jarl dans la chaîne de commandement');

// Erreur du serveur : affichée telle quelle.
await rendre(new Error('Le livret de service n’existe que pour une connexion par Discord.'));
assert.match(text(tree), /n’existe que pour une connexion par Discord/);

console.log('Livret de service (navigateur) : libellés et rendu de la page validés.');
