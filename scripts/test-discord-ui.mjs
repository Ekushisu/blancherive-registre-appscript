// Champ « Compte Discord » des Effectifs : suggestions en mémoire, identifiant
// tapé à la main, compte déjà pris, une seule requête au serveur pour la page.
// Rendu avec un React minimal, comme `test-chefs-ui.mjs`.
//
//   node scripts/test-discord-ui.mjs

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
  },
  useId() { cursor++; return 'champ-discord'; },
  useCallback(fn) { cursor++; return fn; }
};
const charger = async entree => {
  const context = vm.createContext({ React, exports: {}, console });
  context.module = { exports: context.exports };
  context.globalThis = context;
  const bundle = await build({ entryPoints: [entree], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
  vm.runInContext(bundle.outputFiles[0].text, context);
  return context.module.exports;
};
const logique = await charger('ui/src/discord.js');
const { CompteDiscordField } = await charger('ui/src/discord.jsx');

const id = n => String(100000000000000000n + BigInt(n));
const membres = [
  { id: id(1), nom: 'Aldric', pseudo: 'aldric' },
  { id: id(2), nom: 'Éowyn Brise-Lame', pseudo: 'eowyn_bl' },
  { id: id(3), nom: 'Halvar Sans-Nom', pseudo: 'halvar' },
  { id: id(4), nom: 'Runa Chante-Lame', pseudo: 'chantelame' },
  ...Array.from({ length: 12 }, (_, n) => ({ id: id(100 + n), nom: `Garde ${n}`, pseudo: `garde${n}` }))
];

// ---------------------------------------------------------------- suggestions
// Tableaux du contexte vm ramenés au domaine du test pour deepEqual.
const ids = liste => Array.from(liste, m => m.id);
const suggestions = (...args) => Array.from(logique.suggestionsDiscord(...args));
assert.deepEqual(suggestions(membres, ''), []);
assert.deepEqual(suggestions(membres, '   '), []);
assert.deepEqual(ids(suggestions(membres, 'eowyn')), [id(2)], 'Sans accents');
assert.deepEqual(ids(suggestions(membres, '@halv')), [id(3)], 'Arobase ignorée');
assert.deepEqual(ids(suggestions(membres, 'chante')), [id(4)], 'Pseudo cherché');
assert.deepEqual(ids(suggestions(membres, 'lame')), [id(2), id(4)], 'Contient');
assert.equal(suggestions(membres, 'garde').length, 8, 'Huit suggestions au plus');
assert.equal(suggestions(membres, 'garde', 3).length, 3);
const ordre = suggestions([{ id: id(7), nom: 'Bel Aldric', pseudo: 'x' }, ...membres], 'aldric');
assert.deepEqual(ids(ordre), [id(1), id(7)], 'Ceux qui commencent par la recherche d’abord');

// Identifiant complet : retrouvé s'il est connu, proposé tel quel sinon.
assert.deepEqual(ids(suggestions(membres, id(3))), [id(3)]);
const manuel = suggestions(membres, ` ${id(999)} `);
assert.deepEqual(ids(manuel), [id(999)]);
assert.equal(manuel[0].manuel, true);
assert.deepEqual(suggestions([], '123'), [], 'Trop court pour un identifiant');

// ---------------------------------------------------------------- libellés
assert.equal(logique.libelleMembreDiscord(membres[0]), 'Aldric', 'Pseudo identique au nom : pas de doublon');
assert.equal(logique.libelleMembreDiscord(membres[1]), 'Éowyn Brise-Lame (@eowyn_bl)');
assert.equal(logique.libelleMembreDiscord(manuel[0]), `Identifiant ${id(999)}`);
assert.equal(logique.libelleMembreDiscord(null), '');

// ---------------------------------------------------------------- comptes pris
const rattaches = logique.comptesRattaches([
  { memberId: 'u1', nomComplet: 'Alice Nord', discordId: id(1) },
  { memberId: 'u2', nomComplet: 'Bob Sud', discordId: '' },
  { memberId: 'u3', nomComplet: 'Dan Est', discordId: id(1) }
]);
assert.equal(rattaches.size, 1);
assert.deepEqual({ ...rattaches.get(id(1)) }, { memberId: 'u1', nom: 'Alice Nord' });
assert.equal(logique.comptesRattaches(undefined).size, 0);

// ---------------------------------------------------------------- une seule requête
let requetes = [];
let reponse = { membres };
const serverCall = (nom, token, rafraichir) => { requetes.push({ nom, token, rafraichir }); return Promise.resolve(reponse); };
logique.reinitialiserMembresDiscord();
const [a, b] = await Promise.all([logique.chargerMembresDiscord(serverCall, 'jeton'), logique.chargerMembresDiscord(serverCall, 'jeton')]);
assert.equal(a, b);
assert.equal(requetes.length, 1, 'Deux fiches ouvertes ensemble partagent la requête');
assert.deepEqual(requetes[0], { nom: 'getMembresDiscord', token: 'jeton', rafraichir: false });
await logique.chargerMembresDiscord(serverCall, 'jeton');
assert.equal(requetes.length, 1, 'Liste gardée pour la page');
reponse = { membres: membres.slice(0, 2) };
assert.equal((await logique.chargerMembresDiscord(serverCall, 'jeton', true)).length, 2);
assert.deepEqual(requetes.at(-1).rafraichir, true);
logique.reinitialiserMembresDiscord();
const enEchec = () => Promise.reject(new Error('Le bot Discord n’est pas configuré.'));
await assert.rejects(logique.chargerMembresDiscord(enEchec, 'jeton'), /pas configuré/);
assert.equal((await logique.chargerMembresDiscord(serverCall, 'jeton')).length, 2, 'Un échec ne bloque pas la tentative suivante');

// ---------------------------------------------------------------- rendu du champ
function nodes(node = tree) {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  return [node, ...nodes(node.props?.children)];
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
const props = { value: '', onChange: v => { props.value = v; }, discord: { statut: 'pret', membres, erreur: '', charger: r => rechargements.push(r) },
  rattaches: logique.comptesRattaches([{ memberId: 'u9', nomComplet: 'Halvar Ancien', discordId: id(3) }]), memberId: 'u1' };
let rechargements = [];
function render() { let loops = 0; do { dirty = false; cursor = 0; tree = CompteDiscordField(props); assert.ok(++loops < 10); } while (dirty); return tree; }
const champ = () => nodes().find(n => n.type === 'input');
const boutons = () => nodes().filter(n => n.type === 'button');
const bouton = libelle => boutons().find(n => text(n).includes(libelle));
const saisir = q => { champ().props.onChange({ target: { value: q } }); render(); };

render();
assert.equal(champ().props.id, 'champ-discord');
assert.equal(nodes().find(n => n.type === 'label').props.htmlFor, 'champ-discord');
assert.ok(bouton('Actualiser la liste du serveur'));
bouton('Actualiser la liste du serveur').props.onClick();
assert.deepEqual(rechargements, [true]);

saisir('halv');
assert.equal(bouton('Halvar Sans-Nom').props.disabled, true, 'Compte pris par un autre membre');
assert.match(text(bouton('Halvar Sans-Nom')), /déjà lié à Halvar Ancien/);
saisir('zzz');
assert.match(text(tree), /Aucun membre du serveur ne correspond/);
saisir('runa');
bouton('Runa Chante-Lame').props.onClick();
assert.equal(props.value, id(4));
render();
assert.equal(champ(), undefined, 'Compte choisi : plus de recherche');
assert.match(text(tree), /Runa Chante-Lame \(@chantelame\)/);
bouton('Retirer le lien').props.onClick();
assert.equal(props.value, '');

// Son propre compte n'est pas « pris ».
props.memberId = 'u9'; render(); saisir('halv');
assert.equal(bouton('Halvar Sans-Nom').props.disabled, false);

// Compte absent du serveur, chargement, erreur avec nouvelle tentative, anomalie.
props.value = id(999); render();
assert.match(text(tree), new RegExp(`Identifiant ${id(999)} — absent du serveur`));
props.discord = { ...props.discord, statut: 'chargement', membres: [] }; render();
assert.match(text(tree), /Chargement des membres du serveur/);
assert.doesNotMatch(text(tree), /absent du serveur/, 'Pas de verdict avant la liste');
props.discord = { ...props.discord, statut: 'erreur', erreur: 'Le bot Discord n’est pas configuré.' }; props.value = ''; rechargements = []; render();
assert.match(text(tree), /pas configuré/);
bouton('Réessayer').props.onClick();
assert.deepEqual(rechargements, [undefined]);
saisir(id(55));
bouton(`Identifiant ${id(55)}`).props.onClick();
assert.equal(props.value, id(55), 'Identifiant tapé à la main quand le bot est muet');
props.value = ''; props.anomalie = 'Identifiant Discord enregistré comme nombre'; render();
assert.equal(nodes().find(n => n.props?.role === 'alert') && text(nodes().find(n => n.props?.role === 'alert')), 'Identifiant Discord enregistré comme nombre');
props.discord = { ...props.discord, statut: 'pret', membres, erreur: '' }; props.anomalie = '';
props.disabled = true; render(); saisir('aldric');
assert.equal(champ().props.disabled, true);
assert.ok(bouton('Aldric'));
assert.ok(boutons().filter(n => text(n).includes('Aldric')).every(n => n.props.disabled), 'Champ figé pendant l’enregistrement');

console.log('Compte Discord : suggestions, identifiant manuel, compte pris, requête partagée et rendu du champ validés.');
