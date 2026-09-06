import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let reads = 0;
let fineRows = [];
const presenceRows = [
  [36, 'Rivebois', 'Garde', 'Alice', '', ...Array(7).fill(false), 0, 100, true],
  [36, 'Rivebois', 'Garde', 'Bob', '', ...Array(7).fill(false), 0, 200, false],
  [35, 'Rivebois', 'Garde', 'Alice', '', ...Array(7).fill(false), 0, 50, false],
  [36, 'Hird', 'Garde', 'Hird', '', ...Array(7).fill(false), 0, 999, false]
];
const sheet = {
  getRange: () => ({ getValues: () => presenceRows, getDisplayValues: () => presenceRows.map(r => r.map(String)) })
};
const context = vm.createContext({
  Date, SPREADSHEET_ID: 'test', PRESENCES_SHEET_NAME: 'Présences',
  requireRole(token, roles) {
    if (!roles.includes(token)) throw new Error('Accès refusé');
    return { role: token };
  },
  SpreadsheetApp: { flush() {}, openById() { reads++; return { getSheetByName: () => sheet }; } },
  Utilities: { formatDate(date, zone, format) {
    assert.equal(format, 'yyyy-MM-dd');
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  } }
});
vm.runInContext(readFileSync('src/Presences.js', 'utf8'), context);
vm.runInContext(readFileSync('src/PresenceDashboard.gs.js', 'utf8'), context);
context.getLastPresenceRowWebApp = () => presenceRows.length + 1;
context.getCurrentIsoWeekWebApp = () => 36;
context.estCorpsExcluDesPresences_ = corps => corps === 'Hird';
assert.throws(() => context.getPresences('invalid'), /Accès refusé/);
assert.throws(() => context.getPresenceOfficerDashboard('GARDE'), /Accès refusé/);
assert.equal(reads, 0, 'Refus avant lecture Sheets');
assert.equal('corpsTotals' in context.getPresences('GARDE'), false);
const totals = context.getPresences('OFFICIER').corpsTotals;
assert.deepEqual(JSON.parse(JSON.stringify(totals)), [
  { semaine: 36, corps: 'Rivebois', total: 300 },
  { semaine: 35, corps: 'Rivebois', total: 50 }
]);
presenceRows[1][13] = 250;
assert.equal(context.getPresences('OFFICIER').corpsTotals[0].total, 350);

const ss = { getSheetByName: () => ({
  getLastRow: () => fineRows.length + 1,
  getRange: (...args) => {
    assert.deepEqual(args, [2, 1, fineRows.length, 7]);
    return { getValues: () => fineRows };
  }
}) };
const fine = (date, amount, paid = true, reversed = true) => [new Date(date), '', '', '', amount, paid, reversed];
fineRows = [
  fine('2026-08-30T22:00:00Z', 100), // lundi à minuit local
  fine('2026-09-06T21:59:59Z', 200), // dimanche soir local
  fine('2026-08-30T21:59:59Z', 999),
  fine('2026-09-06T22:00:00Z', 999),
  fine('2026-09-02', 999, true, false),
  fine('2026-09-02', 999, false, true),
  fine('invalid', 999),
  fine('2026-09-02', 'invalid')
];
assert.equal(context.presenceDashboardRecoveredFines_(ss, new Date('2026-09-06T12:00:00Z')), 300);
fineRows = [fine('2025-12-29', 50), fine('2026-01-04', 75), fine('2025-01-01', 999)];
assert.equal(context.presenceDashboardRecoveredFines_(ss, new Date('2026-01-01')), 125);
fineRows = [];
assert.equal(context.presenceDashboardRecoveredFines_(ss, new Date()), 0);
assert.throws(() => context.presenceDashboardRecoveredFines_({ getSheetByName: () => null }, new Date()), /introuvable/);
console.log('Finances des présences : autorisations, totaux et semaines validés.');
