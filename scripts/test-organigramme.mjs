import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { NOMS_AFFICHES_CORPS, libelleCorps, libelleGrade } from '../ui/src/corps.js';

const person = (nomComplet, grade, corps, status = 'En service actif') =>
  ({ nomComplet, prenom: nomComplet, nom: '', grade, corps, status });
const people = [
  person('Central', 'Major', 'État-Major'),
  person('Central bis', 'Major', 'Etat Major'),
  person('Major Rivebois', 'Major', 'Rivebois'),
  person('Major Chêne', 'Major', 'Bois De Chêne'),
  person('Major Chêne alias', 'Major', 'Bois-de-Chêne'),
  person('Détaché', 'Major', 'Cité de Blancherive'),
  person('Réserviste local', 'Major', 'Rivebois', 'Réserve'),
  person('Ancien local', 'Major', 'Bois-de-Chêne', 'Radié'),
  person('Major du Hird', 'Major', 'Hird du Jarl'),
  person('Réserviste central', 'Major', 'État-Major', 'Réserve'),
  person('Réserviste du Hird', 'Garde', 'Hird du Jarl', 'Réserve'),
  person('Ancien', 'Major', 'État-Major', 'Mort'),
  person('Capitaine', 'Capitaine', 'Rivebois'),
  person('Garde', 'Garde', 'Rivebois'),
  person('Inquisitrice', 'Capitaine', 'Inquisition'),
  person('Hird', 'Capitaine', 'Hird du Jarl'),
  person('Maréchal', 'Maréchal', 'État-Major'),
  person('Commander', 'Commander', 'État-Major')
];
// Données : grades en A, alias de l'Inquisition en C (AliasGrades.js).
const DONNEES = [
  ['Grades', '', 'Alias Inquisition'],
  ['Capitaine', '', 'Grand Inquisiteur'],
  ['Garde', '', 'Inquisiteur']
];
const donnees = {
  getLastRow: () => DONNEES.length,
  getLastColumn: () => DONNEES[0].length,
  getRange: (row, column, height, width) => ({ getDisplayValues: () =>
    DONNEES.slice(row - 1, row - 1 + height).map(l => l.slice(column - 1, column - 1 + width)) })
};
let authorized = false;
const context = vm.createContext({
  SPREADSHEET_ID: 'test',
  requireRole(token, roles) {
    assert.equal(token, 'test-token');
    // INTENDANT lit l'organigramme comme un GARDE : les cuisines de la cour en
    // tirent l'effectif à nourrir. Le filtrage des nouveautés reste celui des
    // rôles non-OFFICIER.
    assert.deepEqual(Array.from(roles), ['GARDE', 'OFFICIER', 'INTENDANT']);
    authorized = true;
    return { role: 'OFFICIER' };
  },
  SpreadsheetApp: { openById() {
    assert.ok(authorized, 'Autorisation avant lecture des données');
    return { getSheetByName: name => (name === 'Données' ? donnees : {}) };
  } }
});
vm.runInContext(readFileSync('src/Organigramme.js', 'utf8'), context);
vm.runInContext(readFileSync('src/AliasGrades.js', 'utf8'), context);
context.synchroniserHistoriqueEffectifs_ = () => ({ members: [], events: [], days: 14 });
context.historiqueEffectifsPourRole_ = () => ({ events: [], days: 14 });
context.installerDeclencheurHistoriqueEffectifs_ = () => {};
const withIds = context.lireEffectifsOrganigramme({
  getLastRow: () => 2, getLastColumn: () => 6,
  getRange: row => ({ getDisplayValues: () => row === 1
    ? [['Prénom', 'Nom', 'Grade', 'Corps', 'Statut', 'ID membre']]
    : [['Alice', 'Nord', 'Garde', 'Rivebois', 'En service actif', 'stable-uuid']] })
});
assert.equal(withIds[0].memberId, 'stable-uuid');
context.lireEffectifsOrganigramme = () => people;
context.lireOrdreGradesOrganigramme = () => new Map([['capitaine', 0], ['garde', 1]]);
const data = context.getOrganigramme('test-token');
const names = list => Array.from(list, p => p.nomComplet).sort();
assert.deepEqual(names(data.majorsEtatMajor), ['Central', 'Central bis']);
assert.deepEqual(names(data.majors), ['Détaché', 'Major du Hird']);
assert.deepEqual(names(data.commandementLocal.majors), ['Major Chêne', 'Major Chêne alias', 'Major Rivebois']);
assert.deepEqual(Array.from(data.commandementLocal.garnisonKeys), ['rivebois', 'bois-de-chene']);
assert.deepEqual(Array.from(data.garnisons.filter(g => !data.commandementLocal.garnisonKeys.includes(g.key)), g => g.key).sort(), ['cap-granite', 'cite', 'eclaireurs', 'faubourgs', 'inquisition']);
assert.deepEqual(names(data.reserve), ['Réserviste central', 'Réserviste du Hird', 'Réserviste local']);
assert.deepEqual(names(data.hird), ['Hird']);
assert.equal(data.garnisons.length, 7);
// La feuille écrit « Inquisition », l'organigramme affiche le nom de la Garde inquisitoriale.
const inquisition = data.garnisons.find(g => g.key === 'inquisition');
assert.equal(inquisition.nom, 'Garde inquisitoriale');
assert.deepEqual(names(inquisition.membres), ['Inquisitrice']);
// Grades affichés : la table des alias accompagne l'organigramme. Le titre de
// la garnison suffit à la retrouver, pour l'en-tête « Capitaine » d'un poste
// vacant ; le grade transmis reste le grade régulier.
const aliasGrades = JSON.parse(JSON.stringify(data.aliasGrades));
assert.deepEqual(aliasGrades, { Inquisition: { Capitaine: 'Grand Inquisiteur', Garde: 'Inquisiteur' } });
assert.equal(inquisition.membres[0].grade, 'Capitaine');
assert.equal(libelleGrade('Capitaine', inquisition.nom, aliasGrades), 'Grand Inquisiteur');
assert.equal(libelleGrade('Capitaine', inquisition.membres[0].corps, aliasGrades), 'Grand Inquisiteur');
assert.equal(libelleGrade('Capitaine', 'Rivebois', aliasGrades), 'Capitaine');
// Les autres pages tiennent leurs noms affichés dans ui/src/corps.js : chaque
// corps qui y est renommé doit porter le même nom dans l'organigramme.
// Une constante de premier niveau n'est pas une propriété du contexte vm.
const garnisonsDeclarees = vm.runInContext('ORGANIGRAMME_GARNISONS', context);
for (const [corps, nom] of Object.entries(NOMS_AFFICHES_CORPS)) {
  const garnison = garnisonsDeclarees.find(g => context.correspondAGarnison(corps, g));
  assert.ok(garnison, `« ${corps} » doit être une garnison de l'organigramme`);
  assert.equal(garnison.label, nom, `« ${corps} » : même nom affiché partout`);
}
assert.equal(libelleCorps(' INQUISITION '), 'Garde inquisitoriale', 'Casse et espaces ignorés');
assert.equal(libelleCorps('Rivebois'), 'Rivebois', 'Un corps sans nom affiché garde le libellé de la feuille');
assert.equal(libelleCorps(''), '');
assert.deepEqual(Array.from(data.garnisons.find(g => g.key === 'rivebois').membres, p => p.grade), ['Capitaine', 'Garde']);
const displayed = [data.jarl, ...data.marechaux, ...data.commandants, ...data.majorsEtatMajor,
  ...data.commandementLocal.majors, ...data.majors, ...data.hird, ...data.reserve, ...data.garnisons.flatMap(g => g.membres)];
assert.equal(new Set(names(displayed)).size, displayed.length, 'Aucun membre en double');
assert.ok(!names(displayed).includes('Ancien'));
assert.ok(!names(displayed).includes('Ancien local'));
context.lireEffectifsOrganigramme = () => [];
const empty = context.getOrganigramme('test-token');
assert.equal(empty.jarl.nomComplet, 'Lucius Haldor');
assert.equal(empty.majorsEtatMajor.length, 0);
assert.equal(empty.reserve.length, 0);
assert.equal(empty.commandementLocal.majors.length, 0);
assert.equal(empty.commandementLocal.garnisonKeys.length, 2, 'Le rattachement reste identique même sans Major actif');
console.log('Organigramme : répartition, réserve, exclusions, tri, absence de doublons et autorisations validés.');
