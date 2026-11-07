// Décrets de peines et amendes, côté serveur : rôles, création et
// initialisation de la feuille PeinesAmendes, version, contrôle des lignes,
// et cohérence du barème initial avec les textes — chaque article cité existe,
// chaque infraction du Code pénal local a son barème, chaque montant tient
// dans la fourchette impériale de sa qualification.
//
//   node scripts/test-peines.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { documentsLocaux } from './codex-local.mjs';

// ---------------------------------------------------------------- classeur factice
const sheets = new Map();
let ouvertures = 0, verrou = false, ecritures = 0;
class Sheet {
  constructor(rows = [], colonnes = 26) { this.rows = rows; this.colonnes = colonnes; this.lignesMax = Math.max(1000, rows.length); this.formats = new Map(); }
  getLastRow() { for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] || []).some(v => v !== '' && v !== null && v !== undefined)) return i + 1; return 0; }
  getMaxColumns() { return this.colonnes; }
  getMaxRows() { return this.lignesMax; }
  insertColumnsAfter(apres, n) { this.colonnes += n; }
  insertRowsAfter(apres, n) { this.lignesMax += n; }
  setFrozenRows() {}
  setColumnWidth() {}
  getRange(r, c, h = 1, w = 1) {
    const sheet = this;
    if (c + w - 1 > sheet.colonnes) throw new Error(`Colonne ${c + w - 1} hors de la feuille`);
    const range = {
      getValues: () => Array.from({ length: h }, (_, i) => Array.from({ length: w }, (_, j) => sheet.rows[r + i - 1]?.[c + j - 1] ?? '')),
      getDisplayValues: () => range.getValues().map(l => l.map(v => v === true ? 'TRUE' : String(v))),
      setValues(values) { ecritures++; values.forEach((l, i) => l.forEach((v, j) => { (sheet.rows[r + i - 1] ||= [])[c + j - 1] = v; })); return range; },
      setNumberFormat(f) { for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) sheet.formats.set(`${r + i}:${c + j}`, f); return range; },
      setFontWeight() { return range; },
      setWrap() { return range; }
    };
    return range;
  }
}
const ctx = vm.createContext({
  console, Date, SPREADSHEET_ID: 'test',
  requireRole(token, roles) { if (!roles.includes(token)) throw Error('Vous n’avez pas les droits nécessaires.'); return { role: token }; },
  SpreadsheetApp: {
    openById() { ouvertures++; return { getSheetByName: n => sheets.get(n) || null, insertSheet: n => { const s = new Sheet([], 26); sheets.set(n, s); return s; } }; },
    flush() {}
  },
  LockService: { getScriptLock: () => ({ waitLock() { assert.equal(verrou, false, 'Pas de verrou imbriqué'); verrou = true; }, releaseLock() { verrou = false; } }) },
  Utilities: {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: (algo, texte) => Array.from(createHash(algo).update(texte, 'utf8').digest()),
    base64EncodeWebSafe: octets => Buffer.from(octets).toString('base64url')
  }
});
for (const file of ['SyncCodex.js', 'Codex.js', 'JournalCodex.js', 'Amendes.js', 'PeinesAmendes.js']) vm.runInContext(fs.readFileSync(`src/${file}`, 'utf8'), ctx);
const plain = v => JSON.parse(JSON.stringify(v));
const SEED = Array.from(vm.runInContext('PEINES_INITIALES', ctx));
const SOURCES = vm.runInContext('PEINES_SOURCES', ctx);
const ECHELONS = vm.runInContext('PEINES_ECHELONS', ctx);
const HEADERS = Array.from(vm.runInContext('PEINES_HEADERS', ctx));

// ---------------------------------------------------------------- rôles
for (const role of ['VISITEUR', 'intrus']) {
  assert.throws(() => ctx.getPeinesAmendes(role), /droits nécessaires/, `${role} refusé`);
}
assert.equal(ouvertures, 0, 'Refus avant toute ouverture du classeur');
assert.equal(sheets.size, 0, 'Aucune feuille créée par un refus');

// ---------------------------------------------------------------- création et initialisation
const premiere = plain(ctx.getPeinesAmendes('GARDE'));
const feuille = sheets.get('PeinesAmendes');
assert.ok(feuille, 'Feuille créée à la première consultation');
assert.deepEqual(feuille.rows[0], HEADERS, 'En-têtes posés');
assert.equal(feuille.rows.length, SEED.length + 1, 'Une ligne par niveau du barème initial');
assert.equal(feuille.formats.get('2:2'), '@', 'Article en texte brut : « 15-1 » ne devient pas une date');
assert.equal(verrou, false);
assert.equal(premiere.lignes.length, SEED.length);
assert.deepEqual(premiere.anomalies, [], 'Barème initial sans anomalie ni avertissement');
assert.ok(premiere.version.length > 10);

const ecrituresAvant = ecritures;
const seconde = plain(ctx.getPeinesAmendes('OFFICIER', premiere.version));
assert.equal(ecritures, ecrituresAvant, 'Une feuille remplie n’est jamais réécrite');
assert.equal(seconde.lignes, null, 'Version connue : rien de renvoyé');
assert.equal(seconde.version, premiere.version);
assert.equal(plain(ctx.getPeinesAmendes('INTENDANT')).lignes.length, SEED.length, 'L’intendance consulte le barème');

// Une feuille vide (créée à la main) est initialisée ; une feuille aux autres en-têtes arrête tout.
sheets.set('PeinesAmendes', new Sheet([], 12));
assert.equal(plain(ctx.getPeinesAmendes('GARDE')).lignes.length, SEED.length, 'Feuille vide initialisée, colonnes ajoutées');
sheets.set('PeinesAmendes', new Sheet([['Article', 'Peine']], 12));
const ecrituresRefus = ecritures;
assert.throws(() => ctx.getPeinesAmendes('GARDE'), /doit contenir les colonnes/);
assert.equal(ecritures, ecrituresRefus, 'Aucune écriture sur une feuille inconnue');
sheets.set('PeinesAmendes', feuille);

// ---------------------------------------------------------------- lecture d'une ligne
const ligne = plain(premiere.lignes.find(l => l.source === SOURCES.CPL && l.article === '14' && l.qualification === 'crime'));
assert.deepEqual(
  { niveau: ligne.niveau, echelon: ligne.echelon, amende: ligne.amende, cachot: ligne.cachot, nobiliaire: ligne.nobiliaire, sang: ligne.sang },
  { niveau: 'Requalification en crime — en groupe, ou en abusant d’une autorité sur la victime', echelon: 'K1', amende: 600, cachot: 1, nobiliaire: 1000, sang: false }
);
assert.equal(ligne.ligne, feuille.rows.findIndex(r => r[1] === '14' && r[4] === 'Crime') + 1, 'Numéro de ligne physique');
const meurtre = premiere.lignes.find(l => l.source === SOURCES.CJI && l.article === '12' && l.echelon === 'K3');
assert.equal(meurtre.sang, true);
assert.equal(meurtre.nobiliaire, null, 'Crime de sang : pas d’amende de substitution');
const renvoi = premiere.lignes.find(l => l.source === SOURCES.CPen);
assert.equal(renvoi.article, '*');
assert.equal(renvoi.qualification, 'renvoi');

// ---------------------------------------------------------------- contrôles des lignes saisies à la main
function lireAvec(lignesSupplementaires) {
  sheets.set('PeinesAmendes', new Sheet([HEADERS, ...lignesSupplementaires.map(l => Object.assign(Array(12).fill(''), l))], 12));
  const r = plain(ctx.getPeinesAmendes('OFFICIER'));
  sheets.set('PeinesAmendes', feuille);
  return r;
}
const CPL = SOURCES.CPL;
let r = lireAvec([
  [CPL, '10', 'Injures', '', 'Contravention', 'C2', 50],
  [CPL, '10', 'Injures', 'Cas de base', 'Contravention', 'C2', 75],
  [CPL, '13', 'Chantage', '', 'Délit', 'D1', 'abc'],
  [CPL, '18', '', '', 'Infraction', 'D1', 250],
  ['', '19', '', '', 'Délit', 'D2', 250],
  [CPL, '20', 'Vol', '', 'Délit', 'D1', 3000],
  [CPL, '21', '', '', 'délit', 'K1', 500, 1],
  [CPL, '12', '', '', 'Crime', 'K2', 750, 2, 1000, 'oui'],
  [CPL, '26', '', '', 'Contravention', 'C1', 25, 0.5],
  [CPL, '*', '', 'Renvoi', 'Renvoi', '', 100],
  [CPL, '24', '', '', 'Délit', 'D1', '1,5'],
  [CPL, '25', '', '', 'Crime', 'K1', '', 9999],
  [CPL, '17', '', '', 'Crime', 'K2', 750, 2, 1500],
  ['', '', '', '', '', '', '']
]);
const graves = r.anomalies.filter(a => a.grave).map(a => a.ligne);
assert.deepEqual(graves, [3, 4, 5, 6, 12, 13], 'Doublon, amende illisible, qualification inconnue, source vide, amende décimale, cachot démesuré : écartés');
assert.ok(r.anomalies.find(a => a.ligne === 3).message.includes('ligne 2'), 'Le doublon renvoie à la première ligne');
assert.equal(r.lignes.length, 7, 'Les lignes lisibles restent, la ligne vide est sautée');
const message = (n, motif) => assert.ok(r.anomalies.some(a => a.ligne === n && !a.grave && motif.test(a.message)), `Ligne ${n} : ${motif}`);
message(7, /hors de la fourchette impériale des délits \(de 100 à 500 septims\)/);
message(8, /Amende nobiliaire manquante.*art\. 13/);
message(8, /incohérent/);
message(9, /Crime de sang/);
message(10, /Cachot pour une contravention/);
message(11, /renvoi/i);
message(14, /Amende nobiliaire de 1500 septims au-delà du plafond impérial des crimes/);
assert.equal(r.lignes.find(l => l.article === '*').amende, null, 'Montant d’une ligne de renvoi ignoré');
assert.equal(r.lignes.find(l => l.article === '10').niveau, 'Cas de base', 'Niveau vide : cas de base');

// ---------------------------------------------------------------- cohérence du barème initial avec les textes
const documents = documentsLocaux();
const articlesParSource = new Map(documents.map(d => [d.source, new Map(d.articles.map(a => [a.article, a]))]));
const lignes = premiere.lignes;

// Chaque source du barème est au registre du Codex ; chaque article cité existe dans sa copie locale.
for (const l of lignes) {
  assert.ok(articlesParSource.has(l.source), `Source inconnue du registre : ${l.source}`);
  if (l.article === '*') continue;
  assert.ok(articlesParSource.get(l.source).has(l.article), `${l.source}, art. ${l.article} introuvable dans la copie locale`);
}

// Fourchettes impériales révisées (100 / 500 / 1 000) et rachat nobiliaire au plafond de la qualification.
assert.deepEqual(plain(vm.runInContext('PEINES_FOURCHETTES', ctx)), { contravention: { min: 1, max: 100 }, 'délit': { min: 100, max: 500 }, crime: { min: 500, max: 1000 } });
assert.equal(lignes.some(l => l.qualification === 'spéciale'), false, 'Plus de sanction spéciale : le De Re Nobilitatis ne chiffre plus les manquements nobiliaires');
for (const l of lignes) {
  if (l.qualification === 'contravention') { assert.ok(l.amende >= 1 && l.amende <= 100, `${l.article} ${l.niveau}`); assert.equal(l.cachot, null); }
  if (l.qualification === 'délit') assert.ok(l.amende > 100 && l.amende <= 500, `${l.article} ${l.niveau}`);
  if (l.qualification === 'crime' && l.echelon !== 'PM') assert.ok(l.amende > 500 && l.amende <= 1000 && l.cachot > 0, `${l.article} ${l.niveau}`);
  if (l.echelon === 'PM') assert.deepEqual([l.amende, l.cachot, l.nobiliaire], [null, null, null], 'Peine maximale non chiffrée');
  if (l.cachot && !l.sang) {
    assert.equal(l.nobiliaire, l.qualification === 'délit' ? 500 : 1000, `Rachat nobiliaire ${l.source} art. ${l.article} ${l.niveau}`);
  }
  if (!l.cachot) assert.equal(l.nobiliaire, null);
  if (ECHELONS[l.echelon]) {
    assert.equal(l.amende, ECHELONS[l.echelon].amende ?? null, `Amende de l’échelon ${l.echelon}`);
    assert.equal(l.cachot, ECHELONS[l.echelon].cachot ?? null, `Cachot de l’échelon ${l.echelon}`);
  }
}

// Chaque infraction qualifiée du Code pénal local et du droit impérial pénal a son barème.
const qualifiees = /^(contravention|délit|crime|contravention ou délit|délit ou crime|qualification variable)$/i;
for (const source of [SOURCES.CPL, SOURCES.CJI, SOURCES.CCoL]) {
  for (const a of articlesParSource.get(source).values()) {
    if (!qualifiees.test(a.classification)) continue;
    assert.ok(lignes.some(l => l.source === source && l.article === a.article), `${source}, art. ${a.article} (${a.classification}) sans barème`);
  }
}

// Le premier niveau d'un article suit la qualification du Codex ; un article à
// double qualification propose les deux. Exception : titre et corps divergent
// (art. 39, crime au titre, délit au corps).
const divergents = new Set([`${CPL}|39`]);
const niveauxDe = (source, article) => lignes.filter(l => l.source === source && l.article === article);
for (const [source, articles] of articlesParSource) {
  for (const a of articles.values()) {
    const niveaux = niveauxDe(source, a.article);
    if (!niveaux.length) continue;
    const c = a.classification.toLowerCase();
    const qualifs = new Set(niveaux.map(n => n.qualification));
    if (c === 'contravention ou délit') assert.ok(qualifs.has('contravention') && qualifs.has('délit'), `${a.article} : deux qualifications`);
    else if (c === 'délit ou crime') assert.ok(qualifs.has('délit') && qualifs.has('crime'), `${a.article} : deux qualifications`);
    else if (['contravention', 'délit', 'crime'].includes(c) && !divergents.has(`${source}|${a.article}`)) {
      assert.equal(niveaux[0].qualification, c, `${source}, art. ${a.article} : premier niveau ${niveaux[0].qualification} pour un article qualifié ${c}`);
    }
  }
}
for (const article of ['4', '39']) {
  assert.deepEqual(niveauxDe(CPL, article).map(n => n.qualification), ['délit', 'crime'], `Art. ${article} : corps (délit) puis titre (crime)`);
}
// Dispositions générales du Code pénal local : sans barème. Le document saute l'article 29.
assert.deepEqual(['1', '2', '29'].map(a => niveauxDe(CPL, a).length), [0, 0, 0]);
assert.equal(articlesParSource.get(CPL).has('29'), false, 'Pas d’article 29 dans le texte');
assert.equal(lignes.some(l => l.source === SOURCES.DRN), false, 'De Re Nobilitatis : plus de ligne, l’art. 14 ne chiffre rien');

// Crimes de sang du droit impérial : meurtre, assassinat, torture, violences aggravées.
const sang = new Set(lignes.filter(l => l.sang).map(l => `${l.source}|${l.article}`));
assert.deepEqual([...sang].sort(), [`${SOURCES.CJI}|12`, `${SOURCES.CJI}|13`, `${SOURCES.CJI}|14`, `${SOURCES.CJI}|8`].sort());
assert.ok(lignes.every(l => !l.sang || l.qualification === 'crime'), 'Un crime de sang est un crime');

// Textes de compétence impériale exclusive : renvoi, sans peine locale.
for (const sigle of ['CPen', 'JM', 'DRBI']) {
  const r = lignes.filter(l => l.source === SOURCES[sigle]);
  assert.equal(r.length, 1, sigle);
  assert.equal(r[0].article, '*');
  assert.equal(r[0].qualification, 'renvoi');
}

console.log(`Peines et amendes : rôles, feuille, contrôles et barème initial (${lignes.length} niveaux, ${new Set(lignes.map(l => l.source + '|' + l.article)).size} articles) cohérents avec les textes.`);
