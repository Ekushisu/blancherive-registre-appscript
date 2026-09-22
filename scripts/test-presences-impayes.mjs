/*
  Repérage des soldes impayées dans les accordéons de semaines.

  « Impayé » est une règle métier, pas un détail d'affichage : une solde due et
  non réglée. Une solde nulle — Recrue, ou semaine sans présence — n'en est pas
  une, sans quoi chaque semaine afficherait un compte d'impayés trompeur et le
  filtre ramènerait des personnes qui ne doivent rien.

  C'est la même distinction que celle des couleurs de lignes du tableau.
*/
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const React = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: initial => [initial, () => {}],
  useEffect() {}, useMemo: fn => fn(), useRef: () => ({ current: null }),
  useContext: () => ({ events: [], seen: {}, mark() {} }),
  useId: () => 'id-test',
  createContext: valeur => ({ Provider: () => null, _valeur: valeur })
};
const ctx = vm.createContext({ React, exports: {}, console });
ctx.module = { exports: ctx.exports };
const bundle = await build({
  entryPoints: ['ui/src/app.jsx'], bundle: true, write: false, format: 'cjs',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  // Les imports CSS ne servent pas ici ; esbuild les signale, sans conséquence.
  logLevel: 'silent',
  loader: { '.jsx': 'jsx', '.css': 'text', '.jpg': 'text', '.png': 'text' }
});
vm.runInContext(bundle.outputFiles[0].text, ctx);
const { estImpayePresence, compteImpayesSemaine, corpsPresence, lireSyntheseOuverte } = ctx.module.exports;
assert.equal(typeof estImpayePresence, 'function');
assert.equal(typeof compteImpayesSemaine, 'function');
assert.equal(typeof corpsPresence, 'function');

const solde = (soldeRaw, paye) => ({ soldeRaw, paye });

// Une solde due et non réglée est un impayé.
assert.equal(estImpayePresence(solde(400, false)), true);

// Réglée, elle ne l'est plus, quel que soit le montant.
assert.equal(estImpayePresence(solde(400, true)), false);

// Une solde nulle n'est jamais un impayé : la Recrue est à 0 par barème,
// et une semaine sans présence produit également 0.
assert.equal(estImpayePresence(solde(0, false)), false);
assert.equal(estImpayePresence(solde(0, true)), false);

// Les valeurs venant de Sheets peuvent être des chaînes ou vides.
assert.equal(estImpayePresence(solde('320', false)), true);
assert.equal(estImpayePresence(solde('', false)), false);
assert.equal(estImpayePresence(solde(null, false)), false);
assert.equal(estImpayePresence(solde(undefined, false)), false);

// Une valeur non numérique ne doit pas compter comme un impayé.
assert.equal(estImpayePresence(solde('à déterminer', false)), false);

/*
  Le compte affiché dans l'en-tête porte sur toute la semaine : il répond à
  « cette semaine a-t-elle des impayés ? », y compris accordéon replié et
  pendant une recherche. Le bouton disparaît quand le compte est nul.
*/
const semaine = [
  solde(500, false), solde(400, true), solde(0, false),
  solde(240, false), solde(0, true)
];
assert.equal(semaine.filter(estImpayePresence).length, 2);
assert.equal([solde(400, true), solde(0, false)].filter(estImpayePresence).length, 0,
  'Sans impayé, le bouton de filtre ne doit pas être proposé');

/*
  La semaine courante n'est jamais comptée : on est payé le lundi pour la semaine
  précédente, donc une semaine en cours est impayée par construction. La compter
  ferait de chaque semaine une alerte permanente.
*/
assert.equal(compteImpayesSemaine(semaine, { current: false }), 2);
assert.equal(compteImpayesSemaine(semaine, { current: true }), 0,
  "La semaine courante n'est pas encore due : elle ne compte aucun impayé");

/*
  Le filtre par corps restreint le compte : un officier qui n'a demandé que son
  corps attend un compte qui parle de ses hommes.
*/
const parCorps = [
  { soldeRaw: 500, paye: false, corps: 'Garnison de Blancherive' },
  { soldeRaw: 300, paye: false, corps: 'Éclaireurs' },
  { soldeRaw: 200, paye: false, corps: '' }
];
assert.equal(compteImpayesSemaine(parCorps, { current: false }), 3);
assert.equal(
  compteImpayesSemaine(parCorps, { current: false, matchesCorps: r => corpsPresence(r) === 'Éclaireurs' }),
  1);

// Une ligne sans corps porte le même libellé dans la liste déroulante et dans
// les sections de semaine : aucun homme ne se perd entre les deux vues.
assert.equal(corpsPresence({ corps: '' }), 'Sans corps');
assert.equal(corpsPresence({}), 'Sans corps');
assert.equal(
  compteImpayesSemaine(parCorps, { current: false, matchesCorps: r => corpsPresence(r) === 'Sans corps' }),
  1);

/*
  La synthèse OFFICIER est repliée par défaut : le travail courant de la page est
  le pointage, et sur téléphone les tuiles occupaient tout le premier écran. Seul
  un pli explicitement enregistré la rouvre ; une mémoire locale vide, illisible
  ou corrompue retombe donc sur « repliée ».
*/
assert.equal(lireSyntheseOuverte('1'), true);
assert.equal(lireSyntheseOuverte('0'), false);
assert.equal(lireSyntheseOuverte(null), false, 'Mémoire locale vide : synthèse repliée');
assert.equal(lireSyntheseOuverte(''), false);
assert.equal(lireSyntheseOuverte('true'), false, 'Une valeur inattendue ne déplie pas la synthèse');

console.log('Présences : règle des soldes impayées, semaine courante exclue, filtre par corps, synthèse repliée par défaut.');
