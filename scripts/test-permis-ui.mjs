// Vérifie les fonctions pures de la page Permis de chasse : recherche par
// prénom, nom du titulaire, contrôle du formulaire, date du jour.
//
//   node scripts/test-permis-ui.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';

const bundle = await build({ entryPoints: ['ui/src/permis.jsx'], bundle: true, write: false,
  format: 'cjs', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' });
const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment',
  useState() {}, useEffect() {}, useMemo() {} };
const context = vm.createContext({ React, exports: {}, Intl, Date });
context.module = { exports: context.exports };
vm.runInContext(bundle.outputFiles[0].text, context);
const { filtrerPermis, nomTitulaire, dateDuJour, LIMITES_PERMIS } = context.module.exports;
// Les objets sortent d'un autre contexte V8 : on les ramène à des objets ordinaires avant comparaison.
const validerPermis = (...args) => JSON.parse(JSON.stringify(context.module.exports.validerPermis(...args)));

const permis = [
  { row: 2, prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' },
  { row: 3, prenom: 'Lydia', nom: '', date: '2026-11-02' },
  { row: 4, prenom: 'Élodie', nom: 'de Rivebois', date: '2026-09-01' }
];

// Recherche : prénom d'abord, nom compris, sans casse ni accents, mot par mot.
assert.deepEqual(filtrerPermis(permis, '').map(p => p.row), [2, 3, 4], 'Sans recherche, tout');
assert.deepEqual(filtrerPermis(permis, '   ').map(p => p.row), [2, 3, 4]);
assert.deepEqual(filtrerPermis(permis, 'sven').map(p => p.row), [2]);
assert.deepEqual(filtrerPermis(permis, 'LYD').map(p => p.row), [3]);
assert.deepEqual(filtrerPermis(permis, 'elodie').map(p => p.row), [4], 'Accents ignorés');
assert.deepEqual(filtrerPermis(permis, 'fer').map(p => p.row), [2], 'Le nom compte aussi');
assert.deepEqual(filtrerPermis(permis, 'de rive').map(p => p.row), [4], 'Chaque mot doit se retrouver');
assert.deepEqual(filtrerPermis(permis, 'sven rivebois'), [], 'Deux mots de deux personnes : rien');

assert.equal(nomTitulaire(permis[0]), 'Sven Fer-Froid');
assert.equal(nomTitulaire(permis[1]), 'Lydia', 'Sans nom, le prénom seul');

// Contrôle du formulaire : mêmes règles que le serveur.
const aujourdhui = '2026-11-02';
assert.deepEqual(validerPermis({ prenom: '  Sven  ', nom: ' Fer-Froid ', date: '2026-10-20' }, aujourdhui), { prenom: 'Sven', nom: 'Fer-Froid', date: '2026-10-20' });
assert.deepEqual(validerPermis({ prenom: 'Lydia', nom: '', date: aujourdhui }, aujourdhui), { prenom: 'Lydia', nom: '', date: aujourdhui }, 'Nom facultatif, date du jour acceptée');
assert.deepEqual(validerPermis({ prenom: 'Lydia', date: aujourdhui }, aujourdhui).nom, '', 'Nom absent vaut vide');
assert.throws(() => validerPermis({ prenom: '', nom: 'X', date: aujourdhui }, aujourdhui), /prénom du titulaire/);
assert.throws(() => validerPermis({ prenom: 'a'.repeat(LIMITES_PERMIS.prenom + 1), date: aujourdhui }, aujourdhui), /60 caractères/);
assert.throws(() => validerPermis({ prenom: 'Sven', nom: 'b'.repeat(LIMITES_PERMIS.nom + 1), date: aujourdhui }, aujourdhui), /80 caractères/);
assert.throws(() => validerPermis({ prenom: 'Sven', date: '' }, aujourdhui), /date de délivrance/);
assert.throws(() => validerPermis({ prenom: 'Sven', date: '2026-11-03' }, aujourdhui), /dans l’avenir/);

assert.equal(dateDuJour(new Date(2026, 10, 2, 23, 59)), '2026-11-02', 'Date locale, pas UTC');
assert.equal(dateDuJour(new Date(2026, 0, 5)), '2026-01-05', 'Mois et jour sur deux chiffres');

console.log('Permis de chasse (interface) : recherche, titulaire, contrôle du formulaire et date du jour OK.');
