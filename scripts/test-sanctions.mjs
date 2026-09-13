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
ctx.preparerSaisiesPrison_=()=> '[]';
ctx.getAmendes=()=>true;ctx.getPrison=()=>true;
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
assert.equal(ctx.validerChoixSanction_(JSON.stringify(fine),'200','amende'),200);
for(const value of [undefined,'',150,-1,0,Infinity,{},true,' ',1.5]) {
  assert.throws(()=>ctx.validerChoixSanction_(JSON.stringify(fine),value,'amende'));
}
assert.equal(ctx.validerChoixSanction_(100,undefined,'amende'),100);
assert.equal(ctx.validerChoixSanction_('',undefined,'amende'),'');
assert.throws(()=>ctx.validerChoixSanction_('',10,'amende'));
assert.throws(()=>ctx.lireChoixSanction_('{broken'));
assert.throws(()=>ctx.validerChoixSanction_(build('Sanction — à l’appréciation du magistrat.'),1.5,'amende'));

const syncRows=[Array(15).fill(''),[...Array(11).fill(''),'Art. 105',JSON.stringify(fine),'Art. 34',JSON.stringify(jail)]];
sheets.set('SyncCodex',new Sheet(syncRows));
sheets.set('Données',new Sheet([[],[...Array(14).fill(''),'Rorik ']]));
const fines=new Sheet([Array(7).fill('En-tête')]),prison=new Sheet([Array(11).fill('En-tête')]);
sheets.set('Amendes',fines);sheets.set('Prison',prison);
const base={date:'2026-09-09',garde:'Rorik',contrevenant:'Test',detenu:'Test',entree:'2026-09-09T10:00',saisies:[]};
assert.throws(()=>ctx.ajouterAmende('intrus',base),/Accès/);
assert.throws(()=>ctx.ajouterPrison('intrus',base),/Accès/);
assert.equal(reads,0);
assert.equal(ctx.getAmendeFormData('GARDE').infractions[0].sanction.options.length,2);
assert.equal(ctx.getPrisonFormData('GARDE').infractions[0].sanction.options[0].value,0.5);
ctx.ajouterAmende('GARDE',{...base,infraction:'Art. 105',montant:'200'});
assert.equal(fines.rows[1][4],200);
assert.equal(fines.rows[1][1],'Rorik ','Valeur brute de validation conservée');
ctx.ajouterPrison('GARDE',{...base,infraction:'Art. 34',duree:'0.5'});
assert.equal(prison.rows[1][5],0.5);
assert.equal(prison.rows[1][7]-prison.rows[1][6],30*60*1000);
assert.throws(()=>ctx.ajouterAmende('GARDE',{...base,infraction:'Art. 105',montant:999}),/plus proposée/);
assert.throws(()=>ctx.ajouterPrison('GARDE',{...base,infraction:'Art. 34',duree:3}),/plus proposée/);
assert.equal(locked,false);
assert.equal(fines.rows.length,2);
assert.equal(prison.rows.length,2);

fines.validations.set('3:4',['Art. 105']);
prison.validations.set('3:5',['Art. 34']);
ctx.ajouterAmende('GARDE',{...base,personnalisee:true,infraction:'Décret du Jarl',montant:350});
ctx.ajouterPrison('GARDE',{...base,personnalisee:true,infraction:'Décision de la Cour',duree:1.25});
assert.equal(fines.rows[2][3],'Motif personnalisé — Décret du Jarl');
assert.equal(fines.rows[2][4],350);
assert.equal(prison.rows[2][4],'Motif personnalisé — Décision de la Cour');
assert.equal(prison.rows[2][7]-prison.rows[2][6],75*60*1000);
assert.equal(fines.validations.has('3:4'),false);
assert.throws(()=>ctx.ajouterAmende('GARDE',{...base,personnalisee:true,infraction:' ',montant:100}),/motif/);
assert.throws(()=>ctx.ajouterPrison('GARDE',{...base,personnalisee:true,infraction:'Décret',duree:''}),/Choisissez/);
fines.validations.set('4:4',['Art. 105']);
failFlush=true;
assert.throws(()=>ctx.ajouterAmende('GARDE',{...base,personnalisee:true,infraction:'Décret',montant:100}),/flush/);
assert.ok(fines.rows[3].every(value=>value===''));
assert.deepEqual(fines.validations.get('4:4'),['Art. 105']);
assert.equal(fines.rows[1][4],200,'Sanction historique inchangée');
prison.validations.set('4:5',['Art. 34']);
failFlush=true;
assert.throws(()=>ctx.ajouterPrison('GARDE',{...base,personnalisee:true,infraction:'Décret',duree:1}),/flush/);
assert.ok(prison.rows[3].every(value=>value===''));
assert.deepEqual(prison.validations.get('4:5'),['Art. 34']);
assert.equal(locked,false);

let cache;
const cacheSheet={getLastRow:()=>2,setColumnWidth(){},getRange(r,c){
  const range={clearContent(){return range;},clearDataValidations(){return range;},setFontWeight(){return range;},
    setValues(rows){if(r===2&&c===12)cache=rows;return range;}};return range;
}};
ctx.ecrireCachesTechniquesCodex_(cacheSheet,[
  {source:'Codex Judiciaire de Blancherive',article:'105',titre:'Vente',sanction:fine.texte},
  {source:'Codex Judiciaire de Blancherive',article:'34',titre:'Intrusion',sanction:jail.texte},
  {source:'Codex Judiciaire de Blancherive',article:'70',titre:'Espionnage',sanction:'Sanction — peine maximale encourue : mort et saisie des biens.'},
  {source:'Texte impérial',article:'1',titre:'Autre',sanction:'Sanction — 900 septims.'}
]);
assert.equal(cache.length,1);
assert.deepEqual(JSON.parse(cache[0][1]).options.map(o=>o.value),[100,200]);
assert.deepEqual(JSON.parse(cache[0][3]).options.map(o=>o.value),[0.5,2]);
console.log('Sanctions : choix, contexte, permissions, saisie libre, motifs, validation Sheets, sortie et rollback OK.');
