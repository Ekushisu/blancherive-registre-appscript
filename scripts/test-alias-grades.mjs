// Alias de grade de l'Académie militaire de Blancherive (`ui/src/corps.js`) :
// Caporal et Caporal-Chef s'affichent « Instructeur », Sergent et Sergent-Chef
// « Sergent-Instructeur », dans ce corps seulement, affichage seul. Les deux
// alias ont une description de grade (`ui/src/grades.jsx`).
//
//   node scripts/test-alias-grades.mjs

import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { ALIAS_GRADES_CORPS, libelleGrade } from '../ui/src/corps.js';

const ACADEMIE = 'Académie militaire de Blancherive';
const cas = [
  ['Caporal', 'Instructeur'],
  ['Caporal-Chef', 'Instructeur'],
  ['caporal chef', 'Instructeur'],
  ['Sergent', 'Sergent-Instructeur'],
  ['Sergent-Chef', 'Sergent-Instructeur'],
  ['SERGENT-CHEF', 'Sergent-Instructeur']
];
for (const [grade, attendu] of cas) {
  assert.equal(libelleGrade(grade, ACADEMIE), attendu, `${grade} à l'Académie`);
  assert.equal(libelleGrade(grade, 'academie militaire'), attendu, `${grade}, libellé court`);
  assert.equal(libelleGrade(grade, 'Cité de Blancherive'), grade, `${grade} ailleurs : inchangé`);
  assert.equal(libelleGrade(grade, ''), grade, 'Sans corps : inchangé');
}
// Les autres grades de l'Académie gardent leur nom ; rien ne s'invente.
for (const grade of ['Capitaine', 'Lieutenant', 'Garde', 'Cadet', 'Recrue', 'Major']) assert.equal(libelleGrade(grade, ACADEMIE), grade);
assert.equal(libelleGrade('', ACADEMIE), '');
assert.equal(libelleGrade(undefined, ACADEMIE), undefined);
assert.equal(ALIAS_GRADES_CORPS.length, 1, 'Seule l’Académie porte des alias');

// Descriptions des alias (grades.jsx), singulier comme pluriel d'en-tête.
const React = { useEffect() {}, useId: () => 'id', useRef: () => ({ current: null }), useState: v => [v, () => {}], createElement: () => null };
const context = vm.createContext({ React, exports: {}, String, console });
context.module = { exports: context.exports };
const bundle = await build({ entryPoints: ['ui/src/grades.jsx'], bundle: true, write: false, format: 'cjs', jsxFactory: 'React.createElement' });
vm.runInContext(bundle.outputFiles[0].text, context);
const { descriptionGrade } = context.module.exports;
for (const alias of ['Instructeur', 'Sergent-Instructeur', 'Instructeurs']) assert.match(descriptionGrade(alias), /Académie militaire de Blancherive/, alias);
assert.match(descriptionGrade('Sergent-Instructeur'), /Sergent-Chef est à la tête/);
assert.notEqual(descriptionGrade('Instructeur'), descriptionGrade('Sergent-Instructeur'));
assert.notEqual(descriptionGrade('Instructeur'), descriptionGrade('Caporal'), 'L’alias a sa propre description');

console.log('test-alias-grades : OK');
