// Fiche de service, côté navigateur : libellés (septims, pluriels, carrière,
// ancienneté du dernier service), nom cliquable, pile des fiches ouvertes,
// cache (chargement au lancement, mise à jour silencieuse) et rendu du
// panneau, avec ses cas particuliers (inactivité, Hird non soldé, rien en
// attente, intendance sans Justice). React minimal, comme `test-chefs-ui.mjs`.
//
//   node scripts/test-fiche-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

let slots = [], cursor = 0, effects = [], dirty = false, tree, contexte = null;
const React = {
  // Comme React : pas de `children` sans enfant (un nom seul affiche son libellé).
  createElement(type, props, ...children) { return { type, props: children.length ? { ...props, children } : { ...props } }; },
  Fragment: 'fragment',
  createContext: () => ({ Provider: 'Provider' }),
  // Fiche ouverte ou non : réglé par chaque cas.
  useContext: () => contexte,
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { const next = typeof value === 'function' ? value(slots[i]) : value;
      if (!Object.is(next, slots[i])) { slots[i] = next; dirty = true; } }];
  },
  useEffect(fn, deps = []) {
    const i = cursor++;
    if (!slots[i] || deps.some((d, j) => d !== slots[i].deps[j])) effects.push(() => { slots[i] = { deps, cleanup: fn() }; });
  },
  useMemo(fn) { const i = cursor++; return (slots[i] ||= { valeur: fn() }).valeur; },
  useId() { cursor++; return 'id'; },
  useRef(v) { const i = cursor++; return slots[i] ||= { current: v }; }
};
// Le panneau fige la page et écoute le clavier, comme la modale du Codex.
const ecouteurs = new Set();
const document = {
  activeElement: null,
  body: { style: { overflow: '' } },
  addEventListener: (type, fn) => ecouteurs.add(fn),
  removeEventListener: (type, fn) => ecouteurs.delete(fn)
};
const context = vm.createContext({ React, document, exports: {}, console, Intl, Date, Promise, setTimeout, clearTimeout });
context.module = { exports: context.exports };
context.globalThis = context;
const bundle = await build({ entryPoints: ['ui/src/fiche.jsx'], bundle: true, write: false, format: 'cjs',
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
assert.equal(L.libelleEvenement({ type: 'corps', avant: 'Cité de Blancherive', apres: 'Cap Granite' }), 'Affecté à Cap Granite, venant de Cité de Blancherive');
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

// ---------------------------------------------------------------- nom cliquable
// Sans fiche ouverte (visiteur, tests d'autres pages), un nom reste du texte.
contexte = null;
assert.equal(text(L.NomEffectif({ nom: ' Eydis la Silencieuse ' })), 'Eydis la Silencieuse');
assert.ok(!nodes(L.NomEffectif({ nom: 'Eydis' })).some(n => n.type === 'button'));
// Avec la fiche : un bouton, qui ouvre la fiche sans remonter le clic.
const ouvertes = [];
contexte = { ouvrir: cible => ouvertes.push(cible) };
const bouton = nodes(L.NomEffectif({ nom: ' Eydis la Silencieuse ', membre: 'u-eydis' })).find(n => n.type === 'button');
assert.ok(bouton, 'Nom cliquable');
assert.equal(bouton.props.className, 'nom-effectif');
let remonte = true;
bouton.props.onClick({ stopPropagation() { remonte = false; } });
assert.deepEqual(JSON.parse(JSON.stringify(ouvertes)), [{ membre: 'u-eydis', nom: 'Eydis la Silencieuse' }]);
assert.equal(remonte, false, 'Le clic n’ouvre pas aussi la ligne ou la carte');
assert.equal(text(L.NomEffectif({ nom: '' })), '', 'Sans nom, rien à ouvrir');
contexte = null;

// ---------------------------------------------------------------- pile des fiches
slots = []; cursor = 0;
let fournisseur = L.FicheProvider({ token: 'jeton', serverCall: () => new Promise(() => {}), children: 'page' });
assert.ok(!nodes(fournisseur).some(n => n.props?.role === 'dialog'), 'Aucune fiche ouverte au départ');
const valeur = fournisseur.props.value;
valeur.ouvrir({ membre: 'u-eydis', nom: 'Eydis' });
valeur.ouvrir({ membre: 'u-bryn', nom: 'Brynjar' });
cursor = 0; fournisseur = L.FicheProvider({ token: 'jeton', serverCall: () => new Promise(() => {}), children: 'page' });
const panneauOuvert = fournisseur.props.children[1];
assert.equal(panneauOuvert.type, L.FichePanneau);
assert.deepEqual(panneauOuvert.props.cible, { membre: 'u-bryn', nom: 'Brynjar' }, 'La dernière fiche ouverte est affichée');
assert.equal(panneauOuvert.props.profondeur, 2);
panneauOuvert.props.onRetour();
cursor = 0; fournisseur = L.FicheProvider({ token: 'jeton', serverCall: () => new Promise(() => {}), children: 'page' });
assert.deepEqual(fournisseur.props.children[1].props.cible, { membre: 'u-eydis', nom: 'Eydis' }, 'Retour à la précédente');
fournisseur.props.children[1].props.onFermer();
cursor = 0; fournisseur = L.FicheProvider({ token: 'jeton', serverCall: () => new Promise(() => {}), children: 'page' });
assert.ok(!fournisseur.props.children[1], 'Fermer vide la pile');

// ---------------------------------------------------------------- panneau
const CIBLE = { membre: 'u-ivar', nom: 'Ivar Œil-Sombre' };
let fermetures = 0, retours = 0;
async function rendre(reponse, profondeur = 1, autres = {}) {
  slots = []; effects = []; const appels = [];
  const props = { token: 'jeton', cible: CIBLE, profondeur, onRetour: () => retours++, onFermer: () => fermetures++,
    serverCall: (nom, ...args) => { appels.push([nom, ...args]); return reponse instanceof Error ? Promise.reject(reponse) : Promise.resolve(reponse); },
    ...autres };
  for (let i = 0; i < 10; i++) {
    dirty = false; cursor = 0; tree = L.FichePanneau(props);
    effects.splice(0).forEach(fn => fn());
    await new Promise(r => setTimeout(r, 0));
    if (!dirty) break;
  }
  return appels;
}

const base = {
  fiche: { memberId: 'u-ivar', prenom: 'Ivar', nom: 'Œil-Sombre', nomComplet: 'Ivar Œil-Sombre', grade: 'Garde', corps: 'Cap Granite', specialite: '', statut: 'En service actif', assermente: true },
  commandement: { corps: [{ memberId: 'u-rag', nomComplet: 'Ragnhild Fer-Juste', grade: 'Capitaine', corps: 'Cap Granite' }], etatMajor: [] },
  carriere: { inscription: '2026-10-03T10:00:00.000Z', avantJournal: false, evenements: [] },
  service: { lundiCourant: '2026-10-12', exclu: false, semaineCourante: null, enAttente: [], totalEnAttente: 0, totalPercu: 0,
    derniereSemaineReglee: '', joursTotal: 0, semainesServies: 0, moyenne: 0, serie: 0, dernierJour: '', joursDepuis: null, inactif: true, seuilInactivite: 5 },
  justice: { amendes: { nombre: 0, total: 0, aEncaisser: { nombre: 0, total: 0, aDeterminer: 0 }, aReverser: { nombre: 0, total: 0 }, dernieres: [] },
    prison: { nombre: 0, enCellule: [], dernieres: [] } }
};
const appels = await rendre(base);
assert.deepEqual(JSON.parse(JSON.stringify(appels)), [['getFicheService', 'jeton', CIBLE]]);
let page = text(tree);
assert.ok(nodes(tree).some(n => n.props?.role === 'dialog' && n.props['aria-modal'] === 'true'), 'Panneau modal');
assert.equal(document.body.style.overflow, 'hidden', 'Page figée sous le panneau');
assert.match(page, /Fiche de service/);
assert.match(page, /Ivar Œil-Sombre/);
assert.match(page, /Garde · Cap Granite/, 'Grade et corps tels que la feuille les écrit');
assert.match(page, /Aucun jour de service enregistré à son nom/, 'Jamais pointé : inactivité signalée');
assert.match(page, /Aucun pointage cette semaine/);
assert.match(page, /Aucune solde en attente\./);
assert.match(page, /Justice/);
assert.match(page, /Aucune amende dressée/);
assert.match(page, /Aucune promotion ni mutation/);
assert.match(page, /Inscription au registre le/);
assert.doesNotMatch(page, /\bvous\b|\bvotre\b/i, 'Une fiche parle d’un effectif, pas au lecteur');
assert.ok(!nodes(tree).some(n => n.props?.className?.includes('fiche-retour')), 'Première fiche : pas de retour');
nodes(tree).find(n => n.props?.className === 'fiche-fermer').props.onClick();
assert.equal(fermetures, 1);
// Échap ferme aussi.
[...ecouteurs].forEach(fn => fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} }));
assert.equal(fermetures, 2);

// Fiche ouverte depuis une autre : bouton Retour.
await rendre(base, 2);
nodes(tree).find(n => n.props?.className?.includes('fiche-retour')).props.onClick();
assert.equal(retours, 1);

// Inactif depuis douze jours, avec une solde en attente.
await rendre({ ...base, service: { ...base.service, inactif: true, dernierJour: '2026-10-02', joursDepuis: 12,
  enAttente: [{ lundi: '2026-09-28', joursPresents: 2, solde: 80, financeur: 'Argentier de la cour' }], totalEnAttente: 80 } });
page = text(tree);
assert.match(page, /Aucun service depuis 12 jours : au-delà de 5, son nom remonte au tableau des officiers/);
assert.match(page, /En attente : 80 septims/);
assert.match(page, /Argentier de la cour/);

// Intendance : le serveur n'envoie pas la Justice, la section n'existe pas.
await rendre({ ...base, justice: null });
page = text(tree);
assert.doesNotMatch(page, /Justice|amende/);
assert.match(page, /Solde/);

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
  commandement: { corps: [], etatMajor: [], jarl: [{ memberId: 'u-jarl', nomComplet: 'Siddgeir Vent-Doré', grade: 'Jarl', corps: 'État-Major' }] } });
page = text(tree);
assert.match(page, /Aucun supérieur dans son corps/);
assert.match(page, /Siddgeir Vent-Doré/, 'Le Jarl dans la chaîne de commandement');

// Les supérieurs ouvrent leur fiche, par leur ID membre.
contexte = { ouvrir: cible => ouvertes.push(cible) };
ouvertes.length = 0;
await rendre(base);
nodes(tree).filter(n => n.props?.className === 'nom-effectif').forEach(n => n.props.onClick({ stopPropagation() {} }));
assert.deepEqual(JSON.parse(JSON.stringify(ouvertes)), [{ membre: 'u-rag', nom: 'Ragnhild Fer-Juste' }]);
contexte = null;

// Régence impériale : le Régent au sommet, sous son titre ; non soldé, comme le Jarl.
await rendre({ ...base, commandement: { ...base.commandement,
  jarl: [{ memberId: 'u-reg', nomComplet: 'Aurelia Vesuia', grade: 'Régent impérial', corps: 'État-Major' }] } });
page = text(tree);
assert.match(page, /Régence impériale/);
assert.ok(!/Jarl/.test(page), 'Aucune mention du Jarl sous régence');
await rendre({ ...base, fiche: { ...base.fiche, grade: 'Régent impérial', corps: 'État-Major' }, service: { ...base.service, exclu: true, inactif: false } });
assert.match(text(tree), /Le Régent impérial n’est pas soldé par le registre/);

// ---------------------------------------------------------------- cache
// Même rapprochement des noms que le serveur (cleNomFiche_).
assert.equal(L.cleNomFiche(' Ivar \u00A0ŒIL-sombre '), 'ivar œil-sombre');
assert.equal(L.cleNomFiche('Éloïse  la Brune'), 'eloise la brune');
const cache = new Map();
L.memoriserFiche(cache, base, 10);
assert.equal(L.ficheEnCache(cache, { membre: 'u-ivar' }).data, base, 'Par ID membre');
assert.equal(L.ficheEnCache(cache, { nom: '  ivar œil-sombre' }).data, base, 'Par nom');
assert.equal(L.ficheEnCache(cache, { membre: 'u-inconnu', nom: 'Ivar Œil-Sombre' }).data, base, 'ID inconnu : le nom prend le relais');
assert.equal(L.ficheEnCache(cache, { membre: 'u-autre' }), null);
const ancienne = { ...base, fiche: { ...base.fiche, statut: 'Réserve' } };
L.memoriserFiche(cache, ancienne, 5);
assert.equal(L.ficheEnCache(cache, { membre: 'u-ivar' }).data, base, 'Une réponse plus ancienne n’écrase pas une plus récente');

// Fiche connue : affichée aussitôt, « Mise à jour… », puis remplacée par la réponse.
let repondre;
await rendre(null, 1, { cache, serverCall: () => new Promise(r => { repondre = r; }) });
page = text(tree);
assert.match(page, /Ivar Œil-Sombre/, 'Affichée sans attendre le serveur');
assert.match(page, /Mise à jour…/);
const fraiche = { ...base, fiche: { ...base.fiche, statut: 'Réserve' } };
repondre(fraiche);
await new Promise(r => setTimeout(r, 0));
cursor = 0; tree = L.FichePanneau({ token: 'jeton', cache, cible: CIBLE, serverCall: () => new Promise(() => {}), onFermer() {}, onRetour() {} });
page = text(tree);
assert.match(page, /Réserve/, 'Mise à jour silencieuse appliquée');
assert.doesNotMatch(page, /Mise à jour…/);
assert.equal(L.ficheEnCache(cache, { membre: 'u-ivar' }).data.fiche.statut, 'Réserve', 'Le cache garde la plus récente');

// Fiche connue, serveur injoignable : elle reste affichée, avec un avertissement.
await rendre(new Error('Délai dépassé.'), 1, { cache });
page = text(tree);
assert.match(page, /Ivar Œil-Sombre/);
assert.match(page, /Mise à jour impossible : Délai dépassé\./);
assert.ok(!nodes(tree).some(n => n.props?.role === 'alert'), 'Pas d’écran d’erreur quand la fiche est connue');

// Lancement : toutes les fiches en un appel, après le délai ; une fiche ouverte ensuite est déjà en cache.
slots = []; effects = []; cursor = 0;
const appelsLancement = [];
const serveurLancement = (nom, ...args) => {
  appelsLancement.push([nom, ...args]);
  return Promise.resolve(nom === 'getFichesService' ? { fiches: [base] } : base);
};
const propsLancement = { token: 'jeton', serverCall: serveurLancement, delaiPrechargement: 0, children: 'page' };
let lancement = L.FicheProvider(propsLancement);
effects.splice(0).forEach(fn => fn());
await new Promise(r => setTimeout(r, 10));
assert.deepEqual(JSON.parse(JSON.stringify(appelsLancement)), [['getFichesService', 'jeton']]);
lancement.props.value.ouvrir({ membre: 'u-ivar', nom: 'Ivar Œil-Sombre' });
cursor = 0; lancement = L.FicheProvider(propsLancement);
const panneauLance = lancement.props.children[1];
assert.equal(L.ficheEnCache(panneauLance.props.cache, { membre: 'u-ivar' }).data.fiche.nomComplet, 'Ivar Œil-Sombre');
// Échec du chargement au lancement : silencieux, rien en cache.
slots = []; effects = []; cursor = 0;
let echec = L.FicheProvider({ ...propsLancement, serverCall: () => Promise.reject(new Error('quota')) });
effects.splice(0).forEach(fn => fn());
await new Promise(r => setTimeout(r, 10));
echec.props.value.ouvrir({ membre: 'u-ivar' });
cursor = 0; echec = L.FicheProvider({ ...propsLancement, serverCall: () => Promise.reject(new Error('quota')) });
assert.equal(L.ficheEnCache(echec.props.children[1].props.cache, { membre: 'u-ivar' }), null);

// Erreur du serveur : affichée telle quelle.
await rendre(new Error('Aucune fiche à ce nom dans les Effectifs.'));
assert.match(text(tree), /Aucune fiche à ce nom dans les Effectifs/);
assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));

console.log('Fiche de service (navigateur) : libellés, nom cliquable, pile des fiches, cache et rendu du panneau validés.');
