// Barème des peines dans le navigateur : niveaux d'un article, rachat
// nobiliaire, récidive, cumul ou qualification la plus rigoureuse, fait isolé
// sur sept jours, résumé et grille des échelons, regroupement et recherche de
// la page, et bloc de proposition des formulaires — pré-remplissage d'un
// champ vide, suivi de la proposition, saisie de l'autorité jamais écrasée.
// Rendu avec un React minimal, comme `test-chefs-ui.mjs`.
//
//   node scripts/test-peines-ui.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { codexLocal } from './codex-local.mjs';

// ---------------------------------------------------------------- barème réel, lu par le serveur
function baremeServeur() {
  const lignes = [];
  const feuille = {
    getLastRow: () => lignes.length,
    getMaxColumns: () => 12,
    getRange(r, c, h = 1, w = 1) {
      const valeurs = () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => lignes[r + i - 1]?.[c + j - 1] ?? ''));
      return { getValues: valeurs, getDisplayValues: () => valeurs().map(l => l.map(String)) };
    }
  };
  const ctx = vm.createContext({
    Utilities: {
      DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
      base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url')
    }
  });
  for (const file of ['SyncCodex.js', 'Codex.js', 'Amendes.js', 'PeinesAmendes.js']) vm.runInContext(fs.readFileSync(`src/${file}`, 'utf8'), ctx);
  lignes.push(Array.from(vm.runInContext('PEINES_HEADERS', ctx)), ...Array.from(ctx.construireBaremeInitial_(), l => Array.from(l)));
  return JSON.parse(JSON.stringify(ctx.lirePeinesAmendes_(feuille)));
}
const reponse = baremeServeur();

// ---------------------------------------------------------------- React minimal
let slots = [], cursor = 0, effects = [], dirty = false, tree;
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  Fragment: 'fragment',
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value; if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useMemo(fn) { return fn(); },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  }
};
async function charger(entree) {
  const bundle = await build({ entryPoints: [entree], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', logLevel: 'silent', loader: { '.css': 'text', '.jpg': 'text', '.png': 'text' } });
  const c = vm.createContext({ React, exports: {}, Intl, Date, console, document: { querySelector: () => null, body: { style: {} }, addEventListener() {}, removeEventListener() {} } });
  c.module = { exports: c.exports }; c.globalThis = c;
  vm.runInContext(bundle.outputFiles[0].text, c);
  return c.module.exports;
}
const P = await charger('ui/src/peines.js');
const { PropositionBareme, BaremeArticle } = await charger('ui/src/bareme.jsx');
const { regrouperBareme, filtrerBareme, lignesHorsCodex } = await charger('ui/src/peines.jsx');
const C = await charger('ui/src/codex.js');

const espaces = s => String(s).replace(/[  ]/g, ' ');
const peines = P.preparerPeines(reponse);
const CPL = 'Code pénal local de Blancherive', CJI = 'Corpus Juriscivilis Imperialis', CPEN = 'Codex Penitus Imperialis';
const chef = (source, article, titre = '') => ({ source, article, titre, classification: '', abrege: source === CPL ? 'CPL' : source === CJI ? 'CJI' : 'CPen' });

// ---------------------------------------------------------------- niveaux et valeurs
assert.throws(() => P.preparerPeines({ version: 'x' }), /illisible/);
const harcelement = P.niveauxArticle(peines, ' code PÉNAL local de blancherive ', '21');
assert.deepEqual(Array.from(harcelement, n => n.qualification), ['délit', 'crime'], 'Clé insensible à la casse, comme le Codex');
assert.equal(P.niveauxArticle(peines, CPEN, '6')[0].article, '*', 'Ligne « * » : vaut pour toute la source');
assert.deepEqual(Array.from(P.niveauxArticle(peines, CPL, '2')), [], 'Disposition générale : pas de barème');
assert.deepEqual(Array.from(P.niveauxArticle(null, CPL, '21')), []);

const [delit, crime] = harcelement;
assert.deepEqual(plainValeur(P.valeurNiveau(delit)), { amende: 750, cachot: null, rachat: false });
assert.deepEqual(plainValeur(P.valeurNiveau(crime)), { amende: 3000, cachot: 1, rachat: false });
assert.deepEqual(plainValeur(P.valeurNiveau(crime, { noble: true })), { amende: 4000, cachot: null, rachat: true }, 'Noble : cachot racheté');
assert.deepEqual(plainValeur(P.valeurNiveau(crime, { noble: true, recidive: true })), { amende: 8000, cachot: null, rachat: true }, 'Récidive : doublée');
assert.deepEqual(plainValeur(P.valeurNiveau(delit, { noble: true })), { amende: 750, cachot: null, rachat: false }, 'Sans cachot, l’amende ordinaire');
const meurtre = P.niveauxArticle(peines, CJI, '12')[0];
assert.deepEqual(plainValeur(P.valeurNiveau(meurtre, { noble: true })), { amende: 8000, cachot: 4, rachat: false }, 'Crime de sang : pas de rachat');
function plainValeur(v) { return { amende: v.amende, cachot: v.cachot, rachat: v.rachat }; }

// ---------------------------------------------------------------- propositions
const cle21 = C.cleArticle(CPL, '21');
let p = P.propositionBareme(peines, [chef(CPL, '21'), chef(CPL, '16'), { libre: 'Ordre du Jarl' }, chef('Loi fondamentale de Blancherive', '1'), chef(CPEN, '6')], { choix: { [cle21]: 1 } });
assert.deepEqual([p.total.amende, p.total.cachot], [3150, 1], 'Faits distincts : peines cumulées');
assert.equal(p.libres, 1);
assert.equal(p.sansBareme, 1, 'Article sans barème compté à part');
assert.equal(p.renvois.length, 1, 'Renvoi impérial signalé');
assert.equal(p.mineur, false);
p = P.propositionBareme(peines, [chef(CPL, '21'), chef(CPL, '16')], { choix: { [cle21]: 1 }, mode: 'grave' });
assert.deepEqual([p.total.amende, p.total.cachot], [3000, 1], 'Même fait : qualification la plus rigoureuse');
assert.equal(p.qualification, 'crime', 'Qualification la plus grave des niveaux retenus');
assert.deepEqual([p.cumul.amende, p.grave.amende], [3150, 3000]);
p = P.propositionBareme(peines, [chef(CPL, '21'), chef(CPL, '16')], { choix: { [cle21]: 1 }, noble: true, recidive: true });
assert.deepEqual([p.total.amende, p.total.cachot, p.rachat], [8300, null, true], 'Noble récidiviste : (4 000 + 150) × 2, sans cachot');
p = P.propositionBareme(peines, [chef(CPL, '9'), chef(CPL, '16')], { choix: { [cle21]: 9 } });
assert.equal(p.mineur, true, 'Contraventions : fait isolé du noble applicable');
assert.equal(p.total.amende, 300);
p = P.propositionBareme(peines, [chef(CPL, '21')], { choix: { [cle21]: 7 } });
assert.equal(p.lignes[0].index, 0, 'Choix hors bornes : premier niveau');
p = P.propositionBareme(peines, [chef(CJI, '12')], { choix: { [C.cleArticle(CJI, '12')]: 1 } });
assert.equal(p.peineMaximale, true);
assert.equal(p.total.amende, null, 'Peine maximale : aucune somme proposée');
assert.equal(p.sang, true);

// ---------------------------------------------------------------- résumés, grille, sept jours
assert.equal(espaces(P.resumeNiveaux(harcelement)), '750 à 3 000 septims · jusqu’à 1 h de cachot');
assert.equal(espaces(P.resumeNiveaux(P.niveauxArticle(peines, CJI, '12'))), '8 000 septims · 4 h de cachot · peine maximale');
assert.equal(P.resumeNiveaux(P.niveauxArticle(peines, CPEN, '6')), 'Renvoi');
assert.equal(P.resumeNiveaux([]), '');
let grille = P.grilleEchelons(peines);
assert.deepEqual(Array.from(grille, e => e.code), ['C1', 'C2', 'C3', 'C4', 'D1', 'D2', 'D3', 'D4', 'K1', 'K2', 'K3', 'K4', 'PM'], 'Échelons dans l’ordre');
const d3 = grille.find(e => e.code === 'D3');
assert.deepEqual([d3.amende, d3.cachot, d3.nobiliaire, d3.ajustes], [1000, 0.5, 1500, 0]);
const k2 = grille.find(e => e.code === 'K2');
assert.deepEqual([k2.nobiliaire, k2.ajustes], [7000, 0], 'Crime de sang sans rachat : pas un écart à l’échelon');
const ajuste = { ...reponse, lignes: reponse.lignes.map((l, i) => i === reponse.lignes.findIndex(x => x.echelon === 'D1') ? { ...l, amende: 800 } : l) };
grille = P.grilleEchelons(P.preparerPeines(ajuste));
assert.equal(grille.find(e => e.code === 'D1').amende, 500, 'Valeur la plus fréquente');
assert.equal(grille.find(e => e.code === 'D1').ajustes, 1, 'Ligne ajustée comptée');

const registre = [
  { row: 2, date: '01/10/2026', contrevenant: 'Nazeem', infraction: 'CPL art. 16 — Injure' },
  { row: 3, date: '26/09/2026', contrevenant: 'NAZEEM ', infraction: 'Ancienne' },
  { row: 4, date: '27/09/2026', contrevenant: 'nazeem', infraction: 'Limite' },
  { row: 5, date: '05/10/2026', contrevenant: 'Nazeem', infraction: 'Postérieure' },
  { row: 6, date: 'illisible', contrevenant: 'Nazeem' },
  { row: 7, date: '03/10/2026', contrevenant: 'Belethor' }
];
assert.deepEqual(Array.from(P.entreesRecentes(registre, ' Nazeem', '2026-10-04'), r => r.row), [2, 4], 'Sept jours avant la date, bornes comprises');
assert.deepEqual(Array.from(P.entreesRecentes(registre, 'Nazeem', '2026-10-04', { exclureRow: 2 }), r => r.row), [4], 'L’entrée modifiée ne compte pas');
assert.deepEqual(Array.from(P.entreesRecentes([{ row: 9, date: '2026-10-02', detenu: 'Ulfric' }], 'ulfric', '2026-10-04', { champ: 'detenu' }), r => r.row), [9]);
assert.deepEqual(Array.from(P.entreesRecentes(registre, '', '2026-10-04')), []);

// ---------------------------------------------------------------- page : regroupement, recherche, contrôle
const codex = C.preparerCodex(codexLocal());
const groupes = regrouperBareme(peines, codex);
const gCPL = groupes.find(g => g.source === CPL);
assert.equal(gCPL.abrege, 'CPL');
assert.deepEqual(Array.from(gCPL.articles.slice(10, 14), a => a.article), ['14', '15', '15-1', '16'], 'Ordre des numéros, 15-1 après 15');
assert.equal(groupes.find(g => g.source === CJI).articles[0].titre, 'Usurpation d\'identité', 'Titre du Codex, sans la qualification entre crochets');
assert.deepEqual(Array.from(groupes.find(g => g.source === 'Decretum de Restitutione Bonorum Imperii').articles, a => a.article), ['*']);
const recherche = (q, f = {}) => Array.from(filtrerBareme(groupes, { recherche: q, ...f }).flatMap(g => g.articles.map(a => `${g.abrege} ${a.article}`)));
assert.deepEqual(recherche('cpl 16'), ['CPL 16'], 'Numéro exact et sigle');
assert.ok(recherche('vol').includes('CJI 6'));
assert.ok(recherche('art. 15-1').includes('CPL 15-1'));
assert.ok(recherche('', { qualification: 'renvoi' }).every(r => !r.startsWith('CPL')));
assert.equal(recherche('', { source: CJI }).length, 17);
assert.deepEqual(Array.from(lignesHorsCodex(peines, codex)), [], 'Barème initial : tout article est au Codex');
const codexAmpute = { ...codex, articles: codex.articles, sources: codex.sources.filter(s => s.nom !== CPEN), parCle: new Map([...codex.parCle].filter(([k]) => !k.startsWith(C.cleArticle(CPL, '21')))) };
assert.deepEqual(Array.from(lignesHorsCodex(peines, codexAmpute), l => l.article).sort(), ['*', '21'], 'Article ou source disparus signalés une fois');

// ---------------------------------------------------------------- bloc de proposition
function render(component) { let loops = 0; do { dirty = false; cursor = 0; tree = component(); effects.splice(0).forEach(fn => fn()); assert.ok(++loops < 20); } while (dirty); return tree; }
function reset() { slots.forEach(s => s?.cleanup?.()); slots = []; cursor = 0; effects = []; dirty = false; }
function nodes(node = tree) { if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (!node || typeof node !== 'object') return []; if (typeof node.type === 'function') return [node, ...nodes(node.type(node.props))]; return [node, ...nodes(node.props?.children ?? null)]; }
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? (typeof node.type === 'function' ? text(node.type(node.props)) : text(node.props.children)) : '';
const bouton = libelle => nodes().find(n => n.type === 'button' && text(n).trim() === libelle);

const appliques = [];
const props = { type: 'amende', peines, statut: 'pret', chefs: [chef(CPL, '21', 'Harcèlement moral')], reglages: { choix: {}, noble: false, recidive: false, mode: 'cumul' }, valeur: '', indetermine: false, historique: null, disabled: false,
  // Le formulaire parent tient ces valeurs dans son état : chaque rappel le fait se redessiner.
  onReglages: r => { props.reglages = r; dirty = true; }, onAppliquer: v => { appliques.push(v); props.valeur = v; dirty = true; } };
const composant = () => PropositionBareme(props);
render(composant);
assert.deepEqual(appliques, ['750'], 'Champ vide : pré-rempli à la première proposition');
assert.ok(espaces(text(tree)).includes('Proposition du barème : 750 septims'));
assert.equal(bouton('Reprendre la proposition'), undefined, 'Valeur déjà reprise : pas de bouton');

// Choisir la requalification en crime : la valeur suit, elle portait la proposition.
const options = nodes().filter(n => n.type === 'input' && n.props.type === 'radio');
assert.equal(options.length, 2);
options[1].props.onChange(); render(composant);
assert.equal(props.reglages.choix[cle21], 1);
assert.deepEqual(appliques, ['750', '3000'], 'Proposition suivie tant que l’autorité n’a rien saisi');
assert.ok(espaces(text(tree)).includes('aussi 1 h de cachot'), 'Cachot signalé pour le registre de la Prison');
assert.ok(espaces(text(tree)).includes('Qualification la plus grave retenue : crime, fourchette impériale au-delà de 2 500 septims'), 'Qualification du niveau choisi, pas de l’article');

// Une saisie de l'autorité n'est jamais écrasée.
props.valeur = '2000'; render(composant);
options[0].props.onChange(); render(composant);
assert.deepEqual(appliques, ['750', '3000'], 'Saisie manuelle conservée');
assert.ok(text(tree).includes('s’écarte de la proposition'));
bouton('Reprendre la proposition').props.onClick(); render(composant);
assert.deepEqual(appliques.at(-1), '750', 'Reprise explicite');

// À déterminer : rien n'est rempli, la reprise décoche.
props.indetermine = true; props.valeur = ''; props.chefs = [chef(CPL, '21'), chef(CPL, '16')]; render(composant);
assert.equal(appliques.length, 3, 'À déterminer : aucun remplissage');
assert.ok(bouton('Faits distincts — peines cumulées'), 'Deux chefs : choix du calcul');
bouton('Même fait — qualification la plus rigoureuse').props.onClick(); render(composant);
assert.equal(props.reglages.mode, 'grave');
props.indetermine = false; render(composant);

// Noblesse : rappels du De Re Nobilitatis, entrées des sept derniers jours.
reset();
props.chefs = [chef(CPL, '9'), chef(CPL, '16')]; props.reglages = { choix: {}, noble: true, recidive: false, mode: 'cumul' }; props.valeur = '';
props.historique = [registre[0]];
render(composant);
let t = espaces(text(tree));
assert.ok(t.includes('Art. 8'), 'Fait isolé sur sept jours');
assert.ok(t.includes('CPL art. 16 — Injure'), 'Entrée récente citée');
assert.ok(!t.includes('Art. 12'), 'Pas de cachot : pas de décision conjointe');
props.historique = []; render(composant);
assert.ok(text(tree).includes('Aucune entrée à ce nom'));

// Prison, noble, crime avec cachot : rachat, plus de cachot proposé.
reset();
appliques.length = 0;
Object.assign(props, { type: 'cachot', chefs: [chef(CPL, '21')], reglages: { choix: { [cle21]: 1 }, noble: true, recidive: false, mode: 'cumul' }, valeur: '', historique: null });
render(composant);
t = espaces(text(tree));
assert.deepEqual(appliques, [], 'Cachot racheté : rien à reporter');
assert.ok(t.includes('Le barème ne propose pas de cachot'));
assert.ok(t.includes('amende de 4 000 septims'), 'Amende de substitution signalée pour le registre des Amendes');
assert.ok(t.includes('Art. 9'));
props.reglages = { ...props.reglages, noble: false }; render(composant);
assert.deepEqual(appliques, ['1'], 'Sans noblesse : 1 h de cachot proposée');
assert.ok(espaces(text(tree)).includes('Art. 12') === false);

// Chargement et absence de barème.
reset();
render(() => PropositionBareme({ ...props, peines: null, statut: 'chargement' }));
assert.ok(text(tree).includes('Chargement du barème'));
reset();
render(() => PropositionBareme({ ...props, peines: null, statut: 'erreur' }));
assert.ok(text(tree).includes('saisissez la sentence librement'));

// Lecture d'un article : section du décret, ou rien.
reset();
tree = BaremeArticle({ peines, article: { source: CPL, article: '21' } });
assert.ok(espaces(text(tree)).includes('Requalification en crime'));
assert.equal(BaremeArticle({ peines, article: { source: CPL, article: '2' } }), null);
assert.ok(text(BaremeArticle({ peines, article: { source: CPEN, article: '6' } })).includes('tout le texte'));

console.log('Peines UI : niveaux, rachat nobiliaire, récidive, cumul, sept jours, page et pré-remplissage OK.');
