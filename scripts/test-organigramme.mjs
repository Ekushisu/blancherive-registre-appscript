import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { NOMS_AFFICHES_CORPS, libelleCorps } from '../ui/src/corps.js';

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
  // Le Hird du Jarl, dissous, n'a plus de branche : un membre resté actif n'est rendu nulle part.
  person('Hird', 'Capitaine', 'Hird du Jarl'),
  person('Maréchal', 'Maréchal', 'État-Major'),
  person('Commander', 'Commander', 'État-Major'),
  person('Jarl réel', 'Jarl', 'État-Major'),
  person('Ancien Jarl', 'Jarl', 'État-Major', 'Mort en service'),
  // Un Jarl en service tient le sommet seul : le Régent impérial n'est alors rendu nulle part.
  person('Régent', 'Régent impérial', 'État-Major'),
  // Le Huscarl est rendu sous le sommet, quel que soit son corps.
  person('Huscarl', 'Huscarl', 'Cité de Blancherive'),
  person('Huscarl titré', 'Huscarl de Blancherive', 'Hird du Jarl'),
  person('Huscarl réserviste', 'Huscarl', 'Cité de Blancherive', 'Réserve')
];
const DONNEES = [
  ['Grades'],
  ['Capitaine'],
  ['Garde']
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
assert.deepEqual(Array.from(data.garnisons.filter(g => !data.commandementLocal.garnisonKeys.includes(g.key)), g => g.key).sort(), ['cap-granite', 'cite', 'eclaireurs', 'faubourgs']);
assert.deepEqual(names(data.reserve), ['Huscarl réserviste', 'Réserviste central', 'Réserviste du Hird', 'Réserviste local']);
assert.equal(data.hird, undefined, 'Plus de branche du Hird');
// Le Jarl en service tient le sommet ; un Jarl mort ne s'affiche plus.
assert.equal(data.jarl.nomComplet, 'Jarl réel');
assert.deepEqual(Array.from(data.regents), [], 'Avec un Jarl en service, pas de régence');
assert.deepEqual(names(data.huscarls), ['Huscarl', 'Huscarl titré']);
assert.ok(!names(data.garnisons.find(g => g.key === 'cite').membres).includes('Huscarl'), 'Le Huscarl n’est pas dans son corps');
for (const grade of ['Huscarl', ' huscarl de Blancherive ', 'HUSCARL']) assert.ok(context.estGradeHuscarl(grade), grade);
for (const grade of ['Huscarls', 'Garde', '']) assert.ok(!context.estGradeHuscarl(grade), grade);
for (const grade of ['Régent impérial', ' REGENT IMPERIAL ', 'Régente impériale']) assert.ok(context.estGradeRegent(grade), grade);
for (const grade of ['Régent', 'Régence impériale', 'Jarl', '']) assert.ok(!context.estGradeRegent(grade), grade);
assert.equal(data.garnisons.length, 6);
// Les autres pages tiennent leurs noms affichés dans ui/src/corps.js : chaque
// corps qui y est renommé doit porter le même nom dans l'organigramme.
// Une constante de premier niveau n'est pas une propriété du contexte vm.
const garnisonsDeclarees = vm.runInContext('ORGANIGRAMME_GARNISONS', context);
for (const [corps, nom] of Object.entries(NOMS_AFFICHES_CORPS)) {
  const garnison = garnisonsDeclarees.find(g => context.correspondAGarnison(corps, g));
  assert.ok(garnison, `« ${corps} » doit être une garnison de l'organigramme`);
  assert.equal(garnison.label, nom, `« ${corps} » : même nom affiché partout`);
}
assert.equal(libelleCorps('Rivebois'), 'Rivebois', 'Un corps sans nom affiché garde le libellé de la feuille');
assert.equal(libelleCorps(''), '');
assert.deepEqual(Array.from(data.garnisons.find(g => g.key === 'rivebois').membres, p => p.grade), ['Capitaine', 'Garde']);
const displayed = [data.jarl, ...data.regents, ...data.huscarls, ...data.marechaux, ...data.commandants, ...data.majorsEtatMajor,
  ...data.commandementLocal.majors, ...data.majors, ...data.reserve, ...data.garnisons.flatMap(g => g.membres)];
assert.equal(new Set(names(displayed)).size, displayed.length, 'Aucun membre en double');
for (const absent of ['Ancien', 'Ancien local', 'Ancien Jarl', 'Hird', 'Régent']) assert.ok(!names(displayed).includes(absent), absent);

// Régence impériale : sans Jarl en service, le ou les Régents impériaux
// prennent le sommet, par ordre alphabétique ; les Huscarls restent à leur place.
context.lireEffectifsOrganigramme = () => [
  ...people.filter(p => p.nomComplet !== 'Jarl réel'),
  person('Autre Régente', 'Régente impériale', 'Cité de Blancherive'),
  person('Régent parti', 'Régent impérial', 'État-Major', 'Radié')
];
const regence = context.getOrganigramme('test-token');
assert.equal(regence.jarl, null, 'Jarl mort : plus de Jarl au sommet');
assert.deepEqual(Array.from(regence.regents, p => p.nomComplet), ['Autre Régente', 'Régent']);
assert.deepEqual(names(regence.huscarls), ['Huscarl', 'Huscarl titré']);
assert.ok(!names(regence.garnisons.find(g => g.key === 'cite').membres).includes('Autre Régente'), 'Le Régent n’est pas dans son corps');
assert.ok(!names(regence.majorsEtatMajor).includes('Régent'));

context.lireEffectifsOrganigramme = () => [];
const empty = context.getOrganigramme('test-token');
assert.equal(empty.jarl, null, 'Sans Jarl ni Régent, le poste est vacant');
assert.equal(empty.regents.length, 0);
assert.equal(empty.huscarls.length, 0, 'Poste de Huscarl vacant');
assert.equal(empty.majorsEtatMajor.length, 0);
assert.equal(empty.reserve.length, 0);
assert.equal(empty.commandementLocal.majors.length, 0);
assert.equal(empty.commandementLocal.garnisonKeys.length, 2, 'Le rattachement reste identique même sans Major actif');
console.log('Organigramme : sommet (Jarl, régence, vacance), répartition, réserve, exclusions, tri, absence de doublons et autorisations validés.');
