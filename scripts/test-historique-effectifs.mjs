import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseSeenChanges, markChangesSeen, recentChanges, CHANGE_MAX_AGE } from '../ui/src/change-state.js';

class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; this.columns = Math.max(8, ...rows.map(r => r.length)); this.capacity = 100; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); }
  getMaxColumns() { return this.columns; }
  getMaxRows() { return this.capacity; }
  insertColumnsAfter(_, count) { this.columns += count; }
  insertRowsAfter(_, count) { this.capacity += count; }
  setFrozenRows() {}
  getRange(row, col, height = 1, width = 1) {
    const read = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: read,
      getDisplayValues: () => read().map(r => r.map(String)),
      setValues: values => {
        assert.equal(values.length, height);
        values.forEach((r, i) => {
          assert.equal(r.length, width);
          this.rows[row - 1 + i] ||= [];
          r.forEach((value, j) => { this.rows[row - 1 + i][col - 1 + j] = value; });
        });
        return range;
      },
      setValue: value => range.setValues([[value]]), setNote: () => range
    };
    return range;
  }
}
const roster = new Sheet('Effectifs', [
  ['Prénom', 'Nom', 'Grade', 'Corps', 'Statut'],
  ['Alice', 'Nord', 'Garde', 'Rivebois', 'En service actif'],
  ['Bob', 'Sud', 'Garde', 'Cité', 'Réserve']
]);
const sheets = new Map([['Effectifs', roster]]);
const ss = { getId: () => 'test', getSheetByName: name => sheets.get(name), insertSheet: name => {
  const sheet = new Sheet(name); sheets.set(name, sheet); return sheet;
} };
let locked = false, uuids = 0, triggers = 0;
let time = Date.parse('2026-09-06T12:00:00Z');
class TestDate extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
const props = new Map();
const normalize = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const context = vm.createContext({
  Date: TestDate, SPREADSHEET_ID: 'test',
  SpreadsheetApp: { flush() {}, openById: () => ss },
  Utilities: { getUuid: () => `uuid-${++uuids}` },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false); locked = true; }, releaseLock() { locked = false; } }) },
  lireSchemaEffectifsWeb_: () => ({ prenom: 0, nom: 1, grade: 2, corps: 3, status: 4 }),
  normaliserEffectifsWeb_: normalize,
  estStatutReserveOrganigramme: value => normalize(value) === 'reserve',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); return { role: token }; },
  getEffectifs: () => ({ ok: true }),
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key), setProperty: (key, value) => props.set(key, value) }) },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: name => {
    assert.equal(name, 'surModificationHistoriqueEffectifs_');
    const builder = { forSpreadsheet: () => builder, onEdit: () => builder, create: () => { triggers++; } };
    return builder;
  } }
});
vm.runInContext(readFileSync('src/HistoriqueEffectifs.js', 'utf8'), context);
const sync = () => context.synchroniserHistoriqueEffectifs_(ss);
let result = sync();
assert.equal(result.events.length, 0, 'Pas de fausses arrivées à l’initialisation');
assert.equal(roster.rows[0][5], 'ID membre');
const aliceId = roster.rows[1][5], bobId = roster.rows[2][5];
const journal = sheets.get('HistoriqueEffectifs');
assert.equal(journal.rows.length, 4);
sync();
assert.equal(journal.rows.length, 4, 'Lecture idempotente');

roster.rows[1][2] = 'Sergent'; roster.rows[1][3] = 'Cité';
result = sync();
assert.equal(result.events.length, 1);
assert.deepEqual(Array.from(result.events[0].changes, c => c.type), ['grade', 'corps']);
assert.equal(result.events[0].changes[0].avant, 'Garde');
assert.equal(result.events[0].changes[1].apres, 'Cité');
const eventId = result.events[0].id;
sync(); assert.equal(journal.rows.length, 5, 'Aucun doublon après un changement');

[roster.rows[1], roster.rows[2]] = [roster.rows[2], roster.rows[1]];
result = sync();
assert.equal(result.members.find(m => m.prenom === 'Alice').id, aliceId);
assert.equal(result.members.find(m => m.prenom === 'Bob').id, bobId);
assert.equal(journal.rows.length, 5, 'Un tri de lignes complètes ne crée aucun événement');

roster.rows[2][0] = 'Alicia';
result = sync();
assert.equal(result.events[0].memberId, aliceId);
assert.equal(result.events[0].nom, 'Alicia Nord');
assert.equal(result.events[0].id, eventId, 'Un renommage conserve identité et lecture');
roster.rows.push(['Claire', '', 'Recrue', 'Rivebois', 'Radié']);
result = sync();
assert.equal(result.events[0].changes[0].type, 'arrivee');
assert.equal(context.historiqueEffectifsPourRole_(result, 'GARDE').events.length, 1);
assert.equal(context.historiqueEffectifsPourRole_(result, 'OFFICIER').events.length, 2);
roster.rows[3][4] = 'Réserve';
result = sync();
assert.equal(context.historiqueEffectifsPourRole_(result, 'GARDE').events.length, 2);

roster.rows.push(['Double', '', 'Garde', 'Rivebois', 'En service actif', aliceId]);
result = sync();
assert.notEqual(roster.rows[4][5], aliceId, 'UUID copié réattribué');
assert.equal(result.events[0].changes[0].type, 'arrivee');
roster.rows[4][0] = '';
result = sync();
assert.equal(roster.rows[4][5], '', 'Une ligne vidée ne réutilise pas son ancien ID');
assert.equal(result.events.length, 2);
time += 15 * 86400000;
assert.equal(sync().events.length, 0, 'Expiration des badges après 14 jours');
assert.ok(journal.rows.length > 5, 'Historique conservé');

const beforeTrigger = journal.rows.length;
roster.rows[2][2] = 'Capitaine';
context.surModificationHistoriqueEffectifs_({ source: ss, range: { getSheet: () => roster } });
assert.equal(journal.rows.length, beforeTrigger + 1);
assert.equal(journal.rows.at(-1)[7], 'Google Sheets');
context.surModificationHistoriqueEffectifs_({ source: ss, range: { getSheet: () => new Sheet('Présences') } });
assert.equal(journal.rows.length, beforeTrigger + 1);
context.installerDeclencheurHistoriqueEffectifs_(ss);
context.installerDeclencheurHistoriqueEffectifs_(ss);
assert.equal(triggers, 1, 'Installation du déclencheur idempotente');

assert.throws(() => context.executerMutationHistoriqueEffectifs_('GARDE', {}, () => assert.fail()), /Accès refusé/);
context.executerMutationHistoriqueEffectifs_('OFFICIER', {}, () => {
  assert.equal(locked, true); roster.rows[2][3] = 'Bois-de-Chêne';
});
assert.equal(locked, false);
assert.equal(journal.rows.at(-1)[7], 'Application');
assert.throws(() => context.executerMutationHistoriqueEffectifs_('OFFICIER', {}, () => { throw Error('Échec'); }), /Échec/);
assert.equal(locked, false, 'Verrou libéré même en cas d’erreur');
const originalHeader = journal.rows[0][0];
journal.rows[0][0] = 'Autre contenu';
assert.throws(sync, /structure différente/);
assert.equal(journal.rows[0][0], 'Autre contenu');
journal.rows[0][0] = originalHeader;

const emptyRoster = new Sheet('Effectifs', [['Prénom', 'Nom', 'Grade', 'Corps', 'Statut']]);
sheets.set('Effectifs', emptyRoster); sheets.delete('HistoriqueEffectifs');
assert.equal(sync().events.length, 0);
emptyRoster.rows.push(['Premier', '', 'Recrue', 'Rivebois', 'En service actif']);
assert.equal(sync().events[0].changes[0].type, 'arrivee', 'Première arrivée après initialisation vide');

const now = Date.now();
assert.deepEqual(parseSeenChanges('invalide', now), {});
assert.deepEqual(parseSeenChanges('[]', now), {});
assert.deepEqual(parseSeenChanges(JSON.stringify({ old: now - CHANGE_MAX_AGE - 1, future: now + 1, valid: now }), now), { valid: now });
const seen = markChangesSeen({}, [{ id: 'old-event' }], now);
assert.equal(seen['old-event'], now);
assert.equal(seen['new-event'], undefined, 'Un nouveau changement redevient non vu');
assert.equal(recentChanges([{ date: new Date(now - CHANGE_MAX_AGE - 1).toISOString() }, { date: new Date(now).toISOString() }], now).length, 1);
console.log('Historique Effectifs : initialisation, identités, mutations, rôles, déclencheur, expiration et états vus validés.');
