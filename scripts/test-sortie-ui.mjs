// Sortie de détention côté navigateur (`ui/src/sortie.jsx`) : état d'une
// entrée, dialogue de sortie (champs selon l'issue, garde imposé par la
// session Discord, avertissement de libération anticipée, charge utile),
// annulation et note (motif et signataire), journal rendu du plus ancien au
// plus récent. Rendu avec un React minimal, comme `test-registre-ui.mjs`.
// Le choix de cellule (`ui/src/cellules.jsx`) : libellés, plan cliquable.
//
//   node scripts/test-sortie-ui.mjs

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
const context = vm.createContext({ React, exports: {}, Number, String, Date, console });
context.module = { exports: context.exports };
async function charger(entree) {
  const bundle = await build({ entryPoints: [entree], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement', loader: { '.jpg': 'dataurl' } });
  context.exports = {}; context.module = { exports: context.exports };
  vm.runInContext(bundle.outputFiles[0].text, context);
  return context.module.exports;
}
const sortie = await charger('ui/src/sortie.jsx');
const cellules = await charger('ui/src/cellules.jsx');

let component;
// Les composants fonction imbriqués sont développés dans l'ordre du rendu,
// pour que leurs hooks retrouvent les mêmes emplacements à chaque passe.
function expand(node) {
  if (Array.isArray(node)) return node.map(expand);
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props.children) } };
}
function render() {
  let loops = 0;
  do { dirty = false; cursor = 0; tree = expand(component()); assert.ok(++loops < 20); } while (dirty);
  return tree;
}
// Un enfant `undefined` (`{cond && <X/>}`) ne doit pas retomber sur la racine.
function nodes(...args) {
  const node = args.length ? args[0] : tree;
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children ?? null)];
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) :
  Array.isArray(node) ? node.map(text).join(' ') : node?.props ? text(node.props.children) : '';
const formulaire = () => nodes().find(n => n.type === 'form');
const withClass = name => nodes().filter(n => typeof n.props?.className === 'string' && n.props.className.split(' ').includes(name));
const champ = label => {
  const f = withClass('field').find(f => text(f.props.children[0]) === label);
  if (!f) return undefined;
  const enfants = f.props.children.slice(1).flat().map(c => c && typeof c === 'object' && typeof c.type === 'function' ? c.type(c.props) : c);
  return enfants.find(c => c && typeof c === 'object' && ['input', 'select', 'textarea'].includes(c.type));
};
function monter(fn) { slots = []; cursor = 0; dirty = false; component = fn; return render(); }
const event = () => ({ preventDefault() {} });

// État : en cellule, libéré sans détail, acte de sortie, transfert avec destination.
const enCellule = { row: 2, garde: 'Rorik', detenu: 'Nazeem', cellule: '1', entree: '07/09/2026 12:00', sortie: '08/09/2026 12:00', libere: false, acteSortie: null, journal: [] };
assert.equal(sortie.libelleEtat(enCellule), 'En cellule');
assert.equal(sortie.classeEtat(enCellule), 'etat-cellule');
assert.equal(sortie.libelleEtat({ ...enCellule, libere: true }), 'Libéré (sans détail)');
assert.equal(sortie.classeEtat({ ...enCellule, libere: true }), 'etat-libere');
const transfert = { ...enCellule, libere: true, acteSortie: { issue: 'TRANSFERT_CHATELLERIE', libelle: 'Transfert à une châtellerie', transfert: true, destination: 'Châtellerie de Solitude', remisA: 'Capitaine Aldis', date: '10/09/2026 08:00', garde: 'Ulfgar', motif: 'Ordre du Jarl.' } };
assert.equal(sortie.libelleEtat(transfert), 'Transfert à une châtellerie — Châtellerie de Solitude');
assert.equal(sortie.classeEtat(transfert), 'etat-transfert');
assert.equal(sortie.classeEtat({ ...enCellule, libere: true, acteSortie: { issue: 'EVASION', libelle: 'Évasion' } }), 'etat-evasion');
monter(() => sortie.EtatSortie({ entree: transfert }));
assert.equal(text(tree), 'Transfert à une châtellerie — Châtellerie de Solitude');

// Date affichée → Date locale.
assert.equal(sortie.dateDepuisAffichage('08/09/2026 12:00').getTime(), new Date(2026, 8, 8, 12, 0).getTime());
assert.equal(sortie.dateDepuisAffichage(''), null);
assert.equal(sortie.dateDepuisAffichage('2026-09-08T12:00'), null);

// Dialogue de sortie : champs selon l'issue, charge utile complète.
const issues = [
  { code: 'LIBERATION', libelle: 'Libération', transfert: false, destination: '', destinationNom: '' },
  { code: 'TRANSFERT_EMPIRE', libelle: "Transfert à l'Empire", transfert: true, destination: '', destinationNom: '' },
  { code: 'TRANSFERT_ORDRE', libelle: 'Transfert à un ordre', transfert: true, destination: 'Ordre', destinationNom: "l'ordre" }
];
const data = { gardes: ['Rorik', 'Ulfgar'], gardeImpose: '', issues };
let envoye = null, ferme = 0;
const props = { entree: enCellule, data, onFermer: () => { ferme++; }, onValider: async p => { envoye = p; } };
monter(() => sortie.SortieDialog(props));
assert.equal(champ('Remis à'), undefined, 'Pas de destinataire sans issue');
assert.equal(champ('Garde signataire').type, 'select', 'Code commun : le garde se choisit');
champ('Issue').props.onChange({ target: { value: 'TRANSFERT_EMPIRE' } }); render();
assert.ok(champ('Remis à'), 'Transfert : personne destinataire demandée');
assert.equal(champ('Ordre'), undefined, "L'Empire n'a pas de nom de destination");
champ('Issue').props.onChange({ target: { value: 'TRANSFERT_ORDRE' } }); render();
assert.ok(champ('Ordre'), 'Ordre : son nom est demandé');
assert.equal(champ('Ordre').props.placeholder, "Nom de l'ordre");
champ('Ordre').props.onChange({ target: { value: 'Garde de l’Aube' } });
champ('Remis à').props.onChange({ target: { value: 'Isran' } });
champ('Date et heure de sortie').props.onChange({ target: { value: '2026-09-10T08:00' } });
champ('Garde signataire').props.onChange({ target: { value: 'Rorik' } });
champ('Motif').props.onChange({ target: { value: 'Réquisition.' } }); render();
await formulaire().props.onSubmit(event()); render();
assert.deepEqual(JSON.parse(JSON.stringify(envoye)), { issue: 'TRANSFERT_ORDRE', destination: 'Garde de l’Aube', remisA: 'Isran', date: '2026-09-10T08:00', garde: 'Rorik', motif: 'Réquisition.', attendu: { garde: 'Rorik', detenu: 'Nazeem' } });

// Libération avant la sortie prévue : avertissement ; après : rien.
monter(() => sortie.SortieDialog(props));
champ('Issue').props.onChange({ target: { value: 'LIBERATION' } });
champ('Date et heure de sortie').props.onChange({ target: { value: '2026-09-08T09:30' } }); render();
assert.match(text(tree), /libération anticipée/);
champ('Date et heure de sortie').props.onChange({ target: { value: '2026-09-08T12:00' } }); render();
assert.doesNotMatch(text(tree), /libération anticipée/);

// Session Discord : signataire imposé, en lecture seule, envoyé tel quel.
envoye = null;
monter(() => sortie.SortieDialog({ ...props, data: { ...data, gardeImpose: 'Ulfgar' } }));
assert.equal(champ('Garde signataire').props.readOnly, true);
champ('Issue').props.onChange({ target: { value: 'LIBERATION' } });
champ('Motif').props.onChange({ target: { value: 'Purgée.' } }); render();
await formulaire().props.onSubmit(event()); render();
assert.equal(envoye.garde, 'Ulfgar');

// Erreur serveur affichée dans le dialogue, formulaire conservé et réactivé.
monter(() => sortie.SortieDialog({ ...props, onValider: async () => { throw new Error('Cette incarcération est déjà close.'); } }));
champ('Issue').props.onChange({ target: { value: 'LIBERATION' } });
champ('Motif').props.onChange({ target: { value: 'Purgée.' } }); render();
await formulaire().props.onSubmit(event()); render();
assert.equal(text(withClass('error')[0]), 'Cette incarcération est déjà close.');
assert.equal(nodes().find(n => n.type === 'fieldset').props.disabled, false);
assert.equal(champ('Motif').props.value, 'Purgée.');

// Annulation : signataire et motif ; note : signataire et texte.
envoye = null;
monter(() => sortie.AnnulationDialog({ ...props, entree: transfert }));
assert.match(text(tree), /Châtellerie de Solitude/);
champ('Officier signataire').props.onChange({ target: { value: 'Ulfgar' } });
champ("Motif de l'annulation").props.onChange({ target: { value: 'Erreur.' } }); render();
await formulaire().props.onSubmit(event()); render();
assert.deepEqual(JSON.parse(JSON.stringify(envoye)), { garde: 'Ulfgar', motif: 'Erreur.', attendu: { garde: 'Rorik', detenu: 'Nazeem' } });
envoye = null;
monter(() => sortie.NoteDialog(props));
champ('Garde signataire').props.onChange({ target: { value: 'Rorik' } });
champ('Note').props.onChange({ target: { value: 'Visite du Thane.' } }); render();
await formulaire().props.onSubmit(event()); render();
assert.deepEqual(JSON.parse(JSON.stringify(envoye)), { garde: 'Rorik', texte: 'Visite du Thane.', attendu: { garde: 'Rorik', detenu: 'Nazeem' } });

// Journal : ordre conservé, type, auteur rendu par `Nom`, résumé d'une sortie.
const journal = [
  { quand: '08/09/2026 09:30', type: 'sortie', qui: 'Ulfgar', issue: 'LIBERATION_ANTICIPEE', libelle: 'Libération anticipée', destination: '', remisA: '', date: '08/09/2026 09:30', texte: 'Purgée.' },
  { quand: '08/09/2026 10:00', type: 'note', qui: 'Rorik', texte: 'Objets restitués.' },
  { quand: '09/09/2026 10:00', type: 'annulation', qui: 'Ulfgar', issue: 'LIBERATION_ANTICIPEE', libelle: 'Libération anticipée', texte: 'Erreur.' }
];
const Nom = ({ nom }) => `[${nom}]`;
monter(() => sortie.JournalPrison({ journal, Nom }));
const evts = withClass('journal-evt');
assert.equal(evts.length, 3);
assert.ok(evts[0].props.className.includes('journal-evt-sortie'));
assert.deepEqual(withClass('journal-type').map(text), ['Sortie', 'Note', 'Sortie annulée']);
assert.deepEqual(withClass('journal-qui').map(text), ['[Ulfgar]', '[Rorik]', '[Ulfgar]']);
assert.equal(sortie.resumeEvenement({ type: 'sortie', libelle: 'Transfert à un ordre', destination: 'Garde de l’Aube', remisA: 'Isran' }), 'Transfert à un ordre · Garde de l’Aube · remis à Isran');
assert.equal(sortie.resumeEvenement({ type: 'note', texte: 'x' }), '');
monter(() => sortie.JournalPrison({ journal: [] }));
assert.equal(text(tree), '—');
monter(() => sortie.ResumeSortie({ sortie: transfert.acteSortie, Nom }));
assert.match(text(tree), /Remis à Capitaine Aldis/);
assert.match(text(tree), /\[Ulfgar\]/);
assert.match(text(tree), /Ordre du Jarl\./);

// Cellules : libellés, plan cliquable (cellules seules, les lettres sont des coffres), saisie libre conservée.
assert.equal(cellules.libelleCellule('1'), 'Cellule 1');
assert.equal(cellules.libelleCellule('g'), 'g', 'A à H sont des coffres : jamais proposés');
assert.equal(cellules.libelleCellule('Cellule II'), 'Cellule II', 'Valeur inconnue rendue telle quelle');
assert.equal(cellules.CELLULES.map(c => c.code).join(','), '1,2,3,4');
let choisi = '';
monter(() => cellules.PlanCellules({ valeur: '2', onChoisir: code => { choisi = code; } }));
assert.equal(withClass('plan-cellule').length, 4, 'Quatre cellules fermées');
assert.equal(withClass('plan-salle').length, 8, 'Huit salles dessinées, cellules comprises');
assert.equal(withClass('plan-porte').length, 9, 'Neuf portes relevées sur le croquis');
assert.equal(withClass('plan-porte-principale').length, 4, 'Portes dorées : entrée, sortie et passage principal');
assert.equal(withClass('plan-choisi').length, 1);
assert.equal(withClass('plan-choisi')[0].props['aria-label'], 'Cellule 2');
withClass('plan-cellule').find(n => n.props['aria-label'] === 'Cellule 3').props.onClick();
assert.equal(choisi, '3');
let valeur = 'Cellule II';
monter(() => cellules.ChampCellule({ value: valeur, onChange: v => { valeur = v; } }));
assert.equal(withClass('plan-prison').length, 0, 'Plan replié par défaut');
assert.equal(nodes().find(n => n.type === 'input').props.value, 'Cellule II');
nodes().find(n => n.type === 'button').props.onClick(); render();
assert.equal(withClass('plan-prison').length, 1);
withClass('plan-cellule').find(n => n.props['aria-label'] === 'Cellule 4').props.onClick();
assert.equal(valeur, '4');

console.log('Sortie UI : état, dialogues (issue, destination, remis à, signataire, motif), journal, plan des cellules (1 à 4, portes) OK.');
