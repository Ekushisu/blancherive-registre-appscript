// Connexion par Discord, côté navigateur : `state` aléatoire gardé puis
// vérifié une seule fois, lecture et effacement du retour dans l'adresse,
// écran de connexion avec et sans Discord. React minimal, comme
// `test-chefs-ui.mjs`.
//
//   node scripts/test-connexion-discord-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
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
  useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
  useEffect(fn, deps) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
  }
};

const stockage = new Map();
let stockageRefuse = false;
const sessionStorage = {
  getItem: cle => { if (stockageRefuse) throw Error('refusé'); return stockage.has(cle) ? stockage.get(cle) : null; },
  setItem: (cle, valeur) => { if (stockageRefuse) throw Error('refusé'); stockage.set(cle, String(valeur)); },
  removeItem: cle => { if (stockageRefuse) throw Error('refusé'); stockage.delete(cle); }
};
const context = vm.createContext({ React, exports: {}, console, crypto: webcrypto, sessionStorage, Uint8Array, Promise, URL });
context.module = { exports: context.exports };
context.globalThis = context;
const bundle = await build({
  entryPoints: ['ui/src/navigation.jsx'], bundle: true, write: false, format: 'cjs',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', loader: { '.jpg': 'dataurl' }
});
vm.runInContext(bundle.outputFiles[0].text, context);
const { Login } = context.module.exports;
const logique = await build({ entryPoints: ['ui/src/connexion-discord.js'], bundle: true, write: false, format: 'cjs' });
const lctx = vm.createContext({ exports: {}, crypto: webcrypto, sessionStorage, Uint8Array, Promise });
lctx.module = { exports: lctx.exports }; lctx.globalThis = lctx;
vm.runInContext(logique.outputFiles[0].text, lctx);
const L = lctx.module.exports;

// ---------------------------------------------------------------- state
const a = L.nouvelEtatDiscord(), b = L.nouvelEtatDiscord();
assert.match(a, /^[0-9a-f]{32}$/);
assert.notEqual(a, b, 'Un state neuf à chaque fois');
assert.equal(L.urlConnexionDiscord('https://discord.com/oauth2/authorize?x=1', 'abc'), 'https://discord.com/oauth2/authorize?x=1&state=abc');

// Vérifié une seule fois, effacé dans tous les cas.
L.memoriserEtatDiscord(a);
assert.equal(L.verifierRetourDiscord({ code: 'CODE123', etat: a, erreur: '' }), 'CODE123');
assert.throws(() => L.verifierRetourDiscord({ code: 'CODE123', etat: a, erreur: '' }), /interrompue/, 'Pas de rejeu');
L.memoriserEtatDiscord(a);
assert.throws(() => L.verifierRetourDiscord({ code: 'CODE123', etat: b, erreur: '' }), /interrompue : recommencer depuis ce navigateur/);
assert.equal(stockage.size, 0, 'State effacé même refusé');
L.memoriserEtatDiscord(a);
assert.throws(() => L.verifierRetourDiscord({ code: '', etat: a, erreur: 'access_denied' }), /^Error: Connexion Discord annulée\.$/);
assert.equal(stockage.size, 0);
assert.throws(() => L.verifierRetourDiscord({ code: '', etat: '', erreur: 'server_error' }), /Discord a refusé la connexion/);
stockageRefuse = true;
L.memoriserEtatDiscord(a);
assert.throws(() => L.verifierRetourDiscord({ code: 'CODE123', etat: a, erreur: '' }), /interrompue/, 'Stockage refusé : refus, sans plantage');
stockageRefuse = false;

// ---------------------------------------------------------------- adresse
assert.equal(await L.lireRetourDiscord(), null, 'Hors Apps Script : rien à lire');
let parametres = {}, remplacements = [];
lctx.google = { script: {
  url: { getLocation: rappel => rappel({ parameter: parametres }) },
  history: { replace: (...args) => remplacements.push(args) }
} };
assert.equal(await L.lireRetourDiscord(), null, 'Adresse sans retour Discord');
parametres = { code: 'CODE123', state: a };
assert.deepEqual({ ...(await L.lireRetourDiscord()) }, { code: 'CODE123', etat: a, erreur: '' });
parametres = { error: 'access_denied', state: a };
assert.deepEqual({ ...(await L.lireRetourDiscord()) }, { code: '', etat: a, erreur: 'access_denied' });
L.effacerRetourDiscord();
assert.equal(remplacements.length, 1);
assert.equal(remplacements[0][0], null);
assert.deepEqual({ ...remplacements[0][1] }, {});
delete lctx.google;
L.effacerRetourDiscord();

// ---------------------------------------------------------------- écran de connexion
function nodes(node = tree) {
  if (Array.isArray(node)) return node.flatMap(n => nodes(n));
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
let props;
async function render() {
  for (let loops = 0; loops < 20; loops++) {
    dirty = false; cursor = 0; tree = Login(props);
    effects.splice(0).forEach(fn => fn());
    await new Promise(r => setTimeout(r, 0));
    if (!dirty) return tree;
  }
  assert.fail('Rendu instable');
}
const monter = async (modes, discordRetour) => {
  slots = []; effects = [];
  const appels = [];
  props = { onLogin: () => {}, discordRetour, serverCall: (nom, ...args) => { appels.push(nom); return modes instanceof Error ? Promise.reject(modes) : Promise.resolve(modes); } };
  await render();
  return appels;
};
const lien = () => nodes().find(n => n.type === 'a' && n.props.className?.includes('discord-button'));
const champ = () => nodes().find(n => n.props?.id === 'access-code');
const boutonCode = () => nodes().find(n => n.type === 'button' && text(n).includes('Entrer dans le registre'));

// Discord fermé : écran d'avant, code en bouton principal.
let appels = await monter({ discord: null });
assert.deepEqual(appels, ['getModesConnexion']);
assert.equal(lien(), undefined);
assert.match(text(tree), /Identifiez-vous avec votre code de garde ou d’officier/);
assert.equal(boutonCode().props.className, 'primary-button');

// Serveur injoignable : même écran, aucune erreur affichée.
await monter(new Error('réseau'));
assert.equal(lien(), undefined);
assert.ok(!nodes().some(n => n.props?.role === 'alert'));

// Discord ouvert : bouton principal vers Discord, code en dessous.
const base = 'https://discord.com/oauth2/authorize?response_type=code&client_id=1&scope=identify';
await monter({ discord: { url: base } });
const href = lien().props.href;
assert.match(href, new RegExp(`^${base.replace(/[?.]/g, '\\$&')}&state=[0-9a-f]{32}$`));
assert.equal(lien().props.target, '_top', 'Toute la page part vers Discord, pas le cadre');
assert.equal(boutonCode().props.className, 'secondary-button login-code-button');
assert.match(text(tree), /Intendance et secours : code d’accès/);
assert.match(text(tree), /ou avec un code d’accès/);
stockage.clear();
lien().props.onClick({ preventDefault() { assert.fail('Le lien doit partir'); } });
assert.equal([...stockage.values()][0], new URL(href).searchParams.get('state'), 'State gardé au clic');
await render();
assert.equal(lien().props.href, href, 'State stable d’un rendu à l’autre');

// Retour en cours : statut annoncé, tout figé, le lien ne repart pas.
await monter({ discord: { url: base } }, { statut: 'connexion', erreur: '' });
assert.match(text(nodes().find(n => n.props?.role === 'status')), /Connexion Discord en cours/);
assert.equal(champ().props.disabled, true);
assert.equal(boutonCode().props.disabled, true);
assert.equal(lien().props['aria-disabled'], true);
let empeche = false;
lien().props.onClick({ preventDefault() { empeche = true; } });
assert.ok(empeche);

// Erreur du retour : affichée comme une erreur de code.
await monter({ discord: { url: base } }, { statut: '', erreur: 'Connexion Discord annulée.' });
assert.equal(text(nodes().find(n => n.props?.role === 'alert')), 'Connexion Discord annulée.');
assert.equal(champ().props['aria-describedby'], 'login-error');

console.log('Connexion Discord (navigateur) : state, retour dans l’adresse et écran de connexion validés.');
