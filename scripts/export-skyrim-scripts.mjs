// Lecture seule des plugins : dump des scripts Papyrus attachés (VMAD) et de leurs
// propriétés. Aucun contact avec le serveur. Voir docs/scripts-papyrus/README.md.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { subrecords } from './export-skyrim-objects.mjs';

const check = (ok, message) => { if (!ok) throw new Error(message); };
const hex = n => (n >>> 0).toString(16).toUpperCase().padStart(6, '0');
const normalize = s => s.replaceAll('/', '\\').toLowerCase();
function text(b) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch { return new TextDecoder('windows-1252').decode(b); }
}
// Les chaînes VMAD sont préfixées par leur longueur et ne sont pas terminées par un
// zéro, contrairement aux sous-enregistrements classiques.
const decode = b => { const end = b.indexOf(0); return text(end < 0 ? b : b.subarray(0, end)); };

const types = { 1: 'objet', 2: 'texte', 3: 'entier', 4: 'flottant', 5: 'booléen',
  11: 'objets[]', 12: 'textes[]', 13: 'entiers[]', 14: 'flottants[]', 15: 'booléens[]' };

// VMAD : en-tête (version, format d'objet) puis la liste des scripts attachés et de
// leurs propriétés. Les fragments de QUST/INFO/PACK qui suivent ne sont pas lus.
export function readVmad(b, resolve = id => hex(id)) {
  let p = 0;
  const need = n => check(p + n <= b.length, 'VMAD tronqué');
  const u8 = () => { need(1); return b[p++]; };
  const u16 = () => { need(2); const v = b.readUInt16LE(p); p += 2; return v; };
  const i16 = () => { need(2); const v = b.readInt16LE(p); p += 2; return v; };
  const i32 = () => { need(4); const v = b.readInt32LE(p); p += 4; return v; };
  const u32 = () => { need(4); const v = b.readUInt32LE(p); p += 4; return v; };
  const f32 = () => { need(4); const v = b.readFloatLE(p); p += 4; return v; };
  const wstring = () => { const n = u16(); need(n); const s = text(b.subarray(p, p + n)); p += n; return s; };
  const version = i16(), objFormat = i16();
  check(version >= 2 && version <= 5, `Version VMAD non prise en charge : ${version}`);
  check(objFormat === 1 || objFormat === 2, `Format d'objet VMAD inconnu : ${objFormat}`);
  const object = () => {
    let formId, alias;
    // Format 1 : inutilisé, alias, FormID. Format 2 : FormID, alias, inutilisé.
    if (objFormat === 1) { u16(); alias = i16(); formId = u32(); }
    else { formId = u32(); alias = i16(); u16(); }
    if (!formId) return alias >= 0 ? `alias ${alias}` : '';
    return alias >= 0 ? `${resolve(formId)} (alias ${alias})` : resolve(formId);
  };
  const value = type => {
    if (type === 1) return object();
    if (type === 2) return wstring();
    if (type === 3) return i32();
    if (type === 4) return f32();
    if (type === 5) return u8() ? 'vrai' : 'faux';
    check(types[type], `Type de propriété VMAD inconnu : ${type}`);
    const count = u32(), items = [];
    check(count <= b.length, 'Longueur de tableau VMAD invalide');
    for (let i = 0; i < count; i++) items.push(value(type - 10));
    return items;
  };
  const scripts = [];
  const scriptCount = u16();
  for (let i = 0; i < scriptCount; i++) {
    const name = wstring(), status = version >= 4 ? u8() : 0, properties = [], count = u16();
    for (let j = 0; j < count; j++) {
      const propertyName = wstring(), type = u8(), propertyStatus = version >= 4 ? u8() : 0;
      properties.push({ nom: propertyName, type, kind: types[type] ?? `type ${type}`,
        statut: propertyStatus, valeur: value(type) });
    }
    scripts.push({ nom: name, statut: status, proprietes: properties });
  }
  return { version, objFormat, scripts, reste: b.length - p };
}

function walk(b, start, end, onRecord, resolve, cell = '') {
  for (let p = start; p < end;) {
    check(p + 24 <= end, 'En-tête tronqué');
    const sig = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (sig === 'GRUP') {
      check(size >= 24 && p + size <= end, 'Groupe invalide');
      const type = b.readInt32LE(p + 12);
      walk(b, p + 24, p + size, onRecord, resolve, [6, 8, 9, 10].includes(type) ? resolve(b.readUInt32LE(p + 8)) : cell);
      p += size;
      continue;
    }
    check(p + 24 + size <= end, `Enregistrement tronqué : ${sig}`);
    const flags = b.readUInt32LE(p + 8), formId = b.readUInt32LE(p + 12);
    let payload = b.subarray(p + 24, p + 24 + size);
    if (flags & 0x40000) {
      const expected = payload.readUInt32LE(0);
      payload = zlib.inflateSync(payload.subarray(4));
      check(payload.length === expected, 'Taille décompressée incorrecte');
    }
    onRecord({ sig, flags, formId, fields: new Map(subrecords(payload)), cell });
    p += 24 + size;
  }
}

function parseFormId(entry) {
  const s = entry.trim();
  check(s, 'FormID vide');
  const value = /^0x/i.test(s) ? Number.parseInt(s.slice(2), 16)
    : /^\d+$/.test(s) ? Number.parseInt(s, 10) : Number.parseInt(s, 16);
  check(Number.isInteger(value) && value >= 0 && value <= 0xffffffff, `FormID illisible : ${entry}`);
  return value >>> 0;
}

function csv(rows, columns) {
  const cell = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return '﻿' + [columns, ...rows.map(r => columns.map(k => r[k]))].map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export function main(dataDir, orderFile, outputDir, formids = '') {
  check(dataDir && orderFile && outputDir, 'Usage: node scripts/export-skyrim-scripts.mjs <Data> <loadorder.txt> <sortie> [formids]');
  const source = fs.realpathSync(path.resolve(dataDir)), destination = path.resolve(outputDir);
  const relative = path.relative(source, destination);
  check(path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep), 'La sortie doit être extérieure au dossier Data');
  const order = fs.readFileSync(orderFile, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
    .map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  check(new Set(order.map(normalize)).size === order.length, 'Plugins dupliqués');
  const known = new Map(order.map(n => [normalize(n), n]));
  const labels = new Map(), winners = new Map(), plugins = [], seen = new Set();
  for (const plugin of order) {
    check(path.basename(plugin) === plugin, 'Nom de plugin invalide');
    const b = fs.readFileSync(path.join(dataDir, plugin));
    let mapping = [plugin], count = 0, attached = 0, light = false;
    const resolve = value => {
      if (!value) return '';
      const owner = known.get(normalize(mapping[value >>> 24] ?? ''));
      // Index non couvert par la load order : plugin absent. On le signale dans
      // l'identifiant au lieu d'interrompre l'export.
      if (!owner) return `index ${value >>> 24}|${hex(value & 0xffffff)}`;
      return `${owner.toLowerCase()}|${hex(value & 0xffffff)}`;
    };
    walk(b, 0, b.length, record => {
      if (record.sig === 'TES4') {
        const masters = [...record.fields].filter(([s]) => s === 'MAST').map(([, v]) => decode(v));
        for (const m of masters) check(seen.has(normalize(m)), `Master absent ou chargé après ${plugin} : ${m}`);
        mapping = [...masters, plugin];
        light = Boolean(record.flags & 512);
        return;
      }
      count++;
      const id = resolve(record.formId);
      const editor = record.fields.has('EDID') ? decode(record.fields.get('EDID')) : '';
      if (editor) labels.set(id, editor);
      const vmad = record.fields.get('VMAD');
      if (!vmad) {
        // Surcharge sans VMAD : le plugin gagnant retire les scripts du précédent.
        if (winners.has(id)) winners.set(id, { ...winners.get(id), plugin_final: plugin, scripts: [], retire: 'oui' });
        return;
      }
      attached++;
      winners.set(id, { id, type: record.sig, editor_id: editor, cellule_id: record.cell,
        plugin_final: plugin,
        plugin_origine: known.get(normalize(mapping[record.formId >>> 24] ?? '')) ?? '',
        supprime: Boolean(record.flags & 32), retire: '', ...readVmad(vmad, resolve) });
    }, resolve);
    seen.add(normalize(plugin));
    plugins.push({ plugin, masters: mapping.slice(0, -1), light, enregistrements: count, vmad: attached,
      sha256: crypto.createHash('sha256').update(b).digest('hex') });
    console.log(`${plugin} : ${count} enregistrements, ${attached} portant un VMAD`);
  }
  const label = id => labels.get(id) || id;
  // Les valeurs d'objets sont rendues « plugin|000000 » : on y accroche l'editor id.
  // Le remplacement se fait par élément : un nom de plugin peut contenir des espaces.
  const readable = v => String(v).replace(/^[^|]+\|[0-9A-F]{6}/, id => labels.has(id) ? `${labels.get(id)} [${id}]` : id);
  const list = v => (Array.isArray(v) ? v : [v]);
  const flat = v => list(v).join(' ; ');
  const flatReadable = v => list(v).map(readable).join(' ; ');
  const kzl = s => /^(keizaal|kzl)/i.test(s ?? '');
  const records = [...winners.values()].filter(r => r.scripts.length && !r.supprime)
    .sort((a, b) => a.id.localeCompare(b.id));
  const concerned = r => (kzl(r.plugin_origine) || kzl(r.plugin_final) ? 'oui' : 'non');
  const attachments = records.flatMap(r => r.scripts.map(s => ({
    id: r.id, type: r.type, editor_id: r.editor_id, script: s.nom,
    statut: s.statut, proprietes: s.proprietes.length,
    cellule: label(r.cellule_id), cellule_id: r.cellule_id,
    plugin_origine: r.plugin_origine, plugin_final: r.plugin_final,
    concerne_keizaal: concerned(r) })));
  const properties = records.flatMap(r => r.scripts.flatMap(s => s.proprietes.map(prop => ({
    id: r.id, editor_id: r.editor_id, script: s.nom, propriete: prop.nom,
    type: prop.kind, statut: prop.statut, valeur: flat(prop.valeur),
    valeur_lisible: flatReadable(prop.valeur), plugin_final: r.plugin_final,
    concerne_keizaal: concerned(r) }))));
  const index = new Map();
  for (const a of attachments) {
    const row = index.get(a.script)
      ?? { script: a.script, attachements: 0, types: new Set(), plugins: new Set(), proprietes: new Set() };
    row.attachements++; row.types.add(a.type); row.plugins.add(a.plugin_final);
    index.set(a.script, row);
  }
  for (const p of properties) index.get(p.script)?.proprietes.add(p.propriete);
  const scripts = [...index.values()]
    .map(r => ({ script: r.script, attachements: r.attachements, types: [...r.types].sort().join(' '),
      plugins: [...r.plugins].sort().join(' ; '), proprietes: [...r.proprietes].sort().join(' ; ') }))
    .sort((a, b) => b.attachements - a.attachements || a.script.localeCompare(b.script));
  const removed = [...winners.values()].filter(r => r.retire === 'oui')
    .map(r => ({ id: r.id, editor_id: r.editor_id, type: r.type, plugin_final: r.plugin_final }));
  fs.mkdirSync(outputDir, { recursive: true });
  const attachmentColumns = ['id', 'type', 'editor_id', 'script', 'statut', 'proprietes', 'cellule', 'cellule_id', 'plugin_origine', 'plugin_final', 'concerne_keizaal'];
  const propertyColumns = ['id', 'editor_id', 'script', 'propriete', 'type', 'statut', 'valeur', 'valeur_lisible', 'plugin_final', 'concerne_keizaal'];
  fs.writeFileSync(path.join(outputDir, 'index-scripts.csv'), csv(scripts, ['script', 'attachements', 'types', 'plugins', 'proprietes']));
  fs.writeFileSync(path.join(outputDir, 'scripts-attaches.csv'), csv(attachments, attachmentColumns));
  fs.writeFileSync(path.join(outputDir, 'scripts-keizaal.csv'), csv(attachments.filter(r => r.concerne_keizaal === 'oui'), attachmentColumns));
  fs.writeFileSync(path.join(outputDir, 'proprietes-scripts.csv'), csv(properties, propertyColumns));
  fs.writeFileSync(path.join(outputDir, 'scripts-retires.csv'), csv(removed, ['id', 'editor_id', 'type', 'plugin_final']));
  let lookup = [];
  if (formids) {
    // Indices tels que le jeu les attribue : un plugin léger ne consomme pas de slot
    // normal et s'adresse FE xxx yyy. C'est la forme qui apparaît dans les traces.
    const heavy = plugins.filter(p => !p.light).map(p => p.plugin);
    const lights = plugins.filter(p => p.light).map(p => p.plugin);
    lookup = formids.split(/[,\s]+/).filter(Boolean).map(entry => {
      const value = parseFormId(entry), esl = (value >>> 24) === 0xfe;
      const slot = esl ? (value >>> 12) & 0xfff : value >>> 24;
      const plugin = (esl ? lights[slot] : heavy[slot]) ?? '';
      const local = hex(esl ? value & 0xfff : value & 0xffffff);
      const id = plugin ? `${plugin.toLowerCase()}|${local}` : '';
      return { entree: entry, decimal: value, hexadecimal: '0x' + value.toString(16).toUpperCase(),
        index_plugin: esl ? `FE ${slot.toString(16).toUpperCase().padStart(3, '0')}` : slot,
        plugin, id_local: local, id, libelle: id ? label(id) : '',
        scripts: id ? attachments.filter(a => a.id === id).map(a => a.script).join(' ; ') : '',
        remarque: plugin ? '' : 'Index absent de la load order fournie' };
    });
    fs.writeFileSync(path.join(outputDir, 'recherche-formids.csv'), csv(lookup, ['entree', 'decimal', 'hexadecimal', 'index_plugin', 'plugin', 'id_local', 'id', 'libelle', 'scripts', 'remarque']));
  }
  const report = { date: new Date().toISOString(), order, plugins,
    enregistrements_scriptes: records.length, attachements: attachments.length,
    proprietes: properties.length, scripts_distincts: scripts.length,
    scripts_retires: removed.length, recherche: lookup, top_scripts: scripts.slice(0, 20) };
  fs.writeFileSync(path.join(outputDir, 'rapport-scripts.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ enregistrements_scriptes: report.enregistrements_scriptes,
    attachements: report.attachements, scripts_distincts: report.scripts_distincts,
    scripts_retires: report.scripts_retires }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(...process.argv.slice(2));
