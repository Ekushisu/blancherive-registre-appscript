// Champ à jetons des chefs d'accusation et champ de sentence : suggestions
// en mémoire, clavier, lecture sans retenir, référence libre, doublons,
// retrait, filtres, raccourcis, « à déterminer ». Rendu avec un React
// minimal, comme `test-saisies-ui.mjs`.
//
//   node scripts/test-chefs-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

let slots = [], cursor = 0, effects = [], dirty = false, tree;
const React = {
  createElement(type, props, ...children) {
    if (props?.ref) props.ref.current = { focus() {}, ownerDocument: { getElementById: () => null } };
    return { type, props: { ...props, children } };
  },
  Fragment: 'fragment',
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  }
};
const context = vm.createContext({ React, exports: {}, Intl, Date, console });
context.module = { exports: context.exports };
context.globalThis = context;
const bundle = await build({ entryPoints: ['ui/src/chefs.jsx'], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
vm.runInContext(bundle.outputFiles[0].text, context);
const { ChefsField, SentenceField, ChefsChips } = context.module.exports;
const codexBundle = await build({ entryPoints: ['ui/src/codex.js'], bundle: true, write: false, format: 'cjs' });
const cctx = vm.createContext({ React, exports: {}, Intl, console }); cctx.module = { exports: cctx.exports }; cctx.globalThis = cctx;
vm.runInContext(codexBundle.outputFiles[0].text, cctx);
const { preparerCodex, chefsDeLigne } = cctx.module.exports;

const CPL = 'Code pénal local de Blancherive';
const art = (source, article, titre, classification, texte, extra = {}) => ({ source, article, titre, classification, texte, sanction: '', label: `Art. ${article} — ${titre}`, famille: 'Droit de Blancherive', abrege: 'CPL', citable: true, montants: [], dureesCachot: [], amende: '', cachot: '', travaux: '', ...extra });
const codex = preparerCodex({ version: 'v', sources: [{ nom: CPL, famille: 'Droit de Blancherive', abrege: 'CPL', citable: true }], articles: [
  art(CPL, '4', 'Refus d’obtempérer', 'délit', 'Refuser un ordre.', { dureesCachot: [2] }),
  art(CPL, '16', 'Injure', 'contravention', 'Propos injurieux.', { montants: [100, 200] }),
  art(CPL, '17', 'Injure publique', 'délit', 'En public.')
] });

let component, pending = false, opened = [], parcouru = 0;
const props = { codex, value: [], disabled: false, frequents: [], onChange: v => { props.value = v; }, onOpenLaw: a => opened.push(a), onParcourir: () => parcouru++, onPendingChange: v => { pending = v; } };
component = () => ChefsField(props);
function render() { let loops = 0; do { dirty = false; cursor = 0; tree = component(); effects.splice(0).forEach(fn => fn()); assert.ok(++loops < 20); } while (dirty); return tree; }
const SANS_HOOKS = new Set(['QualificationChip', 'ResumeQualification']);
function nodes(node = tree) { if (arguments.length && arguments[0] === undefined) return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); if (!node || typeof node !== 'object') return []; if (typeof node.type === 'function' && SANS_HOOKS.has(node.type.name)) return [node, ...nodes(node.type(node.props))]; return [node, ...nodes(node.props?.children ?? null)]; }
const id = name => nodes().find(n => n.props?.id === name);
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node?.props ? (typeof node.type === 'function' && SANS_HOOKS.has(node.type.name) ? text(node.type(node.props)) : text(node.props.children)) : '';
const button = label => nodes().find(n => n.type === 'button' && text(n).trim() === label);
const edit = q => { id('chef-recherche').props.onChange({ target: { value: q } }); render(); };
const event = key => ({ key, preventDefault() { this.prevented = true; } });
const options = () => nodes().filter(n => n.props?.role === 'option');
function reset() { slots.forEach(s => s?.cleanup?.()); slots = []; cursor = 0; effects = []; dirty = false; }

render();
assert.ok(text(tree).includes('3 articles citables'));
edit('injure');
assert.equal(options().length, 2, 'Suggestions en mémoire, sans délai');
assert.ok(text(options()[0]).includes('Injure'));
id('chef-recherche').props.onKeyDown(event('ArrowDown')); render();
assert.equal(id('chef-recherche').props['aria-activedescendant'], 'chef-option-0');
const enter = event('Enter'); id('chef-recherche').props.onKeyDown(enter); render();
assert.equal(enter.prevented, true);
assert.equal(props.value.length, 1);
assert.equal(props.value[0].article, '16');
assert.equal(props.value[0].titre, 'Injure');
assert.equal(id('chef-recherche').props.value, '', 'Recherche effacée après ajout');
assert.equal(pending, false);
assert.ok(text(tree).includes('contravention'), 'Résumé de qualification');
assert.ok(text(tree).includes('500 septims'));

// Un seul résultat : Entrée le retient directement.
edit('refus'); assert.equal(options().length, 1);
id('chef-recherche').props.onKeyDown(event('Enter')); render();
assert.equal(props.value.length, 2);
assert.ok(text(tree).includes('délit'), 'Qualification la plus grave');

// Doublon refusé, avec message.
edit('injure'); options()[0].props.onClick(); render();
assert.equal(props.value.length, 2);
assert.ok(nodes().some(n => n.props?.role === 'alert' && text(n).includes('déjà retenu')));

// Lecture sans retenir.
const lire = nodes().find(n => n.props?.className?.includes('chef-lire'));
lire.props.onClick({ stopPropagation() {} });
assert.equal(opened.length, 1);
assert.equal(opened[0].article, '16');
assert.equal(props.value.length, 2, 'Lire ne retient pas');

// Filtre de qualification.
button('Délit').props.onClick(); render();
assert.deepEqual(options().map(o => text(o).includes('publique')), [true]);
button('Toutes').props.onClick(); render();
assert.equal(options().length, 2);

// Référence libre.
nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); render();
assert.equal(id('chef-recherche').props.role, undefined);
edit('Ordre du Jarl');
assert.equal(pending, true, 'Référence en cours : bloque l’enregistrement');
button('Ajouter la référence').props.onClick(); render();
assert.equal(props.value.length, 3);
assert.equal(props.value[2].libre, 'Ordre du Jarl');
assert.equal(pending, false);

// Retrait.
const retirer = nodes().find(n => n.type === 'button' && n.props['aria-label'] === 'Retirer CPL art. 16');
retirer.props.onClick(); render();
assert.equal(props.value.length, 2);
assert.ok(!props.value.some(c => c.article === '16'));

// Parcourir le Codex.
nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: false } }); render();
button('Parcourir le Codex').props.onClick();
assert.equal(parcouru, 1);

// Raccourcis fréquents : désactivé une fois retenu.
reset(); props.value = []; props.frequents = [{ source: CPL, article: '4', titre: 'Refus d’obtempérer', classification: 'délit', abrege: 'CPL' }];
render();
const raccourci = nodes().find(n => n.type === 'button' && text(n).startsWith('CPL art. 4'));
assert.equal(raccourci.props.disabled, false);
raccourci.props.onClick(); render();
assert.equal(props.value.length, 1);
assert.equal(nodes().find(n => n.type === 'button' && text(n).startsWith('CPL art. 4')).props.disabled, true);

// Sans Codex chargé : la référence libre reste possible.
reset(); props.value = []; props.codex = null; props.frequents = []; props.statut = 'erreur';
render();
assert.equal(id('chef-recherche').props.disabled, true);
assert.ok(text(tree).includes('référence libre'));

// ---------------------------------------------------------------- sentence
reset();
const sp = { type: 'amende', codex, chefs: [{ source: CPL, article: '16', titre: 'Injure', classification: 'contravention', abrege: 'CPL' }], value: '', indetermine: false, disabled: false, onChange: v => { sp.value = v; }, onIndetermineChange: v => { sp.indetermine = v; } };
component = () => SentenceField(sp); render();
assert.equal(id('sentence-valeur').props.required, true);
assert.equal(id('sentence-valeur').props.step, 1);
assert.ok(button('200 septims'), 'Montants cités par l’article proposés en raccourcis');
button('200 septims').props.onClick(); render();
assert.equal(sp.value, '200');
nodes().find(n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: true } }); render();
assert.equal(sp.indetermine, true);
assert.equal(sp.value, '', 'À déterminer efface la valeur');
assert.equal(id('sentence-valeur').props.required, false);
assert.equal(id('sentence-valeur').props.disabled, true);
button('200 septims').props.onClick(); render();
assert.equal(sp.indetermine, false, 'Un raccourci sort de « à déterminer »');
assert.equal(sp.value, '200');

reset();
const dp = { ...sp, type: 'cachot', chefs: [{ source: CPL, article: '4', titre: 'Refus', classification: 'délit', abrege: 'CPL' }], value: '' };
component = () => SentenceField(dp); render();
assert.equal(id('sentence-valeur').props.step, 'any');
assert.ok(button('30 min') && button('24 h'), 'Raccourcis horaires');
assert.equal(nodes().filter(n => n.type === 'button' && text(n) === '2 h').length, 1, 'Durée citée par l’article non dupliquée');

// ---------------------------------------------------------------- registre
reset();
const entrees = chefsDeLigne(codex, { infraction: 'x', chefs: [{ source: CPL, article: '16', titre: 'Injure', classification: 'contravention', abrege: 'CPL' }, { libre: 'Ordre' }, { source: 'Disparu', article: '9', titre: 'Figé', classification: '', abrege: 'D' }] });
let ouvert = null;
component = () => ChefsChips({ entrees, onOpenLaw: a => { ouvert = a; } }); render();
const liens = nodes().filter(n => n.type === 'button');
assert.equal(liens.length, 1, 'Seul l’article encore au Codex est cliquable');
liens[0].props.onClick();
assert.equal(ouvert.article, '16');
assert.ok(text(tree).includes('Ordre'));
assert.ok(text(tree).includes('Figé'));
component = () => ChefsChips({ entrees: [], onOpenLaw() {} }); render();
assert.equal(text(tree), '—');

console.log('Chefs UI : suggestions, clavier, lecture, doublons, filtres, référence libre, retrait, raccourcis, sentence et registre OK.');
