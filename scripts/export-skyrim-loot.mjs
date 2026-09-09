// Lecture seule des plugins ; export exploratoire, sans simulation du serveur.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { subrecords, archiveStrings, stringTable } from './export-skyrim-objects.mjs';

const [dataDir, orderFile, outputDir] = process.argv.slice(2);
assert(dataDir && orderFile && outputDir, 'Arguments : Data loadorder.txt sortie');
const relative = path.relative(fs.realpathSync(dataDir), path.resolve(outputDir));
assert(path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep), 'Sortie interdite dans Data');
const decode = b => {
  b = b.subarray(0, b.indexOf(0) < 0 ? b.length : b.indexOf(0));
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch { return new TextDecoder('windows-1252').decode(b); }
};
const order = fs.readFileSync(orderFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
const wanted = new Set('TES4 CELL LCTN WRLD REFR ACHR CONT LVLI LVLN NPC_ WEAP ARMO AMMO ALCH INGR MISC BOOK KEYM SLGM SCRL LIGH FLOR TREE'.split(' '));
const tables = new Map();
for (const name of fs.readdirSync(dataDir).filter(n => /\.bsa$/i.test(n)).sort()) {
  for (const [key, value] of archiveStrings(path.join(dataDir, name))) {
    if (/_french\.strings$|_english\.strings$/.test(key)) tables.set(key, stringTable(value));
  }
}
const loose = path.join(dataDir, 'Strings');
if (fs.existsSync(loose)) for (const n of fs.readdirSync(loose).filter(n => /\.strings$/i.test(n))) tables.set(('strings\\' + n).toLowerCase(), stringTable(fs.readFileSync(path.join(loose,n))));
const winners = new Map(), seen = new Set(), counts = [];
for (const plugin of order) {
  assert.equal(path.basename(plugin), plugin);
  const b = fs.readFileSync(path.join(dataDir, plugin));
  let mapping, localized, table;
  const countsHere = {};
  const resolve = value => {
    if (!value) return '';
    const owner = mapping[value >>> 24];
    assert(owner, `FormID non résolu ${plugin} ${value.toString(16)}`);
    return owner.toLowerCase() + '|' + (value & 0xffffff).toString(16).toUpperCase().padStart(6,'0');
  };
  function walk(start, end, cell = '') {
    for (let p = start; p < end;) {
      assert(p + 24 <= end);
      const sig = b.toString('ascii',p,p+4), size = b.readUInt32LE(p+4);
      if (sig === 'GRUP') {
        assert(size >= 24 && p + size <= end);
        const type = b.readInt32LE(p+12);
        walk(p+24,p+size,[6,8,9,10].includes(type) ? resolve(b.readUInt32LE(p+8)) : cell);
        p += size; continue;
      }
      assert(p+24+size <= end);
      if (wanted.has(sig)) {
        const flags = b.readUInt32LE(p+8);
        let payload = b.subarray(p+24,p+24+size);
        if (flags & 0x40000) { const expected = payload.readUInt32LE(0); payload = zlib.inflateSync(payload.subarray(4)); assert.equal(payload.length,expected); }
        const fields = subrecords(payload), f = new Map(fields);
        if (sig === 'TES4') {
          const masters = fields.filter(([s])=>s==='MAST').map(([,v])=>decode(v));
          for (const m of masters) assert(seen.has(m.toLowerCase()), `Master absent : ${m}`);
          mapping = [...masters,plugin]; localized = Boolean(flags & 128);
          const stem = plugin.replace(/\.(esp|esm|esl)$/i,'').toLowerCase();
          table = tables.get(`strings\\${stem}_french.strings`) ?? tables.get(`strings\\${stem}_english.strings`);
        } else {
          const id = resolve(b.readUInt32LE(p+12)), full = f.get('FULL');
          const ref = key => f.get(key)?.length >= 4 ? resolve(f.get(key).readUInt32LE(0)) : '';
          const entries = fields.filter(([s]) => s==='CNTO' || s==='LVLO').map(([s,v])=> {
            assert(v.length >= (s==='CNTO'?8:12));
            return { cible:resolve(v.readUInt32LE(s==='CNTO'?0:4)), quantite:s==='CNTO'?v.readInt32LE(4):v.readUInt16LE(8), niveau:s==='LVLO'?v.readUInt16LE(0):'' };
          });
          const xyz = f.get('DATA');
          const r = { id, type:sig, plugin, nom:full ? (localized ? table?.get(full.readUInt32LE(0)) ?? '' : decode(full)) : '', editor_id:f.has('EDID')?decode(f.get('EDID')):'', flags, cellule:cell, base:ref('NAME'), lieu:ref('XLCN'), recolte:['FLOR','TREE'].includes(sig)?ref('PFIG'):'', entries, chance_vide:f.get('LVLD')?.[0] ?? '', flags_liste:f.get('LVLF')?.[0] ?? '', globale_chance:ref('LVLG'), script:f.has('VMAD'), activation_conditionnelle:f.has('XESP'), x:['REFR','ACHR'].includes(sig)&&xyz?.length===24?xyz.readFloatLE(0):'', y:['REFR','ACHR'].includes(sig)&&xyz?.length===24?xyz.readFloatLE(4):'', z:['REFR','ACHR'].includes(sig)&&xyz?.length===24?xyz.readFloatLE(8):'' };
          winners.set(id,r); countsHere[sig]=(countsHere[sig]??0)+1;
        }
      }
      p += 24+size;
    }
  }
  walk(0,b.length); seen.add(plugin.toLowerCase()); counts.push({plugin,...countsHere});
  console.log(plugin, JSON.stringify(countsHere));
}
const all = [...winners.values()].filter(r=>!(r.flags&32));
const label = id => { const r=winners.get(id); return r?.nom || r?.editor_id || id; };
const kzl = s => /^(keizaal|kzl)/i.test(s);
const touched = r => kzl(r.plugin) || kzl(r.id);
const lists = all.filter(r=>['LVLI','LVLN','CONT','NPC_'].includes(r.type));
function affected(id, visited = new Set()) {
  if (!id || visited.has(id)) return false;
  visited.add(id); const r=winners.get(id);
  return !!r && (touched(r)||r.entries.some(e=>affected(e.cible,visited)));
}
const placements = all.filter(r=>['REFR','ACHR'].includes(r.type)).filter(r=> {
  const base=winners.get(r.base); return base && (base.entries.length || ['WEAP','ARMO','AMMO','ALCH','INGR','MISC','BOOK','KEYM','SLGM','SCRL','FLOR','TREE'].includes(base.type));
}).map(r=> {
  const cell=winners.get(r.cellule), base=winners.get(r.base);
  return { lieu:label(cell?.lieu)||label(r.cellule), cellule:label(r.cellule), cellule_id:r.cellule, reference:r.id, objet:label(r.base), base_id:r.base, type:base.type, plugin_placement:r.plugin, plugin_objet:base.plugin, concerne_keizaal:touched(r)||!!cell&&touched(cell)||affected(r.base), desactive_initialement:!!(r.flags&0x800), activation_conditionnelle:r.activation_conditionnelle, script:r.script||base.script, x:r.x,y:r.y,z:r.z };
});
const edges=lists.flatMap(r=>r.entries.map((e,index)=>({source:label(r.id),source_id:r.id,type:r.type,plugin:r.plugin,entree:index+1,cible:label(e.cible),cible_id:e.cible,type_cible:winners.get(e.cible)?.type??'',quantite:e.quantite,niveau:e.niveau,chance_vide:r.chance_vide,flags_liste:r.flags_liste,globale_chance:r.globale_chance,concerne_keizaal:affected(r.id)})));
fs.mkdirSync(outputDir,{recursive:true});
function csv(name,rows) { const columns=Object.keys(rows[0]??{}); const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"'; fs.writeFileSync(path.join(outputDir,name),'\uFEFF'+[columns,...rows.map(r=>columns.map(c=>r[c]))].map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n'); }
csv('lieux-loot.csv',placements); csv('lieux-loot-keizaal.csv',placements.filter(r=>r.concerne_keizaal));
csv('tables-loot.csv',edges); csv('tables-loot-keizaal.csv',edges.filter(r=>r.concerne_keizaal));
csv('coffres-keizaal.csv', placements.filter(r=>r.concerne_keizaal && r.type==='CONT').map(r=>({...r,contenu_direct:winners.get(r.base_id).entries.map(e=>`${label(e.cible)} × ${e.quantite} [${e.cible}]`).join(' ; ')})));
csv('lieux-modifies-keizaal.csv',all.filter(r=>['CELL','LCTN'].includes(r.type)&&touched(r)).map(r=>({id:r.id,type:r.type,nom:r.nom,editor_id:r.editor_id,plugin:r.plugin})));
fs.writeFileSync(path.join(outputDir,'donnees-loot.json'),JSON.stringify(all.filter(r=>!['REFR','ACHR'].includes(r.type)),null,2));
const report={date:new Date().toISOString(),order,counts,placements:placements.length,placementsKeizaal:placements.filter(r=>r.concerne_keizaal).length,entrees:edges.length,entreesKeizaal:edges.filter(r=>r.concerne_keizaal).length};
fs.writeFileSync(path.join(outputDir,'rapport.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report));
