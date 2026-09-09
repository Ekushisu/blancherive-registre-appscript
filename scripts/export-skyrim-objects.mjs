// Extraction locale en lecture seule. Voir docs/catalogue-objets/README.md.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const categories = { WEAP: 'Arme', ARMO: 'Armure / vêtement', AMMO: 'Munition',
  ALCH: 'Potion / nourriture', INGR: 'Ingrédient', MISC: 'Objet divers',
  BOOK: 'Livre / sort', KEYM: 'Clé', SLGM: 'Gemme spirituelle', SCRL: 'Parchemin',
  LIGH: 'Lumière / torche' };
const check = (ok, message) => { if (!ok) throw new Error(message); };
const hex = n => n.toString(16).toUpperCase().padStart(6, '0');
const normalize = s => s.replaceAll('/', '\\').toLowerCase();
function decode(b) {
  const end = b.indexOf(0);
  b = end < 0 ? b : b.subarray(0, end);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); }
  catch { return new TextDecoder('windows-1252').decode(b); }
}

export function subrecords(b) {
  const result = [];
  let p = 0, extended;
  while (p < b.length) {
    check(p + 6 <= b.length, 'Sous-enregistrement tronqué');
    const sig = b.toString('ascii', p, p + 4);
    const length = extended ?? b.readUInt16LE(p + 4);
    extended = undefined;
    p += 6;
    check(p + length <= b.length, `Taille invalide : ${sig}`);
    if (sig === 'XXXX') {
      check(length === 4, 'XXXX invalide');
      extended = b.readUInt32LE(p);
    } else result.push([sig, b.subarray(p, p + length)]);
    p += length;
  }
  check(extended === undefined, 'XXXX sans sous-enregistrement');
  return result;
}

export function* records(b, start = 0, end = b.length) {
  let p = start;
  while (p < end) {
    check(p + 24 <= end, 'En-tête tronqué');
    const sig = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (sig === 'GRUP') {
      check(size >= 24 && p + size <= end, 'Groupe invalide');
      // Les objets de base sont dans les groupes racine portant leur signature.
      const label = b.toString('ascii', p + 8, p + 12);
      if (categories[label]) yield* records(b, p + 24, p + size);
      p += size;
      continue;
    }
    check(p + 24 + size <= end, `Enregistrement tronqué : ${sig}`);
    if (sig === 'TES4' || categories[sig]) {
      const flags = b.readUInt32LE(p + 8), formId = b.readUInt32LE(p + 12);
      let data = b.subarray(p + 24, p + 24 + size);
      if (flags & 0x40000) {
        const expected = data.readUInt32LE(0);
        data = zlib.inflateSync(data.subarray(4));
        check(data.length === expected, 'Taille décompressée incorrecte');
      }
      yield { sig, flags, formId, fields: subrecords(data) };
    }
    p += 24 + size;
  }
}

// Lecture de frames LZ4 BSA v105 ; contrôle des limites et de la taille finale.
// Les checksums optionnels sont parcourus mais non vérifiés.
export function lz4Frame(b, expected) {
  check(b.readUInt32LE(0) === 0x184d2204, 'Frame LZ4 inconnue');
  const flags = b[4];
  check((flags >> 6) === 1 && !(flags & 1), 'Version/dictionnaire LZ4 non pris en charge');
  let p = 6;
  if (flags & 8) { check(Number(b.readBigUInt64LE(p)) === expected, 'Taille frame LZ4 incohérente'); p += 8; }
  p++; // Header checksum.
  const out = Buffer.alloc(expected);
  let o = 0;
  while (true) {
    const header = b.readUInt32LE(p); p += 4;
    if (!header) break;
    const size = header & 0x7fffffff, end = p + size, blockStart = o;
    check(end <= b.length, 'Bloc LZ4 tronqué');
    if (header & 0x80000000) {
      check(o + size <= expected, 'Bloc LZ4 trop grand');
      b.copy(out, o, p, end); o += size; p = end;
    } else {
      const length = base => {
        if (base !== 15) return base;
        let n = base, x;
        do { check(p < end, 'Longueur LZ4 tronquée'); x = b[p++]; n += x; } while (x === 255);
        return n;
      };
      while (p < end) {
        const token = b[p++], literals = length(token >> 4);
        check(p + literals <= end && o + literals <= expected, 'Littéraux LZ4 invalides');
        b.copy(out, o, p, p + literals); p += literals; o += literals;
        if (p === end) break;
        check(p + 2 <= end, 'Offset LZ4 tronqué');
        const offset = b.readUInt16LE(p); p += 2;
        const match = length(token & 15) + 4;
        check(offset > 0 && offset <= o - ((flags & 32) ? blockStart : 0) && o + match <= expected, 'Référence LZ4 invalide');
        for (let i = 0; i < match; i++) { out[o] = out[o - offset]; o++; }
      }
    }
    if (flags & 16) p += 4;
  }
  if (flags & 4) p += 4;
  check(o === expected && p === b.length, 'Taille finale LZ4 incorrecte');
  return out;
}

export function archiveStrings(filename) {
  const fd = fs.openSync(filename, 'r');
  const read = (p, size) => {
    const b = Buffer.alloc(size);
    check(fs.readSync(fd, b, 0, size, p) === size, `Archive tronquée : ${filename}`);
    return b;
  };
  try {
    const h = read(0, 36), version = h.readUInt32LE(4), flags = h.readUInt32LE(12);
    check(h.toString('ascii', 0, 4) === 'BSA\0' && [104, 105].includes(version), `BSA non pris en charge : ${filename}`);
    check((flags & 3) === 3, 'Archive sans noms');
    const folderCount = h.readUInt32LE(16), fileCount = h.readUInt32LE(20), folderSize = version === 105 ? 24 : 16;
    const folders = read(h.readUInt32LE(8), folderCount * folderSize);
    let p = h.readUInt32LE(8) + folders.length;
    const files = [];
    for (let i = 0; i < folderCount; i++) {
      const n = read(p++, 1)[0], folder = decode(read(p, n)); p += n;
      const count = folders.readUInt32LE(i * folderSize + 8), entries = read(p, count * 16); p += entries.length;
      for (let j = 0; j < count; j++) files.push({ folder, size: entries.readUInt32LE(j * 16 + 8), offset: entries.readUInt32LE(j * 16 + 12) });
    }
    check(files.length === fileCount, 'Nombre de fichiers BSA incohérent');
    const names = read(p, h.readUInt32LE(28));
    let q = 0;
    const tables = new Map();
    for (const f of files) {
      const end = names.indexOf(0, q); check(end >= q, 'Nom BSA tronqué');
      const name = normalize(`${f.folder}\\${decode(names.subarray(q, end))}`); q = end + 1;
      if (!name.endsWith('.strings')) continue;
      let b = read(f.offset, f.size & 0x3fffffff);
      if (flags & 0x100) b = b.subarray(1 + b[0]);
      if (Boolean(flags & 4) !== Boolean(f.size & 0x40000000)) {
        const expected = b.readUInt32LE(0);
        b = version === 105 ? lz4Frame(b.subarray(4), expected) : zlib.inflateSync(b.subarray(4));
        check(b.length === expected, 'Taille BSA incorrecte');
      }
      tables.set(name, b);
    }
    return tables;
  } finally { fs.closeSync(fd); }
}

export function stringTable(b) {
  const count = b.readUInt32LE(0), size = b.readUInt32LE(4), base = 8 + count * 8;
  check(base + size === b.length, 'Table STRINGS invalide');
  const result = new Map();
  for (let i = 0; i < count; i++) {
    const id = b.readUInt32LE(8 + i * 8), offset = b.readUInt32LE(12 + i * 8);
    check(offset < size && b.indexOf(0, base + offset) >= 0, 'Offset STRINGS invalide');
    result.set(id, decode(b.subarray(base + offset)));
  }
  return result;
}

function csv(rows, columns) {
  const cell = v => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  return '\uFEFF' + [columns, ...rows.map(r => columns.map(k => r[k]))].map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

export function main(dataDir, orderFile, outputDir) {
  check(dataDir && orderFile && outputDir, 'Usage: node scripts/export-skyrim-objects.mjs <Data> <loadorder.txt> <sortie>');
  const source = path.resolve(dataDir), destination = path.resolve(outputDir);
  const relative = path.relative(source, destination);
  check(path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep), 'La sortie doit être extérieure au dossier Data');
  const order = fs.readFileSync(orderFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  check(new Set(order.map(normalize)).size === order.length, 'Plugins dupliqués');
  const known = new Map(order.map(n => [normalize(n), n]));
  const tables = new Map(), tableSources = new Map(), duplicates = [];
  // Indexation de toutes les archives présentes : toute ambiguïté de traduction est signalée.
  for (const name of fs.readdirSync(dataDir).filter(n => /\.bsa$/i.test(n)).sort()) {
    for (const [key, b] of archiveStrings(path.join(dataDir, name))) {
      if (tables.has(key)) duplicates.push({ table: key, previous: tableSources.get(key), next: name });
      tables.set(key, stringTable(b)); tableSources.set(key, name);
    }
  }
  const loose = path.join(dataDir, 'Strings');
  if (fs.existsSync(loose)) for (const name of fs.readdirSync(loose).filter(n => /\.strings$/i.test(n))) {
    const key = normalize(`strings\\${name}`);
    tables.set(key, stringTable(fs.readFileSync(path.join(loose, name)))); tableSources.set(key, `Strings/${name}`);
  }
  const winners = new Map(), plugins = [], seen = new Set();
  for (const plugin of order) {
    check(path.basename(plugin) === plugin, 'Nom de plugin invalide');
    const b = fs.readFileSync(path.join(dataDir, plugin));
    const all = records(b), header = all.next().value;
    check(header?.sig === 'TES4', `En-tête TES4 manquant : ${plugin}`);
    const masters = header.fields.filter(([s]) => s === 'MAST').map(([,v]) => decode(v));
    for (const m of masters) check(seen.has(normalize(m)), `Master absent ou chargé après ${plugin} : ${m}`);
    const localized = Boolean(header.flags & 128), mapping = [...masters, plugin];
    const stem = plugin.replace(/\.(esm|esp|esl)$/i, '');
    const tableKey = ['french', 'english'].map(l => normalize(`strings\\${stem}_${l}.strings`)).find(k => tables.has(k));
    let count = 0;
    for (const r of all) {
      count++;
      const owner = known.get(normalize(mapping[r.formId >>> 24] ?? ''));
      check(owner, `Origine FormID non résolue : ${plugin} ${hex(r.formId)}`);
      const idLocal = hex(r.formId & 0xffffff), id = `${owner.toLowerCase()}|${idLocal}`;
      const fields = new Map(r.fields), full = fields.get('FULL');
      let name = '', nameStatus = 'Sans nom', nameSource = '';
      if (full) {
        if (localized) {
          check(full.length === 4, `FULL localisé invalide : ${id}`);
          name = tables.get(tableKey)?.get(full.readUInt32LE(0)) ?? '';
          nameStatus = name ? (tableKey.includes('_french.') ? 'Table française' : 'Repli anglais') : 'Traduction introuvable';
          nameSource = tableKey ? `${tableSources.get(tableKey)} : ${tableKey}` : '';
        } else { name = decode(full); nameStatus = name ? 'Nom intégré au plugin' : 'Sans nom'; nameSource = plugin; }
      }
      let reason = r.flags & 32 ? 'Supprimé par le plugin final' : '';
      if (!reason && !name) reason = nameStatus;
      if (!reason && ['ARMO', 'WEAP', 'AMMO', 'KEYM', 'MISC'].includes(r.sig) && (r.flags & 4)) reason = 'Non jouable (drapeau)';
      const weaponData = fields.get('DNAM'), ammoData = fields.get('DATA'), bodyData = fields.get('BODT');
      if (!reason && ((r.sig === 'WEAP' && weaponData?.length >= 14 && (weaponData.readUInt16LE(12) & 128)) ||
        (r.sig === 'AMMO' && ammoData?.length >= 8 && (ammoData.readUInt32LE(4) & 2)) ||
        (r.sig === 'ARMO' && bodyData?.length >= 5 && (bodyData[4] & 16)))) reason = 'Non jouable (données objet)';
      if (!reason && r.sig === 'LIGH') {
        const data = fields.get('DATA');
        if (!data || data.length < 16 || !(data.readUInt32LE(12) & 2)) reason = 'Lumière non transportable';
      }
      winners.set(id, { id, nom: name, categorie: categories[r.sig], type: r.sig,
        plugin_origine: owner, id_local: idLocal, plugin_final: plugin,
        editor_id: fields.has('EDID') ? decode(fields.get('EDID')) : '',
        statut_nom: nameStatus, source_nom: nameSource, exclusion: reason,
        disponibilite_serveur: 'À vérifier' });
    }
    plugins.push({ plugin, masters, localized, light: Boolean(header.flags & 512), objectsRead: count,
      sha256: crypto.createHash('sha256').update(b).digest('hex') });
    seen.add(normalize(plugin));
    console.log(`${plugin} : ${count} enregistrements d'objets`);
  }
  const all = [...winners.values()].sort((a,b) => a.categorie.localeCompare(b.categorie, 'fr') || a.nom.localeCompare(b.nom, 'fr') || a.id.localeCompare(b.id));
  const candidates = all.filter(r => !r.exclusion), excluded = all.filter(r => r.exclusion);
  const countBy = (rows, key) => rows.reduce((a,r) => { a[r[key]] = (a[r[key]] ?? 0) + 1; return a; }, {});
  const report = { generatedAt: new Date().toISOString(), order, plugins, strings: [...tableSources].map(([table,source]) => ({table,source})),
    duplicateStringTables: duplicates, total: all.length, candidates: candidates.length, excluded: excluded.length,
    byCategory: countBy(candidates, 'categorie'), byOrigin: countBy(candidates, 'plugin_origine'),
    byFinalPlugin: countBy(candidates, 'plugin_final'), byNameStatus: countBy(all, 'statut_nom'), exclusions: countBy(excluded, 'exclusion') };
  fs.mkdirSync(outputDir, { recursive: true });
  const columns = ['id', 'nom', 'categorie', 'type', 'plugin_origine', 'id_local', 'plugin_final', 'editor_id', 'statut_nom', 'source_nom', 'exclusion', 'disponibilite_serveur'];
  fs.writeFileSync(path.join(outputDir, 'objets-candidats.csv'), csv(candidates, columns));
  fs.writeFileSync(path.join(outputDir, 'objets-keizaal.csv'), csv(candidates.filter(r => /^(keizaal|kzl)/i.test(r.plugin_origine)), columns));
  fs.writeFileSync(path.join(outputDir, 'objets-a-verifier.csv'), csv(excluded, columns));
  fs.writeFileSync(path.join(outputDir, 'rapport-extraction.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ total: report.total, candidates: report.candidates, exclusions: report.exclusions, names: report.byNameStatus, duplicateStringTables: duplicates }, null, 2));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(...process.argv.slice(2));
