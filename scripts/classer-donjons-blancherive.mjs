// Classe les donjons de Keizaal Online autour de Blancherive d'après l'export
// de l'admin de donjons (donjons, coffres, modèles de butin) croisé avec les
// coordonnées des cellules extraites des plugins (docs/loot/coffres-keizaal.csv)
// et le catalogue d'objets (docs/catalogue-objets/Objets.csv).
//
//   node scripts/classer-donjons-blancherive.mjs docs/keizaal/donjons.json [--rayon 60000] [--tout]
//
// L'export attendu est l'objet que le serveur envoie à la page « Donjons »
// (le snapshot `dungeonAdminData`), ou tout JSON contenant `dungeons` et
// `lootTemplates`, en tableau ou en dictionnaire. Les champs utilisés :
//   dungeons[].id, .name, .isInterior, .isOpen, .clearedThisWeek,
//   dungeons[].stages[].chests[].refId / .lootTemplate,
//   dungeons[].blockers[].pos {x,y} (position d'entrée si présente),
//   dungeons[].pos ou .position {x,y} (sinon),
//   lootTemplates[nom] = { rolls:{min,max}, guaranteed:[], weighted:[], chance:[] }
//     avec des entrées { baseId, count, weight, probability }.
// Les baseId hexadécimaux (0xAABBBBBB) sont résolus via docs/loadorder.txt
// (index de chargement AA) vers « plugin|BBBBBB » pour retrouver le nom français.

import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const fichier = args.find(a => !a.startsWith('--'));
const rayonArg = args.indexOf('--rayon');
const RAYON = rayonArg >= 0 ? Number(args[rayonArg + 1]) : 60000; // unités de jeu (≈ 850 m)
const TOUT = args.includes('--tout');

if (!fichier || !existsSync(fichier)) {
  console.error('Usage : node scripts/classer-donjons-blancherive.mjs <export.json> [--rayon N] [--tout]');
  process.exit(1);
}

// ---------- utilitaires ----------
const UNITES_PAR_METRE = 70; // 1 unité Skyrim ≈ 1,43 cm
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function lireCsv(chemin) {
  let t = readFileSync(chemin, 'utf8');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ';') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const h = rows[0];
  return rows.slice(1).filter(r => r.length >= h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

// ---------- références : plugins, catalogue, cellules ----------
const loadOrder = existsSync('docs/loadorder.txt')
  ? readFileSync('docs/loadorder.txt', 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
  : [];

const catalogue = new Map();
if (existsSync('docs/catalogue-objets/Objets.csv')) {
  for (const r of lireCsv('docs/catalogue-objets/Objets.csv')) catalogue.set(r['ID objet'].toLowerCase(), r['Nom']);
}

function cleObjet(baseId) {
  if (baseId == null) return null;
  const s = String(baseId).trim();
  if (s.includes('|')) return s.toLowerCase();
  const n = /^0x/i.test(s) ? parseInt(s, 16) : (/^\d+$/.test(s) ? Number(s) : NaN);
  if (!Number.isFinite(n)) return null;
  const idx = (n >>> 24) & 0xff, local = (n & 0xffffff).toString(16).toUpperCase().padStart(6, '0');
  const plugin = loadOrder[idx];
  return plugin ? `${plugin.toLowerCase()}|${local}` : null;
}
function nomObjet(baseId) {
  const k = cleObjet(baseId);
  if (k === 'skyrim.esm|00000F') return 'Or';
  return (k && catalogue.get(k)) || String(baseId);
}

const coffres = existsSync('docs/loot/coffres-keizaal.csv') ? lireCsv('docs/loot/coffres-keizaal.csv') : [];
const estExterieur = r => /Exterior|Origin|PlainsDistrict|World\d*$/i.test(r.cellule) || (!/\s/.test(r.cellule) && !/^skyrim\.esm\|/i.test(r.cellule) && /^[A-Z]/.test(r.cellule));

function moyenne(rows) {
  const pts = rows.map(r => [Number(r.x), Number(r.y)]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!pts.length) return null;
  return { x: pts.reduce((a, p) => a + p[0], 0) / pts.length, y: pts.reduce((a, p) => a + p[1], 0) / pts.length };
}

// Blancherive : barycentre des conteneurs des cellules extérieures de Whiterun.
const BLANCHERIVE = moyenne(coffres.filter(r => /^Whiterun(Exterior|Origin|PlainsDistrict)/i.test(r.cellule))) ?? { x: 17800, y: -11000 };

// Index lieu normalisé -> position extérieure moyenne (via le CSV des plugins).
const positionsLieux = new Map();
{
  const parLieu = new Map();
  for (const r of coffres) {
    if (!estExterieur(r)) continue;
    for (const k of [norm(r.lieu), norm(r.cellule.replace(/Exterior\d*$|\d+$/g, ''))]) {
      if (!k) continue;
      if (!parLieu.has(k)) parLieu.set(k, []);
      parLieu.get(k).push(r);
    }
  }
  for (const [k, rows] of parLieu) { const p = moyenne(rows); if (p) positionsLieux.set(k, p); }
}
function positionDepuisCsv(nom) {
  const n = norm(nom);
  if (positionsLieux.has(n)) return positionsLieux.get(n);
  const mots = n.split(' ').filter(m => m.length > 3 && !['camp', 'fort', 'grotte', 'cave', 'mine', 'tombe', 'tombeau', 'keep', 'tower', 'tour'].includes(m));
  let meilleur = null, score = 0;
  for (const [k, p] of positionsLieux) {
    const s = mots.filter(m => k.includes(m)).length;
    if (s > score) { score = s; meilleur = p; }
  }
  return score ? meilleur : null;
}

// ---------- export admin ----------
let snap = JSON.parse(readFileSync(fichier, 'utf8'));
if (snap.dungeonAdminData) snap = snap.dungeonAdminData;
const enListe = v => Array.isArray(v) ? v : Object.entries(v ?? {}).map(([id, d]) => ({ id, ...d }));
const donjons = enListe(snap.dungeons);
const modeles = Array.isArray(snap.lootTemplates)
  ? Object.fromEntries(snap.lootTemplates.map(t => [t.name, t]))
  : (snap.lootTemplates ?? {});

function evaluerModele(t) {
  if (!t) return { attendu: 0, detail: '' };
  const rolls = t.rolls ?? { min: 0, max: 0 };
  const garantis = (t.guaranteed ?? []).reduce((a, e) => a + (Number(e.count) || 1), 0);
  const tirages = ((Number(rolls.min) || 0) + (Number(rolls.max) || 0)) / 2;
  const poidsTotal = (t.weighted ?? []).reduce((a, e) => a + (Number(e.weight) || 0), 0) || 1;
  const parTirage = (t.weighted ?? []).reduce((a, e) => a + ((Number(e.weight) || 0) / poidsTotal) * (Number(e.count) || 1), 0);
  const chances = (t.chance ?? []).reduce((a, e) => {
    let p = Number(e.probability) || 0; if (p > 1) p /= 100;
    return a + p * (Number(e.count) || 1);
  }, 0);
  const attendu = garantis + tirages * parTirage + chances;
  const noms = [...(t.guaranteed ?? []), ...(t.weighted ?? []), ...(t.chance ?? [])]
    .map(e => nomObjet(e.baseId ?? e.formId ?? e.id)).filter(Boolean);
  return { attendu, detail: [...new Set(noms)].slice(0, 6).join(', ') };
}

const resultats = donjons.map(d => {
  const etages = d.stages ?? [];
  const coffresD = etages.flatMap(s => s.chests ?? []);
  const pnj = etages.reduce((a, s) => a + (s.npcs?.length ?? 0), 0);
  let attendu = 0; const objets = new Set(); const modelesUtilises = new Set();
  for (const c of coffresD) {
    const nom = c.lootTemplate || 'default-legacy';
    modelesUtilises.add(nom);
    const e = evaluerModele(modeles[nom]);
    attendu += e.attendu;
    e.detail.split(', ').filter(Boolean).forEach(o => objets.add(o));
  }
  const pts = (d.blockers ?? []).map(b => b.pos ?? b.position ?? b).filter(p => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)));
  let pos = pts.length ? { x: pts.reduce((a, p) => a + Number(p.x), 0) / pts.length, y: pts.reduce((a, p) => a + Number(p.y), 0) / pts.length } : null;
  let source = 'bloqueurs';
  if (!pos && (d.pos ?? d.position)) { const p = d.pos ?? d.position; pos = { x: Number(p.x), y: Number(p.y) }; source = 'export'; }
  if (!pos) { pos = positionDepuisCsv(d.name); source = pos ? 'plugins' : '—'; }
  const dist = pos ? Math.hypot(pos.x - BLANCHERIVE.x, pos.y - BLANCHERIVE.y) : null;
  return {
    nom: d.name ?? d.id, type: d.isInterior === false ? 'rencontre' : 'donjon',
    ouvert: d.isOpen ?? d.open ?? null, nettoye: d.clearedThisWeek ?? d.cleared ?? null,
    etages: etages.length, coffres: coffresD.length, pnj, attendu, modeles: [...modelesUtilises],
    objets: [...objets].slice(0, 8), dist, source,
  };
});

const dansRayon = TOUT ? resultats : resultats.filter(r => r.dist == null || r.dist <= RAYON);
dansRayon.sort((a, b) => (b.attendu - a.attendu) || ((a.dist ?? Infinity) - (b.dist ?? Infinity)));

const m = v => v == null ? '?' : `${Math.round(v / UNITES_PAR_METRE)} m`;
const etat = r => r.ouvert === false ? 'fermé' : r.nettoye ? 'nettoyé' : r.ouvert ? 'ouvert' : '?';
console.log(`Référence Blancherive : x=${Math.round(BLANCHERIVE.x)} y=${Math.round(BLANCHERIVE.y)} — rayon ${m(RAYON)} — ${donjons.length} donjons dans l'export, ${dansRayon.length} retenus\n`);
console.log('| Donjon | Type | État | Distance | Étages | Coffres | PNJ | Objets attendus | Modèles | Aperçu du butin |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---|---|');
for (const r of dansRayon) {
  console.log(`| ${r.nom} | ${r.type} | ${etat(r)} | ${m(r.dist)}${r.source === 'plugins' ? ' (≈)' : ''} | ${r.etages} | ${r.coffres} | ${r.pnj} | ${r.attendu.toFixed(1)} | ${r.modeles.join(', ')} | ${r.objets.join(', ')} |`);
}
const sansPos = resultats.filter(r => r.dist == null).map(r => r.nom);
if (sansPos.length) console.log(`\nSans position connue (gardés dans la liste) : ${sansPos.join(', ')}`);
const inconnus = [...new Set(resultats.flatMap(r => r.modeles))].filter(n => !modeles[n]);
if (inconnus.length) console.log(`Modèles référencés mais absents de l'export : ${inconnus.join(', ')}`);
