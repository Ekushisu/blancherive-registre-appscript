import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sheets = new Map();
let failFlush = false, locked = false, reads = 0;
class Sheet {
  constructor(rows) { this.rows = rows; this.validations = new Map(); }
  getLastRow() { return this.rows.length; }
  getRange(r,c,h=1,w=1) {
    const sheet=this, key=`${r}:${c}`;
    const range={
      getValues() { reads++; return Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>sheet.rows[r+i-1]?.[c+j-1]??'')); },
      getDisplayValues() { return this.getValues().map(row=>row.map(String)); },
      setValues(values) {
        values.forEach((row,i)=>row.forEach((value,j)=>{
          const rule=sheet.validations.get(`${r+i}:${c+j}`);
          if(rule&&value!==''&&!rule.includes(value)) throw Error('Validation Sheets');
          (sheet.rows[r+i-1]||=[])[c+j-1]=value;
        })); return range;
      },
      getDataValidation() {return sheet.validations.get(key)||null;},
      setDataValidation(rule) {sheet.validations.set(key,rule);return range;},
      clearDataValidations() {sheet.validations.delete(key);return range;},
      insertCheckboxes() {return range;}, setNumberFormat() {return range;}
    };return range;
  }
}
const ctx=vm.createContext({console,Date,SPREADSHEET_ID:'test',
  requireRole(token,roles){if(!roles.includes(token))throw Error('Accès refusé');},
  SpreadsheetApp:{openById(){return {getSheetByName:name=>sheets.get(name)};},flush(){if(failFlush){failFlush=false;throw Error('Échec flush');}}},
  LockService:{getScriptLock:()=>({waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}})}
});
for(const file of ['SyncCodex.js','Amendes.js','Prison.js']) vm.runInContext(fs.readFileSync(`src/${file}`,'utf8'),ctx);
const plain=value=>JSON.parse(JSON.stringify(value));
const build=(text,type='amende')=>plain(ctx.construireChoixSanctionCodex_(text,type));
const fine=build('Sanction — 100 septims à la première infraction ; 200 septims en cas de récidive.');
assert.deepEqual(fine.options.map(o=>o.value),[100,200]);
assert.match(fine.options[1].label,/récidive/);
assert.equal(fine.libre,false);
assert.deepEqual(build('Sanction — 100 septims lorsque le dommage ne dépasse pas 500 septims.').options.map(o=>o.value),[100]);
assert.equal(build('Un permis est obligatoire, délivré pour 50 septims.').options.length,0);
assert.deepEqual(build('outrage à la Garde — 100 septims. [Contravention]\noutrage à la Cour — 500 septims. [Délit]').options.map(o=>o.value),[100,500]);
const jail=build('Sanction — 3 heures de travaux forcés et 30 minutes de cachot ; 2 heures de cachot en récidive.','cachot');
assert.deepEqual(jail.options.map(o=>o.value),[0.5,2]);
assert.equal(ctx.analyserSanctionCodex_('3 heures de travaux forcés et 1 heure de cachot').cachot,1);
assert.equal(build('Sanction — peine maximale encourue : mort et saisie des biens.').libre,false);
assert.equal(build('Sanction — à l’appréciation du magistrat.').libre,true);
assert.equal(build('Sanction — à l’appréciation du magistrat.','cachot').libre,true);
// Les choix chiffrés ne contraignent plus les formulaires (chefs d'accusation et
// sentence libre depuis le 29 septembre 2026) ; ils alimentent encore les
// suggestions du Codex et le cache L:O, régénéré une version de plus.
let cache;
const cacheSheet={getLastRow:()=>2,setColumnWidth(){},getRange(r,c){
  const range={clearContent(){return range;},clearDataValidations(){return range;},setFontWeight(){return range;},
    setValues(rows){if(r===2&&c===12)cache=rows;return range;}};return range;
}};
ctx.ecrireCachesTechniquesCodex_(cacheSheet,[
  // Une source marquée `sanctions` du registre courant ; le Codex Judiciaire est caduc.
  {source:'Code pénal local de Blancherive',article:'105',titre:'Vente',sanction:fine.texte},
  {source:'Code pénal local de Blancherive',article:'34',titre:'Intrusion',sanction:jail.texte},
  {source:'Code pénal local de Blancherive',article:'70',titre:'Espionnage',sanction:'Sanction — peine maximale encourue : mort et saisie des biens.'},
  {source:'Texte impérial',article:'1',titre:'Autre',sanction:'Sanction — 900 septims.'}
]);
assert.equal(cache.length,1);
assert.deepEqual(JSON.parse(cache[0][1]).options.map(o=>o.value),[100,200]);
assert.deepEqual(JSON.parse(cache[0][3]).options.map(o=>o.value),[0.5,2]);
console.log('Sanctions : analyse des montants et durées, contexte des choix et cache L:O OK.');
