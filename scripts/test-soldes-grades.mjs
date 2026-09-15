import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Simulateur limité aux formules de Présences pour vérifier les déplacements
// et les montants obtenus, y compris après régénération de la semaine.
const colName = index => String.fromCharCode(64 + index);
const toR1 = (formula, row, col) => formula.replace(/\b([A-O])(\d+)\b/g, (_, letter, target) =>
  `R[${Number(target) - row}]C[${letter.charCodeAt(0) - 64 - col}]`);
const toA1 = (formula, row, col) => formula.replace(/R\[(-?\d+)\]C\[(-?\d+)\]/g, (_, dr, dc) =>
  `${colName(col + Number(dc))}${row + Number(dr)}`);
class Sheet {
  constructor(name, rows) { this.name = name; this.rows = rows; this.capacity = 30; this.writes = []; }
  getParent() { return ss; }
  getLastRow() {
    let i = this.rows.length;
    while (i && !this.rows[i - 1].some(v => v !== '' && v !== undefined)) i--;
    return i;
  }
  getMaxRows() { return this.capacity; }
  insertRowsAfter(_, count) { this.capacity += count; }
  setFrozenRows() {}
  setColumnWidth() {}
  value(row, col) {
    const value = this.rows[row - 1]?.[col - 1] ?? '';
    if (typeof value !== 'string' || !value.startsWith('=')) return value;
    const days = this.rows[row - 1].slice(5, 12).filter(v => v === true).length;
    if (value.startsWith('=COUNTIF')) return days;
    const direct = value.match(/^=M\d+\*([\d.]+)$/);
    if (direct) return days * Number(direct[1]);
    if (value.startsWith('=IF(')) {
      const data = this.rows[row - 1];
      if (data[1] === 'Hird du Jarl' || data[2] === 'Recrue') return 0;
      const base = value.includes('Vue globale') ? globalBase : Number(value.match(/M\d+\*([\d.]+)/)[1]);
      // « Aspirant-Garde » n'existe plus, mais les formules déjà écrites le nomment.
      return days * base / (data[2] === 'Aspirant-Garde' ? 2 : 1);
    }
    throw Error(`Formule non simulée : ${value}`);
  }
  getRange(row, col, height = 1, width = 1) {
    if (row === 'L2') { row = 2; col = 12; }
    const raw = () => Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? ''));
    const range = {
      getValues: () => raw().map((r, i) => r.map((_, j) => this.value(row + i, col + j))),
      getDisplayValues: () => range.getValues().map(r => r.map(String)),
      getValue: () => this.name === 'Vue globale' ? globalBase : range.getValues()[0][0],
      getFormulas: () => raw().map(r => r.map(v => typeof v === 'string' && v.startsWith('=') ? v : '')),
      getFormulasR1C1: () => range.getFormulas().map((r, i) => r.map((v, j) => toR1(v, row + i, col + j))),
      setValues: values => {
        assert.equal(values.length, height);
        this.writes.push({ row, col, height, width });
        values.forEach((r, i) => { this.rows[row - 1 + i] ||= []; r.forEach((v, j) => { this.rows[row - 1 + i][col - 1 + j] = v; }); });
        return range;
      },
      setFormulas: values => range.setValues(values),
      setFormulasR1C1: values => range.setValues(values.map((r, i) => r.map((v, j) => toA1(v, row + i, col + j)))),
      clearContent: () => range.setValues(Array.from({ length: height }, () => Array(width).fill(''))),
      clearDataValidations: () => range, setDataValidation: () => range,
      setFontWeight: () => range, setHorizontalAlignment: () => range,
      insertCheckboxes: () => { throw Error('Ne pas effacer les valeurs des cases existantes'); }
    };
    return range;
  }
}
let globalBase = 50, week = 36;
const oldFormula = row => `=IF(OR(B${row}="Hird du Jarl";C${row}="Recrue");0;IF(C${row}="Aspirant-Garde";M${row}*'Vue globale'!$L$2/2;M${row}*'Vue globale'!$L$2))`;
const person = (week, grade, name, row, corps = 'Cité') =>
  [week, corps, grade, name, '', true, true, true, false, false, false, false,
    `=COUNTIF(F${row}:L${row};TRUE)`, oldFormula(row), true];
const presence = new Sheet('Présences', [Array(15).fill('En-tête'),
  person(36, 'Commander', 'Actuel', 2), person(35, 'Commander', 'Ancien', 3),
  person(36, 'Garde', 'Garde', 4), person(36, 'Cadet', 'Cadet', 5),
  // Semaine passée : le grade « Aspirant-Garde », supprimé depuis, reste inscrit
  // dans les lignes historiques et conserve son tarif d'origine.
  person(36, 'Recrue', 'Recrue', 6), person(35, 'Aspirant-Garde', 'Ancien aspirant', 7),
  person(36, 'Commander', 'Hird', 8, 'Hird du Jarl'), person(34, 'Commander', 'Manuel', 9)
]);
presence.rows[8][13] = 77;
presence.rows[2][15] = 'Colonne technique préservée';
const sheets = new Map([
  ['Présences', presence], ['Effectifs', new Sheet('Effectifs', [])],
  ['Vue globale', new Sheet('Vue globale', [])],
  ['Données', new Sheet('Données', [['Grade'], ['Commander'], ['Garde'], ['Recrue'], ['Cadet']])]
]);
const ss = { getSheetByName: name => sheets.get(name), insertSheet: name => {
  const sheet = new Sheet(name, []); sheets.set(name, sheet); return sheet;
} };
const context = vm.createContext({
  console, Date,
  SpreadsheetApp: { openById: () => ss, flush() {}, newDataValidation: () => ({ requireCheckbox: () => ({ build: () => ({}) }) }) },
  LockService: { getDocumentLock: () => ({ waitLock() {}, releaseLock() {} }) }
});
vm.runInContext(readFileSync('src/Code.js', 'utf8'), context);
vm.runInContext(readFileSync('src/Presences.js', 'utf8'), context);
vm.runInContext(readFileSync('src/SoldesGrades.js', 'utf8'), context);
context.getCurrentIsoWeekWebApp = () => week;
context.getLastPresenceRowWebApp = sheet => sheet.getLastRow();
context.getLastPresenceRow = sheet => sheet.getLastRow();
const update = () => context.mettreAJourSoldesPresences_(ss, presence);
const amounts = () => presence.getRange(2, 14, presence.getLastRow() - 1, 1).getValues().flat();
update();
assert.deepEqual(amounts(), [300, 150, 150, 75, 0, 75, 0, 77]);
assert.ok(!presence.rows[2][13].includes('Vue globale'));
assert.equal(presence.rows[2][15], 'Colonne technique préservée');
const writes = presence.writes.length;
update(); assert.equal(presence.writes.length, writes, 'Migration et lectures idempotentes');
const tariff = sheets.get('SoldesGrades');
const rates = context.lireBaremeSoldesGrades_(ss);
assert.equal(context.tarifSoldeGrade_(rates, ' COMMANDANT ', 'Cité'), 100);
assert.equal(context.tarifSoldeGrade_(rates, 'Grade inconnu', 'Cité'), 50);
assert.equal(context.tarifSoldeGrade_(rates, 'Commander', 'Hird'), 0);
assert.equal(context.nombreFormuleSolde_(25.5), '(255*10^-1)', 'Tarif décimal indépendant de la langue du classeur');

tariff.rows.find(r => r[0] === 'Commander')[1] = 120;
globalBase = 999;
update();
assert.deepEqual(amounts(), [360, 150, 150, 75, 0, 75, 0, 77], 'Le nouveau barème ne modifie pas les semaines passées');
presence.rows[2][8] = true;
assert.equal(presence.value(3, 14), 200, 'Correction historique au tarif historique de 50');

context.lireEffectifsActifsPourPresences = () => [
  { prenom: 'Actuel', nom: '', grade: 'Commander', corps: 'Cité' },
  { prenom: 'Nouveau', nom: '', grade: 'Garde', corps: 'Rivebois' }
];
context.genererPresencesSemaineCourante();
const byName = name => presence.rows.findIndex(r => r[3] === name) + 1;
assert.equal(presence.value(byName('Ancien'), 14), 200, 'Tarif historique après tri et réécriture');
assert.equal(presence.value(byName('Ancien aspirant'), 14), 75);
assert.equal(presence.value(byName('Manuel'), 14), 77);
assert.equal(presence.value(byName('Actuel'), 14), 360);
assert.equal(presence.value(byName('Actuel'), 15), true, 'Paiement courant conservé');
assert.equal(presence.value(byName('Ancien'), 15), true, 'Paiement historique conservé');
assert.equal(presence.value(byName('Nouveau'), 14), 0);
assert.equal(presence.rows[2][15], 'Colonne technique préservée');
context.reparerFormulesPresence();
assert.equal(presence.value(byName('Ancien'), 14), 200, 'Réparation historique sans changement de tarif');
week = 37;
tariff.rows.find(r => r[0] === 'Commander')[1] = 200;
update();
assert.equal(presence.value(byName('Actuel'), 14), 360, 'La semaine clôturée garde son tarif de 120');

tariff.rows.find(r => r[0] === 'Commander')[1] = -1;
assert.throws(update, /Solde invalide/);
tariff.rows.find(r => r[0] === 'Commander')[1] = 100;
tariff.rows.push(['Commandant', 100]);
assert.throws(update, /double/);
tariff.rows.pop();
tariff.rows[0][0] = 'Autre contenu';
assert.throws(update, /en-têtes différents/);
assert.equal(tariff.rows[0][0], 'Autre contenu');
console.log('Soldes par grade : tarifs, migration, historique, régénération, paiements et validation du barème vérifiés.');
