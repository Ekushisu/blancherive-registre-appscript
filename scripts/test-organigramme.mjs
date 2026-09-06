import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

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
  person('Hird', 'Capitaine', 'Hird du Jarl'),
  person('Maréchal', 'Maréchal', 'État-Major'),
  person('Commander', 'Commander', 'État-Major')
];
let authorized = false;
const context = vm.createContext({
  SPREADSHEET_ID: 'test',
  requireRole(token, roles) {
    assert.equal(token, 'test-token');
    assert.deepEqual(Array.from(roles), ['GARDE', 'OFFICIER']);
    authorized = true;
    return { role: 'OFFICIER' };
  },
  SpreadsheetApp: { openById() {
    assert.ok(authorized, 'Autorisation avant lecture des données');
    return { getSheetByName: () => ({}) };
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
assert.deepEqual(names(data.reserve), ['Réserviste central', 'Réserviste du Hird', 'Réserviste local']);
assert.deepEqual(names(data.hird), ['Hird']);
assert.equal(data.garnisons.length, 6);
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
