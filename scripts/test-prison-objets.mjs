import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const seed = JSON.parse(readFileSync('src/CatalogueObjets.html', 'utf8'));
const sheets = new Map();
let reads = 0, writes = 0, seedReads = 0, held = false, failWrite = false, failFlush = false;
class Sheet {
  constructor(name, rows = []) { this.name = name; this.rows = rows; this.max = 1000; }
  getLastRow() {
    let i = this.rows.length;
    while (i && !this.rows[i - 1]?.some(v => v !== '' && v !== undefined)) i--;
    return i;
  }
  getMaxRows() { return this.max; }
  insertRowsAfter(after, count) { this.max += count; }
  setFrozenRows() {}
  getRange(r, c, h = 1, w = 1) {
    const sheet = this;
    const range = {
      getValues() { reads++; return Array.from({length:h}, (_,i) => Array.from({length:w}, (_,j) => sheet.rows[r+i-1]?.[c+j-1] ?? '')); },
      getDisplayValues() { return this.getValues().map(row => row.map(String)); },
      setValues(values) {
        assert.equal(held, true, 'Écritures sous verrou');
        writes++;
        values.forEach((row,i) => row.forEach((v,j) => { (sheet.rows[r+i-1] ||= [])[c+j-1] = v; }));
        if (failWrite) { failWrite = false; throw Error('Écriture simulée en échec'); }
        return range;
      },
      setNumberFormat() { return range; }, setFontWeight() { return range; },
      insertCheckboxes() { return range; }, setValue(v) { return this.setValues([[v]]); },
      clearContent() { return this.setValues(Array.from({length:h}, () => Array(w).fill(''))); }
    };
    return range;
  }
}
const ss = {
  getSheetByName: name => sheets.get(name) || null,
  insertSheet(name) { assert.ok(!sheets.has(name)); const s = new Sheet(name); sheets.set(name,s); return s; },
  deleteSheet(sheet) { assert.equal(sheet.name, 'Objets'); assert.ok(held); sheets.delete(sheet.name); }
};
const context = vm.createContext({ Date, console, SPREADSHEET_ID:'test',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Accès refusé'); },
  SpreadsheetApp: { openById() { reads++; return ss; }, flush() { if (failFlush) { failFlush = false; throw Error('Flush en échec'); } } },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(held,false,'Pas de verrou imbriqué'); held = true; }, releaseLock() { held = false; } }) },
  HtmlService: { createHtmlOutputFromFile(name) { assert.equal(name,'CatalogueObjets'); seedReads++; return { getContent: () => JSON.stringify(seed) }; } },
  Utilities: { formatDate: date => date.toISOString() }
});
for (const f of ['Amendes.js','Objets.js','Prison.js']) vm.runInContext(readFileSync(`src/${f}`,'utf8'),context);
const plain = x => JSON.parse(JSON.stringify(x));
const search = q => plain(context.rechercherObjets('GARDE',q));
const prison = new Sheet('Prison', [Array(11).fill('En-tête'), ['2026-09-01','Garde','Ancien','','Vol',1,'','','', 'Deux épées\nUne bourse', 'Note historique']]);
sheets.set('Prison',prison);
sheets.set('Données',new Sheet('Données',[Array(15).fill(''), [...Array(14).fill(''),'Garde ']]));
sheets.set('SyncCodex',new Sheet('SyncCodex',[Array(15).fill(''), [...Array(13).fill(''),'Vol',2]]));
assert.throws(() => context.rechercherObjets('intrus','epee'), /Accès refusé/);
assert.throws(() => context.ajouterPrison('intrus',{saisies:[]}), /Accès refusé/);
assert.equal(reads,0);
assert.equal(search(' ép ').objets.length,0);
assert.equal(reads,0,'Recherche trop courte sans accès Sheets');
assert.throws(() => search('a'.repeat(101)), /invalide/);
assert.equal(context.getPrison('GARDE').rows[0].saisies,'Deux épées\nUne bourse');
context.getPrisonFormData('GARDE');
assert.equal(seedReads,0,'Ni registre ni données du formulaire ne chargent Objets');

failWrite = true;
assert.throws(() => search('epee'),/Écriture/);
assert.equal(sheets.has('Objets'),false,'Initialisation ratée retirable sans toucher Prison');
assert.equal(held,false);
const gold = search('000000F').objets.find(o => o.id === 'skyrim.esm|00000F');
assert.equal(gold.nom,'Or');
assert.equal(sheets.get('Objets').getLastRow(),seed.length + 1);
const seedReadCount = seedReads;
assert.equal(search('EPEE ACIER').objets[0].nom,"Épée d'acier");
assert.equal(search('013989').objets[0].id,'skyrim.esm|013989');
assert.equal(search('zzzzintrouvablezzzz').objets.length,0);
assert.equal(search('arm').objets.length,15);
assert.equal(search('arm').tronque,true);
assert.equal(seedReads,seedReadCount,'Feuille existante jamais réimportée');
const baseReads = reads;
assert.equal(context.preparerSaisiesPrison_([]),'[]');
assert.equal(reads,baseReads,'Pas de lecture catalogue pour une liste vide');
for (const quantite of [0,-1,1.5,'2',true,null,Infinity,Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(() => context.preparerSaisiesPrison_([{id:gold.id,quantite}]), /quantité/);
}
assert.throws(() => context.preparerSaisiesPrison_([{id:gold.id,quantite:Number.MAX_SAFE_INTEGER},{id:gold.id,quantite:1}]), /trop élevée/);
assert.throws(() => context.preparerSaisiesPrison_('9000 septims'), /Actualisez/);
assert.throws(() => context.preparerSaisiesPrison_(Array(101).fill({id:gold.id,quantite:1})), /100 objets/);
assert.throws(() => context.preparerSaisiesPrison_([{id:'inconnu',quantite:1}]), /n’existe plus/);
const serialised = context.preparerSaisiesPrison_([{id:gold.id,nom:'Faux nom',quantite:9000},{id:gold.id.toUpperCase(),quantite:2}]);
assert.deepEqual(JSON.parse(serialised),[{id:gold.id,nom:'Or',quantite:9002}]);
assert.match(context.afficherSaisiesPrison_(serialised),/^Or × 9\s002$/);
assert.equal(context.afficherSaisiesPrison_('[ancien texte'),'[ancien texte');
assert.equal(context.afficherSaisiesPrison_('[{"nom":"X"}]'),'[{"nom":"X"}]');
assert.equal(context.afficherSaisiesPrison_('[]'),'');

const data = {date:'2026-09-07',garde:'Garde',detenu:'Nouveau',cellule:'1',infraction:'Vol',entree:'2026-09-07T12:00',notes:'Test',saisies:[{id:gold.id,quantite:9000}]};
const before = JSON.stringify(prison.rows);
const beforeWrites = writes;
assert.throws(() => context.ajouterPrison('GARDE',{...data,saisies:[{id:'absent',quantite:1}]}), /n’existe plus/);
assert.equal(writes,beforeWrites,'Validation avant écriture Prison');
assert.equal(JSON.stringify(prison.rows),before);
failFlush = true;
assert.throws(() => context.ajouterPrison('GARDE',data),/Flush/);
assert.equal(prison.getLastRow(),2,'Pas de ligne fantôme après échec');
assert.equal(held,false,'Verrou libéré après échec');
const result = context.ajouterPrison('GARDE',data);
assert.equal(prison.rows[2][1],'Garde ','Valeur brute de la validation gardes conservée');
assert.deepEqual(JSON.parse(prison.rows[2][9]),[{id:gold.id,nom:'Or',quantite:9000}]);
assert.match(result.rows[0].saisies,/Or × 9\s000/);
assert.equal(prison.rows[1][9],'Deux épées\nUne bourse');
assert.equal(held,false);
const catalogue = sheets.get('Objets');
const goldRow = catalogue.rows.find(row => row[0] === gold.id);
goldRow[1] = 'Septims';
assert.equal(search('000000F').objets.find(o => o.id === gold.id).nom,'Septims','Édition Sheets visible sans cache périmé');
assert.match(context.getPrison('GARDE').rows[0].saisies,/Or ×/,'Nom historique conservé');
catalogue.rows.push([...goldRow]);
assert.throws(() => search('epee'),/ID unique/);
catalogue.rows.pop();
catalogue.rows[0][0]='Mauvais en-tête';
assert.throws(() => search('epee'), /colonnes/);
assert.equal(catalogue.rows[0][0],'Mauvais en-tête','Aucune correction destructive automatique');
console.log('Prison / Objets : permissions, import, recherche réelle, validation, historique et rollback OK.');
