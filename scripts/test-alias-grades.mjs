// Grades affichés selon le corps : lecture de la colonne « Alias Inquisition »
// de Données, équivalence avec le grade régulier, parité entre le serveur
// (`gradeAffiche_`) et le navigateur (`libelleGrade`), collecteurs des Amendes.
//
//   node scripts/test-alias-grades.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { libelleGrade } from '../ui/src/corps.js';

// Feuille simulée : lecture par bloc, valeurs affichées seulement.
const feuille = lignes => ({
  getLastRow: () => lignes.length,
  getLastColumn: () => Math.max(...lignes.map(l => l.length)),
  getRange: (row, column, height, width) => ({
    getDisplayValues: () => lignes.slice(row - 1, row - 1 + height)
      .map(l => Array.from({ length: width }, (_, j) => l[column - 1 + j] ?? ''))
  })
});

// Données telle que le propriétaire l'a remplie le 8 octobre 2026 : grades en
// A, alias en C, puis les autres listes de la feuille (corps en G, gardes en O).
const vide = n => Array(n).fill('');
const DONNEES = [
  ['Grades', '', 'Alias Inquisition', ...vide(3), 'Corps', ...vide(7), 'Gardes'],
  ['Maréchal', '', '', ...vide(3), 'Cité de Blancherive', ...vide(7), 'Alice Nord'],
  ['Commander', '', ''],
  ['Major', '', ''],
  ['Capitaine', '', 'Grand Inquisiteur', ...vide(3), 'Inquisition'],
  ['Lieutenant-Chef', '', 'La Plume'],
  ['Lieutenant', '', ''],
  ['Sergent-Chef', '', ' Enquêteur '],
  ['Sergent', '', ''],
  ['Caporal-Chef', '', 'Traqueur'],
  ['Caporal', '', ''],
  ['Garde', '', 'Inquisiteur'],
  ['Cadet', '', ''],
  ['Recrue', '', ''],
  ['', '', 'Orphelin']
];

const context = vm.createContext({});
vm.runInContext(readFileSync('src/AliasGrades.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Amendes.js', 'utf8'), context);
const plain = value => JSON.parse(JSON.stringify(value));
const classeur = feuilles => ({ getSheetByName: nom => feuilles[nom] || null });


// ============================================================
// LECTURE DE DONNÉES
// ============================================================

const ALIAS = plain(context.lireAliasGrades_(classeur({ Données: feuille(DONNEES) })));
assert.deepEqual(ALIAS, {
  Inquisition: {
    Capitaine: 'Grand Inquisiteur',
    'Lieutenant-Chef': 'La Plume',
    'Sergent-Chef': 'Enquêteur',
    'Caporal-Chef': 'Traqueur',
    Garde: 'Inquisiteur'
  }
}, 'Seules les lignes portant un grade et un alias ; espaces insécables retirés ; les autres colonnes sont ignorées');

assert.deepEqual(plain(context.lireAliasGrades_(classeur({}))), {}, 'Sans feuille Données : aucun alias');
assert.deepEqual(
  plain(context.lireAliasGrades_(classeur({ Données: feuille(DONNEES.map(l => [l[0], l[1]])) }))),
  {},
  'Sans colonne d’alias : chaque grade garde son nom'
);
assert.deepEqual(
  plain(context.lireAliasGrades_(classeur({ Données: feuille([['Alias Inquisition'], ['Grand Inquisiteur']]) }))),
  {},
  'La colonne A porte les grades, jamais des alias'
);

// L'en-tête nomme le corps : une autre colonne « Alias … » donnerait sa propre table.
const deuxCorps = DONNEES.map((l, i) => [...l.slice(0, 3), i === 0 ? 'alias  Éclaireurs' : i === 4 ? 'Grand Veneur' : '']);
assert.deepEqual(
  Object.keys(plain(context.lireAliasGrades_(classeur({ Données: feuille(deuxCorps) })))),
  ['Inquisition', 'Éclaireurs']
);


// ============================================================
// GRADE AFFICHÉ : SERVEUR ET NAVIGATEUR
// ============================================================

const cas = [
  // grade,            corps,          attendu
  ['Capitaine',        'Inquisition',  'Grand Inquisiteur'],
  ['capitaine',        ' INQUISITION ', 'Grand Inquisiteur'],
  ['Lieutenant-Chef',  'Inquisition',  'La Plume'],
  ['Sergent-Chef',     'Inquisition',  'Enquêteur'],
  ['Caporal-Chef',     'Inquisition',  'Traqueur'],
  ['Garde',            'Inquisition',  'Inquisiteur'],
  ['Lieutenant',       'Inquisition',  'Lieutenant'],   // pas d'alias : grade régulier
  ['Major',            'Inquisition',  'Major'],
  ['Recrue',           'Inquisition',  'Recrue'],
  ['Capitaine',        'Rivebois',     'Capitaine'],    // autre corps : grade régulier
  ['Garde',            '',             'Garde'],
  ['',                 'Inquisition',  '']
];
for (const [grade, corps, attendu] of cas) {
  assert.equal(context.gradeAffiche_(grade, corps, ALIAS), attendu, `serveur : ${grade} / ${corps}`);
  assert.equal(libelleGrade(grade, corps, ALIAS), attendu, `navigateur : ${grade} / ${corps}`);
}

// Le navigateur reconnaît aussi le nom affiché du corps (titre de garnison).
assert.equal(libelleGrade('Capitaine', 'Garde inquisitoriale', ALIAS), 'Grand Inquisiteur');
// Table absente (ancienne réponse, page sans alias) : rien ne change.
assert.equal(libelleGrade('Capitaine', 'Inquisition', undefined), 'Capitaine');
assert.equal(context.gradeAffiche_('Capitaine', 'Inquisition', null), 'Capitaine');


// ============================================================
// COLLECTEURS DES AMENDES
// ============================================================

const EFFECTIFS = [
  ['Prénom', 'Nom', 'Grade', 'Corps', 'Spécialité', 'Statut'],
  ['Ragnhild', 'Fer-Juste', 'Garde', 'Inquisition', 'Collecteur de la garde', 'En service actif'],
  ['Ingrid', 'Main-Leste', 'Garde', 'Inquisition', '', 'En service actif'],
  ['Torvald', 'Hache-Vive', 'Garde', 'Rivebois', 'Collecteur de la garde', 'En service actif'],
  ['Kjell', 'Bras-Long', 'Garde', 'Rivebois', '', 'En service actif']
];
let lecturesDonnees = 0;
const donnees = feuille(DONNEES);
const reversements = context.lireReversementsAmendes_(classeur({
  Effectifs: feuille(EFFECTIFS),
  Données: { ...donnees, getRange: (...args) => { lecturesDonnees++; return donnees.getRange(...args); } }
}));
assert.deepEqual(plain(reversements.get('ingrid main-leste').collecteurs), ['Inquisiteur Ragnhild Fer-Juste'],
  'Un collecteur de l’Inquisition est nommé par l’alias de son grade');
assert.deepEqual(plain(reversements.get('kjell bras-long').collecteurs), ['Garde Torvald Hache-Vive']);
assert.equal(lecturesDonnees, 2, 'Données lue une seule fois (en-têtes, puis bloc des grades)');

lecturesDonnees = 0;
context.lireReversementsAmendes_(classeur({
  Effectifs: feuille(EFFECTIFS.map((l, i) => (i ? [...l.slice(0, 4), '', l[5]] : l))),
  Données: { ...donnees, getRange: (...args) => { lecturesDonnees++; return donnees.getRange(...args); } }
}));
assert.equal(lecturesDonnees, 0, 'Sans collecteur actif, Données n’est pas lue');

console.log('Alias de grade : lecture de Données, équivalence, parité serveur/navigateur et collecteurs validés.');
