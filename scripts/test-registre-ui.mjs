// Ligne de détail de la Prison (`ui/src/registre.jsx`) : saisies en jetons
// repliées au-delà de huit, texte historique conservé, notes repliées
// au-delà du seuil, rien quand l'entrée n'a ni saisies ni notes. Rendu avec
// un React minimal, comme `test-saisies-ui.mjs`.
//
//   node scripts/test-registre-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

let slots = [], cursor = 0, dirty = false, tree;
const React = {
  createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  Fragment: 'fragment',
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  }
};
const context = vm.createContext({ React, exports: {}, Number, String, console });
context.module = { exports: context.exports };
const bundle = await build({ entryPoints: ['ui/src/registre.jsx'], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement' });
vm.runInContext(bundle.outputFiles[0].text, context);
const { SaisiesResume, NotesDepliables, DetailsPrison, SAISIES_VISIBLES, notesLongues } = context.module.exports;

let component;
function render() {
  let loops = 0;
  do { dirty = false; cursor = 0; tree = component(); assert.ok(++loops < 20); } while (dirty);
  return tree;
}
function nodes(node = tree) {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children ?? null)];
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : '';
const withClass = name => nodes().filter(n => typeof n.props?.className === 'string' && n.props.className.split(' ').includes(name));
const button = () => nodes().find(n => n.type === 'button');
function monter(fn) { slots = []; cursor = 0; dirty = false; component = fn; return render(); }

// Saisies structurées : huit jetons, puis le reste derrière « + N autres ».
const liste = Array.from({ length: 14 }, (_, i) => ({ id: i < 4 ? `skyrim.esm|${i}` : '', nom: `Objet ${i + 1}`, quantite: 1000 + i, libre: i >= 4 }));
monter(() => SaisiesResume({ liste, texte: 'ignoré' }));
assert.equal(withClass('saisie-jeton').length, SAISIES_VISIBLES);
assert.equal(withClass('saisie-jeton-libre').length, SAISIES_VISIBLES - 4, 'Les saisies libres sont distinguées');
assert.equal(text(button()), '+ 6 autres');
assert.match(text(tree), /1[\s  ]000/, 'Quantité en format français');
button().props.onClick(); render();
assert.equal(withClass('saisie-jeton').length, 14);
assert.equal(text(button()), 'Réduire');
button().props.onClick(); render();
assert.equal(withClass('saisie-jeton').length, SAISIES_VISIBLES);

// Huit saisies ou moins : aucun bouton.
monter(() => SaisiesResume({ liste: liste.slice(0, SAISIES_VISIBLES), texte: '' }));
assert.equal(button(), undefined);

// Saisie historique en texte : rendue telle quelle, sans jeton.
monter(() => SaisiesResume({ liste: null, texte: 'Amulette de Talos\nDague' }));
assert.equal(withClass('saisie-jeton').length, 0);
assert.equal(text(withClass('saisies-texte')[0]), 'Amulette de Talos\nDague');
monter(() => SaisiesResume({ liste: [], texte: '  ' }));
assert.equal(text(tree), '—');

// Notes courtes : en clair, sans bouton. Longues : repliées, « Tout afficher ».
monter(() => NotesDepliables({ texte: 'Pris sur le fait au marché.' }));
assert.equal(button(), undefined);
assert.equal(withClass('notes-texte-replie').length, 0);
const longues = 'Date : 30 Soufflegivre\nLieu : Bois-de-Chêne\nGardes présents : deux\nTémoins : trois\nMotifs : nombreux';
assert.ok(notesLongues(longues), 'Cinq lignes dépassent le seuil');
assert.ok(notesLongues('x'.repeat(321)));
assert.ok(!notesLongues('x'.repeat(320)));
monter(() => NotesDepliables({ texte: longues }));
assert.equal(withClass('notes-texte-replie').length, 1);
assert.equal(text(button()), 'Tout afficher');
assert.equal(text(withClass('notes-texte')[0]), longues, 'Le texte complet est dans la page, seul le style replie');
button().props.onClick(); render();
assert.equal(withClass('notes-texte-replie').length, 0);
assert.equal(text(button()), 'Réduire');
monter(() => NotesDepliables({ texte: '' }));
assert.equal(text(tree), '—');

// Ligne de détail : absente sans saisies ni notes ; un seul bloc sinon ; colSpan transmis.
assert.equal(DetailsPrison({ entree: { saisies: '', saisiesListe: [], notes: '  ' }, colonnes: 10 }), null);
monter(() => DetailsPrison({ entree: { saisies: '', saisiesListe: [], notes: 'Détention sur ordre direct.' }, colonnes: 9 }));
assert.equal(withClass('registry-details-bloc').length, 1);
assert.equal(withClass('registry-details-notes').length, 1);
assert.equal(withClass('registry-details-cell')[0].props.colSpan, 9);
monter(() => DetailsPrison({ entree: { saisies: 'Amulette de Talos', saisiesListe: null, notes: '' }, colonnes: 10 }));
assert.equal(withClass('registry-details-saisies').length, 1);
assert.equal(withClass('registry-details-notes').length, 0);
assert.equal(withClass('registry-details-cell')[0].props.colSpan, 10);
monter(() => DetailsPrison({ entree: { saisies: 'Or × 40', saisiesListe: [{ id: 'skyrim.esm|00000F', nom: 'Or', quantite: 40 }], notes: 'Restitué.' }, colonnes: 10 }));
assert.equal(withClass('registry-details-bloc').length, 2);

console.log('test-registre-ui : OK');

// Acte de sortie et journal : blocs dédiés, auteur rendu par `Nom`, ligne
// présente même sans saisies ni notes.
const acte = { issue: 'TRANSFERT_ORDRE', libelle: 'Transfert à un ordre', transfert: true, destination: 'Garde de l’Aube', remisA: 'Isran', date: '10/09/2026 08:00', garde: 'Ulfgar', motif: 'Réquisition.' };
const journal = [{ quand: '10/09/2026 08:05', type: 'sortie', qui: 'Ulfgar', issue: 'TRANSFERT_ORDRE', libelle: 'Transfert à un ordre', destination: 'Garde de l’Aube', remisA: 'Isran', date: '10/09/2026 08:00', texte: 'Réquisition.' }];
monter(() => DetailsPrison({ entree: { saisies: '', saisiesListe: [], notes: '', acteSortie: acte, journal }, colonnes: 10, Nom: ({ nom }) => `[${nom}]` }));
assert.equal(withClass('registry-details-sortie').length, 1);
assert.equal(withClass('registry-details-journal').length, 1);
assert.equal(withClass('registry-details-saisies').length, 0);
// Les blocs Sortie et Journal sont des composants de sortie.jsx : rendus ici pour lire leur texte.
const rendu = nodes().filter(n => typeof n.type === 'function').map(n => text(n.type(n.props))).join(' ');
assert.match(rendu, /Isran/);
assert.match(rendu, /Garde de l’Aube/);
const rendus = nodes().filter(n => typeof n.type === 'function').flatMap(n => nodes(n.type(n.props)));
assert.ok(rendus.some(n => typeof n.type === 'function' && n.props.nom === 'Ulfgar'), 'Noms de garde confiés au composant fourni');
assert.equal(DetailsPrison({ entree: { saisies: '', saisiesListe: [], notes: '', acteSortie: null, journal: [] }, colonnes: 10 }), null);
monter(() => DetailsPrison({ entree: { saisies: '', saisiesListe: [], notes: 'Motif.', acteSortie: null, journal: [{ quand: '10/09/2026 08:05', type: 'note', qui: 'Rorik', texte: 'Visite.' }] }, colonnes: 10 }));
assert.equal(withClass('registry-details-bloc').length, 2);
assert.match(text(withClass('registry-details-notes')[0]), /Motif d'incarcération/);

console.log('test-registre-ui (sortie, journal) : OK');
